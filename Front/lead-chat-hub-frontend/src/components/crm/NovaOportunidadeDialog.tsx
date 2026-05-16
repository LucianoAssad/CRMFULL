import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, User, Phone, Mail, MessageSquare, Sparkles, Target, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  empresaId: string;
  /** Quando informado, o lead já vem pré-selecionado (fluxo a partir do Lead/Atendimento). */
  leadId?: string | null;
  /** Quando informado, conversa já vem pré-selecionada e canal/origem são pré-preenchidos. */
  conversaId?: string | null;
  canalOrigem?: string | null;
  origem?: string | null;
  /** Quando informado, restringe pipeline/etapa ao pipeline atual (fluxo do Pipeline). */
  pipelineId?: string | null;
  trigger?: React.ReactNode;
  /** Renderiza sem o trigger e controla externamente o estado aberto. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: () => void | Promise<void>;
  /** Modo simplificado (ex.: criação manual a partir do Atendimento). */
  simple?: boolean;
}

interface LeadFull {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  origem: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  updated_at: string;
}
interface ConversaItem {
  id: string;
  canal_id: string | null;
  ultima_mensagem: string | null;
  ultima_mensagem_em: string | null;
}
interface CanalItem { id: string; nome: string; tipo: string | null }

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtRelativa = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `${days}d atrás`;
  return d.toLocaleDateString("pt-BR");
};

export function NovaOportunidadeDialog({
  empresaId,
  leadId: leadIdProp,
  conversaId: conversaIdProp,
  canalOrigem,
  origem,
  pipelineId: pipelineIdProp,
  trigger,
  open: openProp,
  onOpenChange,
  onCreated,
  simple = false,
}: Props) {
  const { user } = useAuth();
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = (v: boolean) => { onOpenChange ? onOpenChange(v) : setOpenInternal(v); };

  const [pipelines, setPipelines] = useState<any[]>([]);
  const [etapas, setEtapas] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string; email: string | null }[]>([]);
  const [canais, setCanais] = useState<Record<string, CanalItem>>({});
  const [saving, setSaving] = useState(false);

  // Lead search
  const [leadQuery, setLeadQuery] = useState("");
  const [leadResults, setLeadResults] = useState<LeadFull[]>([]);
  const [leadSelecionado, setLeadSelecionado] = useState<LeadFull | null>(null);
  const [leadSearching, setLeadSearching] = useState(false);

  // Conversas / contadores do lead
  const [conversasLead, setConversasLead] = useState<ConversaItem[]>([]);
  const [oppsAbertasCount, setOppsAbertasCount] = useState(0);
  const [vendasCount, setVendasCount] = useState(0);

  // Form
  const [form, setForm] = useState({
    titulo: "",
    produto_id: "none",
    valor_estimado: "0",
    pipeline_id: "",
    etapa_id: "",
    responsavel_id: "none",
    conversa_id: "none",
    origem: origem ?? "",
    canal_origem: canalOrigem ?? "",
    observacoes: "",
  });
  const tituloEditadoManual = useRef(false);
  const origemEditadaManual = useRef(false);
  const canalEditadoManual = useRef(false);

  // Reset ao abrir
  useEffect(() => {
    if (!open) return;
    tituloEditadoManual.current = false;
    origemEditadaManual.current = !!origem;
    canalEditadoManual.current = !!canalOrigem;
    setForm({
      titulo: "",
      produto_id: "none",
      valor_estimado: "0",
      pipeline_id: "",
      etapa_id: "",
      responsavel_id: "none",
      conversa_id: conversaIdProp ?? "none",
      origem: origem ?? "",
      canal_origem: canalOrigem ?? "",
      observacoes: "",
    });
    setLeadQuery("");
    setLeadResults([]);
    setLeadSelecionado(null);
    setConversasLead([]);
    setOppsAbertasCount(0);
    setVendasCount(0);
  }, [open, origem, canalOrigem, conversaIdProp]);

  // Carregar pipelines/produtos/usuarios/canais
  useEffect(() => {
    if (!open || !empresaId) return;
    (async () => {
      const [p, pr, u, c] = await Promise.all([
        supabase.from("pipelines").select("id,nome,ativo").eq("empresa_id", empresaId).eq("ativo", true).order("nome"),
        supabase.from("produtos_servicos").select("id,nome,valor_padrao").eq("empresa_id", empresaId).eq("ativo", true).order("nome"),
        supabase.from("usuarios").select("id,nome,email").eq("empresa_id", empresaId).eq("ativo", true).order("nome"),
        supabase.from("canais_conectados").select("id,nome,tipo").eq("empresa_id", empresaId),
      ]);
      const pipes = (p.data as any[]) || [];
      setPipelines(pipes);
      setProdutos((pr.data as any[]) || []);
      setUsuarios((u.data as any[]) || []);
      const cm: Record<string, CanalItem> = {};
      ((c.data as any[]) || []).forEach((x) => { cm[x.id] = x; });
      setCanais(cm);

      // Pipeline padrão
      const pipeId = pipelineIdProp || pipes[0]?.id || "";
      if (pipeId) setForm((f) => ({ ...f, pipeline_id: pipeId }));

      // Responsável padrão = usuário logado (match por email no escopo da Conta Filha)
      const me = (u.data as any[] | null)?.find((x) => x.email && user?.email && x.email.toLowerCase() === user.email.toLowerCase());
      if (me) setForm((f) => ({ ...f, responsavel_id: me.id }));
    })();
  }, [open, empresaId, pipelineIdProp, user?.email]);

  // Etapas do pipeline
  useEffect(() => {
    if (!form.pipeline_id) { setEtapas([]); return; }
    supabase.from("pipeline_etapas").select("id,nome,ordem").eq("pipeline_id", form.pipeline_id).order("ordem")
      .then(({ data }) => {
        const list = (data as any[]) || [];
        setEtapas(list);
        setForm((f) => ({ ...f, etapa_id: f.etapa_id || list[0]?.id || "" }));
      });
  }, [form.pipeline_id]);

  // Pré-selecionar lead via prop
  useEffect(() => {
    if (!open || !empresaId || !leadIdProp) return;
    supabase.from("leads")
      .select("id,nome,email,telefone,origem,utm_source,utm_medium,updated_at")
      .eq("id", leadIdProp).eq("empresa_id", empresaId).maybeSingle()
      .then(({ data }) => { if (data) selecionarLead(data as any, { conversaIdInicial: conversaIdProp }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, empresaId, leadIdProp]);

  // Busca de leads (debounce simples)
  useEffect(() => {
    if (!open || !empresaId || leadIdProp) return;
    const q = leadQuery.trim();
    if (q.length === 0) {
      // listagem inicial (mais recentes)
      setLeadSearching(true);
      supabase.from("leads")
        .select("id,nome,email,telefone,origem,utm_source,utm_medium,updated_at")
        .eq("empresa_id", empresaId)
        .order("updated_at", { ascending: false })
        .limit(20)
        .then(({ data }) => { setLeadResults((data as any[]) || []); setLeadSearching(false); });
      return;
    }
    const handler = setTimeout(() => {
      setLeadSearching(true);
      supabase.from("leads")
        .select("id,nome,email,telefone,origem,utm_source,utm_medium,updated_at")
        .eq("empresa_id", empresaId)
        .or(`nome.ilike.%${q}%,email.ilike.%${q}%,telefone.ilike.%${q}%`)
        .order("updated_at", { ascending: false })
        .limit(20)
        .then(({ data }) => { setLeadResults((data as any[]) || []); setLeadSearching(false); });
    }, 250);
    return () => clearTimeout(handler);
  }, [leadQuery, open, empresaId, leadIdProp]);

  const selecionarLead = async (lead: LeadFull, opts?: { conversaIdInicial?: string | null }) => {
    setLeadSelecionado(lead);
    // Auto título (se usuário não editou ainda)
    if (!tituloEditadoManual.current) {
      const prod = produtos.find((p) => p.id === form.produto_id);
      const tituloAuto = prod ? `${prod.nome} - ${lead.nome}` : `Oportunidade - ${lead.nome}`;
      setForm((f) => ({ ...f, titulo: tituloAuto }));
    }
    // Origem auto
    if (!origemEditadaManual.current) {
      const o = lead.origem || lead.utm_source || "";
      setForm((f) => ({ ...f, origem: o }));
    }

    // Carregar conversas, opps abertas e vendas em paralelo
    const [conv, opps, vend] = await Promise.all([
      supabase.from("conversas")
        .select("id,canal_id,ultima_mensagem,ultima_mensagem_em")
        .eq("empresa_id", empresaId).eq("lead_id", lead.id)
        .order("ultima_mensagem_em", { ascending: false }).limit(20),
      supabase.from("oportunidades")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId).eq("lead_id", lead.id).eq("status", "aberta"),
      supabase.from("vendas")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId).eq("lead_id", lead.id),
    ]);
    const convs = (conv.data as ConversaItem[]) || [];
    setConversasLead(convs);
    setOppsAbertasCount(opps.count || 0);
    setVendasCount(vend.count || 0);

    // Pré-selecionar conversa
    const convInicial = opts?.conversaIdInicial || (convs[0]?.id ?? null);
    if (convInicial) {
      const c = convs.find((x) => x.id === convInicial) || null;
      setForm((f) => ({ ...f, conversa_id: convInicial }));
      if (c && c.canal_id && !canalEditadoManual.current) {
        const canal = canais[c.canal_id];
        if (canal?.tipo) setForm((f) => ({ ...f, canal_origem: canal.tipo as string }));
      }
    }
  };

  const onSelectProduto = (pid: string) => {
    if (pid === "none") {
      setForm((f) => ({ ...f, produto_id: "none" }));
      // Re-derivar título sem produto se não foi editado
      if (!tituloEditadoManual.current && leadSelecionado) {
        setForm((f) => ({ ...f, produto_id: "none", titulo: `Oportunidade - ${leadSelecionado.nome}` }));
      }
      return;
    }
    const p = produtos.find((x) => x.id === pid);
    setForm((f) => ({
      ...f,
      produto_id: pid,
      valor_estimado: p && Number(p.valor_padrao) > 0 ? String(p.valor_padrao) : f.valor_estimado,
      titulo: !tituloEditadoManual.current && leadSelecionado
        ? `${p?.nome ?? ""} - ${leadSelecionado.nome}`
        : f.titulo,
    }));
  };

  const onSelectConversa = (cid: string) => {
    setForm((f) => ({ ...f, conversa_id: cid }));
    if (cid !== "none" && !canalEditadoManual.current) {
      const c = conversasLead.find((x) => x.id === cid);
      const canal = c?.canal_id ? canais[c.canal_id] : null;
      if (canal?.tipo) setForm((f) => ({ ...f, canal_origem: canal.tipo as string }));
    }
  };

  const salvar = async () => {
    if (!leadSelecionado) return toast.error("Selecione o lead/cliente");
    if (!form.titulo.trim()) return toast.error("Informe o título");
    if (!form.pipeline_id) return toast.error("Selecione o pipeline");
    if (!form.etapa_id) return toast.error("Selecione a etapa inicial");
    const valor = parseFloat(form.valor_estimado || "0") || 0;
    if (valor < 0) return toast.error("Valor estimado não pode ser negativo");

    setSaving(true);
    try {
      const { error } = await supabase.from("oportunidades").insert({
        empresa_id: empresaId,
        lead_id: leadSelecionado.id,
        pipeline_id: form.pipeline_id,
        etapa_id: form.etapa_id,
        titulo: form.titulo.trim(),
        produto_id: form.produto_id !== "none" ? form.produto_id : null,
        valor_estimado: valor,
        origem: form.origem.trim() || null,
        canal_origem: form.canal_origem.trim() || null,
        conversa_id: form.conversa_id !== "none" ? form.conversa_id : null,
        responsavel_id: form.responsavel_id !== "none" ? form.responsavel_id : null,
        observacoes: form.observacoes.trim() || null,
        status: "aberta",
      });
      if (error) throw error;
      toast.success("Oportunidade criada");
      setOpen(false);
      await onCreated?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar oportunidade");
    } finally {
      setSaving(false);
    }
  };

  const conversaSelecionada = useMemo(
    () => conversasLead.find((c) => c.id === form.conversa_id) || null,
    [conversasLead, form.conversa_id]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined || openProp === undefined ? (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm" variant="outline">
              <Plus className="mr-1 h-4 w-4" /> Nova oportunidade
            </Button>
          )}
        </DialogTrigger>
      ) : null}

      <DialogContent className={simple ? "max-w-lg max-h-[90vh] overflow-y-auto" : "max-w-3xl max-h-[90vh] overflow-y-auto"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            {simple ? "Criar oportunidade manualmente" : "Nova oportunidade"}
          </DialogTitle>
        </DialogHeader>

        {simple && (
          <p className="text-xs text-muted-foreground -mt-2">
            A criação manual é opcional. Ao criar um orçamento, a oportunidade será vinculada automaticamente.
          </p>
        )}

        <div className={simple ? "space-y-4" : "grid gap-4 md:grid-cols-[1fr_260px]"}>
          {/* Coluna principal */}
          <div className="space-y-4">
            {/* Etapa 1: Lead */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-full px-2 text-[10px]">1</Badge>
                <Label className="text-sm font-semibold">Cliente / Lead</Label>
              </div>
              {leadSelecionado ? (
                <div className="flex items-center justify-between rounded-md border bg-muted/30 p-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{leadSelecionado.nome}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {leadSelecionado.email || leadSelecionado.telefone || "—"}
                    </div>
                  </div>
                  {!leadIdProp && (
                    <Button size="sm" variant="ghost" onClick={() => { setLeadSelecionado(null); }}>
                      Trocar
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-7"
                      placeholder="Buscar por nome, telefone ou email..."
                      value={leadQuery}
                      onChange={(e) => setLeadQuery(e.target.value)}
                    />
                  </div>
                  <div className="max-h-48 overflow-auto rounded-md border">
                    {leadSearching && <div className="p-2 text-xs text-muted-foreground">Buscando...</div>}
                    {!leadSearching && leadResults.length === 0 && (
                      <div className="p-2 text-xs text-muted-foreground">
                        Nenhum lead encontrado.
                      </div>
                    )}
                    {leadResults.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => selecionarLead(l)}
                        className="flex w-full items-center gap-2 border-b px-2 py-1.5 text-left text-xs last:border-b-0 hover:bg-muted/50"
                      >
                        <User className="h-3 w-3 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{l.nome}</div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            {[l.email, l.telefone].filter(Boolean).join(" · ") || "—"}
                          </div>
                        </div>
                        {l.origem && <Badge variant="secondary" className="text-[9px]">{l.origem}</Badge>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>

            {/* Etapa 2: Negócio */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-full px-2 text-[10px]">2</Badge>
                <Label className="text-sm font-semibold">Negócio</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Título *</Label>
                  <div className="relative">
                    <Input
                      value={form.titulo}
                      onChange={(e) => { tituloEditadoManual.current = true; setForm({ ...form, titulo: e.target.value }); }}
                      placeholder={leadSelecionado ? "Será preenchido automaticamente" : "Selecione o lead primeiro"}
                    />
                    {!tituloEditadoManual.current && form.titulo && (
                      <Sparkles className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-primary" />
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Produto</Label>
                  <Select value={form.produto_id} onValueChange={onSelectProduto}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem produto</SelectItem>
                      {produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor estimado</Label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={form.valor_estimado}
                    onChange={(e) => setForm({ ...form, valor_estimado: e.target.value })}
                  />
                </div>
                {!pipelineIdProp && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Pipeline *</Label>
                    <Select value={form.pipeline_id} onValueChange={(v) => setForm({ ...form, pipeline_id: v, etapa_id: "" })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">Etapa inicial *</Label>
                  <Select value={form.etapa_id} onValueChange={(v) => setForm({ ...form, etapa_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {etapas.map((et) => <SelectItem key={et.id} value={et.id}>{et.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Responsável</Label>
                  <Select value={form.responsavel_id} onValueChange={(v) => setForm({ ...form, responsavel_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem responsável</SelectItem>
                      {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {!simple && (<>
            {/* Etapa 3: Origem */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-full px-2 text-[10px]">3</Badge>
                <Label className="text-sm font-semibold">Origem & Conversa</Label>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Conversa vinculada</Label>
                <Select
                  value={form.conversa_id}
                  onValueChange={onSelectConversa}
                  disabled={!leadSelecionado}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !leadSelecionado ? "Selecione o lead primeiro"
                        : conversasLead.length === 0 ? "Sem conversas vinculadas"
                        : "Selecione uma conversa"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem conversa</SelectItem>
                    {conversasLead.map((c) => {
                      const canal = c.canal_id ? canais[c.canal_id] : null;
                      const data = c.ultima_mensagem_em ? new Date(c.ultima_mensagem_em).toLocaleDateString("pt-BR") : "";
                      const trecho = (c.ultima_mensagem ?? "Conversa").slice(0, 40);
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          {canal?.tipo ?? "canal"} · {data} · {trecho}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    Origem
                    {form.origem && !origemEditadaManual.current && <Sparkles className="h-3 w-3 text-primary" />}
                  </Label>
                  <Input
                    value={form.origem}
                    onChange={(e) => { origemEditadaManual.current = true; setForm({ ...form, origem: e.target.value }); }}
                    placeholder="google, meta, indicação..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    Canal de origem
                    {form.canal_origem && !canalEditadoManual.current && <Sparkles className="h-3 w-3 text-primary" />}
                  </Label>
                  <Input
                    value={form.canal_origem}
                    onChange={(e) => { canalEditadoManual.current = true; setForm({ ...form, canal_origem: e.target.value }); }}
                    placeholder="whatsapp, webchat, instagram..."
                  />
                </div>
              </div>
            </section>

            {/* Observações */}
            <section className="space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                rows={2}
                placeholder={conversaSelecionada?.ultima_mensagem ? `Última msg: "${conversaSelecionada.ultima_mensagem.slice(0, 80)}"` : ""}
              />
            </section>
            </>)}
          </div>

          {!simple && (
          <aside className="space-y-3">
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Contexto do cliente
              </div>
              {!leadSelecionado ? (
                <div className="text-xs text-muted-foreground">
                  Selecione um lead para ver os dados.
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">{leadSelecionado.telefone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">{leadSelecionado.email || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">{leadSelecionado.origem || leadSelecionado.utm_source || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3 w-3 text-muted-foreground" />
                    <span>Última interação: {fmtRelativa(leadSelecionado.updated_at)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 pt-2">
                    <div className="rounded border bg-background p-1.5 text-center">
                      <div className="font-semibold text-sm">{conversasLead.length}</div>
                      <div className="text-[9px] text-muted-foreground">conversas</div>
                    </div>
                    <div className="rounded border bg-background p-1.5 text-center">
                      <div className="font-semibold text-sm">{oppsAbertasCount}</div>
                      <div className="text-[9px] text-muted-foreground">opps abertas</div>
                    </div>
                    <div className="rounded border bg-background p-1.5 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <ShoppingCart className="h-3 w-3" />
                        <span className="font-semibold text-sm">{vendasCount}</span>
                      </div>
                      <div className="text-[9px] text-muted-foreground">vendas</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {form.valor_estimado && Number(form.valor_estimado) > 0 && (
              <div className="rounded-md border bg-primary/5 p-3 text-center">
                <div className="text-[10px] uppercase text-muted-foreground">Valor da oportunidade</div>
                <div className="text-lg font-bold text-primary">{fmtBRL(Number(form.valor_estimado))}</div>
              </div>
            )}
          </aside>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || !leadSelecionado}>
            {saving ? "Salvando..." : "Criar oportunidade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
