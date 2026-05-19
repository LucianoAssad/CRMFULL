import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertTriangle, Play, Pause, Send, Plus, RefreshCw, ShieldCheck, FileText, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Canal =
  | "whatsapp_oficial"
  | "whatsapp_nao_oficial"
  | "email"
  | "sms"
  | "webchat"
  | "instagram"
  | "messenger"
  | "telegram"
  | "tiktok";
type Status = "rascunho" | "pronta_para_revisao" | "simulada" | "agendada" | "enviando" | "enviada" | "concluida" | "pausada" | "erro" | "cancelada";

interface Campanha {
  id: string;
  nome: string;
  descricao: string | null;
  canal: Canal;
  status: Status;
  empresa_id: string;
  escopo: "conta" | "multiconta";
  template_id: string | null;
  assunto: string | null;
  mensagem: string | null;
  filtros: any;
  agendada_para: string | null;
  total_destinatarios: number;
  total_enviados: number;
  total_falhas: number;
  total_optout: number;
  created_at: string;
}

const CANAL_LABEL: Record<Canal, string> = {
  whatsapp_oficial: "WhatsApp Oficial",
  whatsapp_nao_oficial: "WhatsApp Não Oficial",
  email: "Email",
  sms: "SMS",
  webchat: "Webchat (notificação interna)",
  instagram: "Instagram",
  messenger: "Messenger",
  telegram: "Telegram",
  tiktok: "TikTok",
};

// Canais que ainda NÃO realizam envio externo nesta etapa.
const CANAIS_EM_PREPARACAO: Canal[] = ["webchat", "instagram", "messenger", "telegram", "tiktok"];
// Canais que permitem disparo (mesmo que simulado por enquanto).
const CANAIS_DISPARO: Canal[] = ["whatsapp_oficial", "whatsapp_nao_oficial", "email", "sms"];

const STATUS_VARIANT: Record<Status, "default" | "secondary" | "destructive" | "outline"> = {
  rascunho: "outline",
  pronta_para_revisao: "outline",
  simulada: "secondary",
  agendada: "secondary",
  enviando: "default",
  enviada: "default",
  concluida: "default",
  pausada: "secondary",
  erro: "destructive",
  cancelada: "destructive",
};

export default function Campanhas() {
  const { activeConta, modoSistema, contasFilhas, scopedContaIds } = useActiveAccount();
  const { user, usuarioId } = useAuth();
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isManager = modoSistema === "manager";

  const carregar = async () => {
    if (!activeConta) { setCampanhas([]); setLoading(false); return; }
    setLoading(true);
    const ids = scopedContaIds.length ? scopedContaIds : [activeConta.id];
    const { data, error } = await supabase
      .from("campanhas")
      .select("*")
      .in("empresa_id", ids)
      .order("created_at", { ascending: false });
    if (error) toast.error("Falha ao carregar campanhas");
    setCampanhas((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [activeConta?.id, refreshKey]);

  const metricas = useMemo(() => {
    const criadas = campanhas.length;
    const destFinais = campanhas.reduce((s, c) => s + (c.total_destinatarios || 0), 0);
    const enviados = campanhas.reduce((s, c) => s + (c.total_enviados || 0), 0);
    const optouts = campanhas.reduce((s, c) => s + (c.total_optout || 0), 0);
    const erros = campanhas.reduce((s, c) => s + (c.total_falhas || 0), 0);
    const taxa = destFinais > 0 ? Math.round((enviados / destFinais) * 100) : 0;
    return { criadas, destFinais, enviados, optouts, erros, taxa };
  }, [campanhas]);

  const agrupado = useMemo(() => ({
    rascunho: campanhas.filter((c) => c.status === "rascunho"),
    ativas: campanhas.filter((c) => ["agendada", "enviando", "pausada", "pronta_para_revisao"].includes(c.status)),
    concluidas: campanhas.filter((c) => ["concluida", "enviada", "simulada"].includes(c.status)),
    erros: campanhas.filter((c) => ["erro", "cancelada"].includes(c.status)),
  }), [campanhas]);

  const [logsOf, setLogsOf] = useState<Campanha | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsDest, setLogsDest] = useState<any[]>([]);
  useEffect(() => {
    if (!logsOf) { setLogs([]); setLogsDest([]); return; }
    (async () => {
      const [{ data: lg }, { data: dt }] = await Promise.all([
        supabase.from("campanha_logs").select("*").eq("campanha_id", logsOf.id).order("created_at", { ascending: false }).limit(200),
        supabase.from("campanha_destinatarios").select("id, status, contato_nome, contato_telefone, contato_email, erro, empresa_id, enviado_em").eq("campanha_id", logsOf.id).limit(200),
      ]);
      setLogs((lg as any) || []);
      setLogsDest((dt as any) || []);
    })();
  }, [logsOf]);


  const simularEnvio = async (c: Campanha) => {
    await supabase.from("campanhas").update({ status: "enviando", iniciada_em: new Date().toISOString() }).eq("id", c.id);
    await supabase.from("campanha_logs").insert({
      campanha_id: c.id,
      evento: "iniciada",
      mensagem: `Disparo simulado iniciado por ${user?.email ?? "desconhecido"}`,
      payload: { iniciado_por: { usuario_id: usuarioId, email: user?.email ?? null }, quando: new Date().toISOString() },
    });

    const { data: dests } = await supabase
      .from("campanha_destinatarios")
      .select("id, status")
      .eq("campanha_id", c.id);

    let enviados = 0, falhas = 0, optout = 0;
    for (const d of (dests as any[]) || []) {
      // Simula 85% sucesso, 10% falha, 5% opt-out
      const r = Math.random();
      const novoStatus = r < 0.85 ? "enviado" : r < 0.95 ? "falhou" : "opt_out";
      if (novoStatus === "enviado") enviados++;
      else if (novoStatus === "falhou") falhas++;
      else optout++;
      await supabase.from("campanha_destinatarios").update({
        status: novoStatus,
        enviado_em: novoStatus === "enviado" ? new Date().toISOString() : null,
        erro: novoStatus === "falhou" ? "simulação: falha aleatória" : null,
      }).eq("id", d.id);
    }

    await supabase.from("campanhas").update({
      status: "concluida",
      finalizada_em: new Date().toISOString(),
      total_enviados: enviados,
      total_falhas: falhas,
      total_optout: optout,
    }).eq("id", c.id);
    const motivos: string[] = [];
    if (falhas) motivos.push(`${falhas} falhas (simulação aleatória)`);
    if (optout) motivos.push(`${optout} marcados como opt-out`);
    await supabase.from("campanha_logs").insert({
      campanha_id: c.id,
      evento: "finalizada",
      mensagem: `Simulação concluída: ${enviados} enviados, ${falhas} falhas, ${optout} opt-out`,
      payload: {
        iniciado_por: { usuario_id: usuarioId, email: user?.email ?? null },
        quando: new Date().toISOString(),
        quantidade_prevista: c.total_destinatarios,
        quantidade_simulada: enviados,
        quantidade_ignorada: falhas + optout,
        motivos_ignorados: motivos,
      },
    });

    toast.success("Simulação concluída");
    setRefreshKey((k) => k + 1);
  };

  const pausar = async (c: Campanha) => {
    await supabase.from("campanhas").update({ status: "pausada" }).eq("id", c.id);
    await supabase.from("campanha_logs").insert({ campanha_id: c.id, evento: "pausada" });
    setRefreshKey((k) => k + 1);
  };

  if (!activeConta) {
    return <div className="p-6 text-muted-foreground">Selecione uma conta para gerenciar campanhas.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campanhas</h1>
          <p className="text-sm text-muted-foreground">
            Central de disparos controlados — público, opt-out, canal e template revisados antes do envio.
            {isManager
              ? <> · <span className="font-medium">Modo Gerente</span> (subárvore da Conta Gerente ativa).</>
              : <> · <span className="font-medium">Modo Conta</span> (apenas leads desta Conta Filha).</>}
          </p>
          <Alert className="mt-3">
            <Info className="h-4 w-4" />
            <AlertTitle>Envio real por API ainda não está ativo</AlertTitle>
            <AlertDescription>
              Nesta etapa o disparo é simulado e registrado em logs. Opt-out e regras de canal são aplicados normalmente.
            </AlertDescription>
          </Alert>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setOpenNew(true)}><Plus className="mr-2 h-4 w-4" /> Nova campanha</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Campanhas criadas</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metricas.criadas}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Destinatários finais</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metricas.destFinais}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Enviados/Simulados</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metricas.enviados}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Ignorados por opt-out</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-destructive">{metricas.optouts}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Erros</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-destructive">{metricas.erros}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Taxa de entrega</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metricas.taxa}%</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Lista de campanhas</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : campanhas.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma campanha ainda. Crie a primeira!</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Destinatários</TableHead>
                  <TableHead>Enviados</TableHead>
                  <TableHead>Falhas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campanhas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.nome}
                      {c.escopo === "multiconta" && <Badge variant="outline" className="ml-2">multiconta</Badge>}
                    </TableCell>
                    <TableCell>{CANAL_LABEL[c.canal]}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge></TableCell>
                    <TableCell>{c.total_destinatarios}</TableCell>
                    <TableCell>{c.total_enviados}</TableCell>
                    <TableCell>{c.total_falhas}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setLogsOf(c)} title="Ver logs">
                          <FileText className="h-4 w-4" />
                        </Button>
                        {(c.status === "rascunho" || c.status === "agendada" || c.status === "pausada" || c.status === "pronta_para_revisao") && (
                          <Button size="sm" onClick={() => simularEnvio(c)}>
                            <Send className="mr-1 h-3 w-3" /> Simular envio
                          </Button>
                        )}
                        {c.status === "enviando" && (
                          <Button size="sm" variant="outline" onClick={() => pausar(c)}>
                            <Pause className="mr-1 h-3 w-3" /> Pausar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NewCampanhaDialog
        open={openNew}
        onClose={() => setOpenNew(false)}
        onSaved={() => { setRefreshKey((k) => k + 1); setOpenNew(false); }}
        isManager={isManager}
        // Hierarquia MCC: somente contas dentro do escopo permitido (todas filhas, diretas e indiretas)
        contasFilhas={contasFilhas
          .filter((cf) => scopedContaIds.includes(cf.id))
          .map((cf) => ({ id: cf.id, nome: cf.nome }))}
        empresaId={activeConta.id}
        contaGerenteId={isManager ? activeConta.id : null}
        scopedContaIds={scopedContaIds}
      />

      {/* Dialog de logs */}
      <Dialog open={!!logsOf} onOpenChange={(o) => !o && setLogsOf(null)}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>Logs · {logsOf?.nome}</DialogTitle></DialogHeader>
          <Tabs defaultValue="eventos">
            <TabsList><TabsTrigger value="eventos">Eventos</TabsTrigger><TabsTrigger value="dest">Destinatários</TabsTrigger></TabsList>
            <TabsContent value="eventos" className="pt-3">
              {logs.length === 0 ? <div className="text-sm text-muted-foreground">Sem eventos.</div> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Data/hora</TableHead><TableHead>Evento</TableHead><TableHead>Nível</TableHead>
                    <TableHead>Mensagem</TableHead><TableHead>Usuário</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-xs"><Badge variant="outline">{l.evento}</Badge></TableCell>
                        <TableCell className="text-xs">{l.nivel}</TableCell>
                        <TableCell className="text-xs">{l.mensagem || "—"}</TableCell>
                        <TableCell className="text-xs">{l.payload?.iniciado_por?.email || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
            <TabsContent value="dest" className="pt-3">
              {logsDest.length === 0 ? <div className="text-sm text-muted-foreground">Sem destinatários.</div> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Destinatário</TableHead><TableHead>Contato</TableHead>
                    <TableHead>Conta filha</TableHead><TableHead>Status</TableHead>
                    <TableHead>Motivo</TableHead><TableHead>Enviado em</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {logsDest.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="text-xs font-medium">{d.contato_nome || "—"}</TableCell>
                        <TableCell className="text-xs">{d.contato_telefone || d.contato_email || "—"}</TableCell>
                        <TableCell className="text-xs">{contasFilhas.find((c) => c.id === d.empresa_id)?.nome || d.empresa_id?.slice(0, 8) || "—"}</TableCell>
                        <TableCell className="text-xs"><Badge variant="outline">{d.status}</Badge></TableCell>
                        <TableCell className="text-xs text-destructive">{d.erro || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{d.enviado_em ? new Date(d.enviado_em).toLocaleString("pt-BR") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Dialog de criação =====
function NewCampanhaDialog({
  open, onClose, onSaved, isManager, contasFilhas, empresaId, contaGerenteId, scopedContaIds,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  isManager: boolean;
  contasFilhas: { id: string; nome: string }[];
  empresaId: string;
  contaGerenteId: string | null;
  scopedContaIds: string[];
}) {
  const { user, usuarioId } = useAuth();
  const [step, setStep] = useState<"info" | "publico" | "mensagem" | "revisao">("info");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [canal, setCanal] = useState<Canal>("whatsapp_oficial");
  const [agendada, setAgendada] = useState("");

  const [contasSelecionadas, setContasSelecionadas] = useState<string[]>([]);
  const [statusPipeline, setStatusPipeline] = useState<string>("todos");
  const [tagsTxt, setTagsTxt] = useState("");
  const [canalOrigem, setCanalOrigem] = useState<string>("todos");
  const [produtoNome, setProdutoNome] = useState("");
  const [diasUltimaInteracao, setDiasUltimaInteracao] = useState<string>("");

  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [criando, setCriando] = useState(false);

  // Conexões/canais conectados (provider) — escopados pela conta ativa / subárvore
  const [conexoes, setConexoes] = useState<any[]>([]);
  const [conexaoId, setConexaoId] = useState<string>("");

  // Revisão
  const [confirmado, setConfirmado] = useState(false);
  const [revisaoLoading, setRevisaoLoading] = useState(false);
  const [stats, setStats] = useState<{
    incluidos: number;
    removidosOptOut: number;
    semContato: number;
    totalBruto: number;
  } | null>(null);
  const [previewLeads, setPreviewLeads] = useState<any[]>([]);
  const [contasMap, setContasMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setStep("info"); setNome(""); setDescricao(""); setCanal("whatsapp_oficial");
    setContasSelecionadas(isManager ? [] : [empresaId]);
    setStatusPipeline("todos"); setTagsTxt(""); setCanalOrigem("todos"); setProdutoNome(""); setDiasUltimaInteracao("");
    setTemplateId(""); setAssunto(""); setMensagem(""); setConexaoId("");
    setConfirmado(false); setStats(null); setPreviewLeads([]);
  }, [open, isManager, empresaId]);

  // Mapa id->nome das contas (para o preview)
  useEffect(() => {
    setContasMap(Object.fromEntries(contasFilhas.map((c) => [c.id, c.nome])));
  }, [contasFilhas]);

  useEffect(() => {
    if (canal !== "whatsapp_oficial") return;
    (async () => {
      const ids = isManager ? [empresaId, ...contasSelecionadas] : [empresaId];
      const { data } = await supabase
        .from("whatsapp_templates")
        .select("id, nome, nome_externo, idioma, status, ativo, corpo, variaveis")
        .in("empresa_id", ids.length ? ids : [empresaId])
        .eq("ativo", true)
        .eq("status", "aprovado");
      setTemplates((data as any) || []);
    })();
  }, [canal, isManager, empresaId, contasSelecionadas]);

  // Carrega conexões/canais conectados (provider) escopados pela conta ativa / subárvore
  useEffect(() => {
    if (!open) return;
    (async () => {
      const ids = isManager ? scopedContaIds : [empresaId];
      if (!ids.length) { setConexoes([]); return; }
      // canais próprios + canais compartilhados vinculados à conta via canal_contas
      const [own, sharedLinks] = await Promise.all([
        supabase.from("canais_conectados")
          .select("id, nome, nome_exibicao, tipo, provider, ativo, empresa_id")
          .in("empresa_id", ids).eq("ativo", true),
        supabase.from("canal_contas")
          .select("canal_conectado_id, conta_filha_id, ativo")
          .in("conta_filha_id", ids).eq("ativo", true),
      ]);
      const list: any[] = [...(own.data || [])];
      const ownIds = new Set(list.map((c) => c.id));
      const sharedCanalIds = [...new Set(
        ((sharedLinks.data as any[]) || []).map((r) => r.canal_conectado_id).filter((id: string) => id && !ownIds.has(id))
      )];
      if (sharedCanalIds.length > 0) {
        const { data: sharedCanais } = await supabase
          .from("canais_conectados")
          .select("id, nome, nome_exibicao, tipo, provider, ativo, empresa_id")
          .in("id", sharedCanalIds).eq("ativo", true);
        for (const c of (sharedCanais as any[]) || []) list.push(c);
      }
      setConexoes(list);
    })();
  }, [open, isManager, empresaId, scopedContaIds]);

  // Tipo de canal_conectado correspondente ao canal selecionado
  const tipoConexaoEsperado = (() => {
    if (canal === "whatsapp_oficial") return "whatsapp_cloud";
    if (canal === "whatsapp_nao_oficial") return "whatsapp_baileys";
    if (canal === "email") return "email";
    if (canal === "sms") return "sms";
    return null;
  })();
  const conexoesDoCanal = conexoes.filter((c) =>
    !tipoConexaoEsperado ? false : (c.tipo === tipoConexaoEsperado || (canal === "whatsapp_oficial" && c.tipo === "whatsapp") || (canal === "whatsapp_nao_oficial" && c.tipo === "whatsapp"))
  );

  // Reset confirmação quando algo crítico muda
  useEffect(() => {
    setConfirmado(false);
    setStats(null);
    setPreviewLeads([]);
  }, [nome, canal, templateId, mensagem, assunto, statusPipeline, tagsTxt, canalOrigem, produtoNome, diasUltimaInteracao, contasSelecionadas, agendada]);

  const contasAlvo = (): string[] => {
    if (!isManager) return [empresaId];
    // Defesa em profundidade: nunca permitir IDs fora da hierarquia da gerente ativa.
    return contasSelecionadas.filter((id) => scopedContaIds.includes(id));
  };

  // Retorna leads incluídos + estatísticas de descarte
  const computarPublico = async (): Promise<{
    incluidos: any[];
    removidosOptOut: number;
    semContato: number;
    totalBruto: number;
  }> => {
    const ids = contasAlvo();
    if (!ids.length) return { incluidos: [], removidosOptOut: 0, semContato: 0, totalBruto: 0 };

    let q = supabase.from("leads").select("id, nome, telefone, email, status, tags, empresa_id, updated_at").in("empresa_id", ids);
    if (statusPipeline !== "todos") q = q.eq("status", statusPipeline as any);
    if (tagsTxt.trim()) {
      const tags = tagsTxt.split(",").map((t) => t.trim()).filter(Boolean);
      if (tags.length) q = q.overlaps("tags", tags);
    }
    if (canalOrigem !== "todos") q = q.eq("origem", canalOrigem);
    if (diasUltimaInteracao && Number(diasUltimaInteracao) > 0) {
      const cutoff = new Date(Date.now() - Number(diasUltimaInteracao) * 86400000).toISOString();
      q = q.gte("updated_at", cutoff);
    }
    const { data } = await q.limit(2000);
    let leads = (data as any[]) || [];

    if (produtoNome.trim()) {
      const { data: vendasData } = await supabase
        .from("vendas")
        .select("id, lead_id")
        .in("empresa_id", ids);
      const vendasRaw: any[] = (vendasData as any) || [];
      let leadsComProduto = new Set<string>();
      if (vendasRaw.length > 0) {
        const vids = vendasRaw.map((v: any) => v.id);
        const { data: itensData } = await supabase
          .from("itens_venda")
          .select("venda_id, nome_produto")
          .in("venda_id", vids);
        const itensByVenda: Record<string, string[]> = {};
        for (const item of (itensData as any) || []) {
          if (item.nome_produto) (itensByVenda[item.venda_id] ||= []).push(item.nome_produto);
        }
        const q = produtoNome.toLowerCase();
        leadsComProduto = new Set(
          vendasRaw
            .filter((v: any) => (itensByVenda[v.id] || []).some((n: string) => n.toLowerCase().includes(q)))
            .map((v: any) => v.lead_id)
        );
      }
      leads = leads.filter((l) => leadsComProduto.has(l.id));
    }

    const totalBruto = leads.length;

    // Opt-outs
    const canalOptout = canal === "email" ? "email" : canal === "sms" ? "sms" : "whatsapp";
    const { data: optouts } = await supabase
      .from("opt_outs")
      .select("lead_id, canal")
      .in("empresa_id", ids)
      .in("canal", [canalOptout, "todos"]);
    const optoutSet = new Set((optouts || []).map((o: any) => o.lead_id));
    const semOptOut = leads.filter((l) => !optoutSet.has(l.id));
    const removidosOptOut = leads.length - semOptOut.length;

    // Sem contato compatível com canal
    const temContato = (l: any) => canal === "email" ? !!l.email : !!l.telefone;
    const incluidos = semOptOut.filter(temContato);
    const semContato = semOptOut.length - incluidos.length;

    return { incluidos, removidosOptOut, semContato, totalBruto };
  };

  const prepararRevisao = async () => {
    setRevisaoLoading(true);
    try {
      const r = await computarPublico();
      setStats({ incluidos: r.incluidos.length, removidosOptOut: r.removidosOptOut, semContato: r.semContato, totalBruto: r.totalBruto });
      setPreviewLeads(r.incluidos.slice(0, 10));
    } finally {
      setRevisaoLoading(false);
    }
  };

  // Carregar revisão automaticamente ao entrar na aba
  useEffect(() => {
    if (step === "revisao") prepararRevisao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const tplSel = templates.find((t) => t.id === templateId);
  const variaveisTpl: string[] = Array.isArray(tplSel?.variaveis) ? tplSel.variaveis : [];

  const validarMensagem = (paraEnvio: boolean): string | null => {
    if (!nome.trim()) return "Nome obrigatório";
    if (canal === "whatsapp_oficial" && !templateId) return "Selecione um template aprovado";
    if (CANAIS_DISPARO.includes(canal) && canal !== "whatsapp_oficial" && !mensagem.trim()) return "Mensagem obrigatória";
    if (isManager && contasSelecionadas.length === 0) return "Selecione ao menos uma conta filha";
    if (paraEnvio && CANAIS_EM_PREPARACAO.includes(canal)) return "Este canal está em preparação. Salve apenas como rascunho.";
    if (paraEnvio && CANAIS_DISPARO.includes(canal) && conexoesDoCanal.length > 0 && !conexaoId) return "Selecione uma conexão (provider) para o canal";
    return null;
  };

  const salvar = async (iniciarComoAgendada: boolean) => {
    const erro = validarMensagem(iniciarComoAgendada);
    if (erro) { toast.error(erro); return; }
    if (iniciarComoAgendada && !confirmado) { toast.error("Confirme a revisão antes de enviar"); return; }

    setCriando(true);
    try {
      const r = await computarPublico();
      const leads = r.incluidos;
      const filtros = { statusPipeline, tags: tagsTxt, canalOrigem, produtoNome, diasUltimaInteracao };

      const { data: camp, error } = await supabase.from("campanhas").insert({
        empresa_id: empresaId,
        criada_por_conta_id: empresaId,
        conta_gerente_id: contaGerenteId,
        escopo: isManager ? "multiconta" : "conta",
        nome, descricao, canal,
        status: iniciarComoAgendada ? "agendada" : "rascunho",
        template_id: canal === "whatsapp_oficial" ? templateId : null,
        assunto: canal === "email" ? assunto : null,
        mensagem: canal !== "whatsapp_oficial" ? mensagem : null,
        filtros,
        agendada_para: iniciarComoAgendada && agendada ? agendada : null,
        total_destinatarios: leads.length,
      });

      if (error || !camp) throw error || new Error("Falha ao criar");

      if (isManager) {
        await supabase.from("campanha_contas").insert(
          contasSelecionadas.map((cid) => ({ campanha_id: camp.id, conta_id: cid }))
        );
      }

      if (leads.length) {
        const dests = leads.map((l) => ({
          campanha_id: camp.id,
          empresa_id: l.empresa_id,
          lead_id: l.id,
          contato_nome: l.nome,
          contato_telefone: l.telefone,
          contato_email: l.email,
          status: "pendente" as const,
        }));
        for (let i = 0; i < dests.length; i += 500) {
          await supabase.from("campanha_destinatarios").insert(dests.slice(i, i + 500));
        }
      }

      // Log enriquecido com governança
      const motivosIgnorados: string[] = [];
      if (r.removidosOptOut > 0) motivosIgnorados.push(`${r.removidosOptOut} por opt-out`);
      if (r.semContato > 0) motivosIgnorados.push(`${r.semContato} sem contato compatível com canal`);

      await supabase.from("campanha_logs").insert({
        campanha_id: camp.id,
        evento: iniciarComoAgendada ? "agendada" : "criada",
        nivel: "info",
        mensagem: iniciarComoAgendada
          ? `Campanha agendada por ${user?.email ?? "desconhecido"} — prevista para ${leads.length} destinatários`
          : `Rascunho salvo por ${user?.email ?? "desconhecido"}`,
        payload: {
          iniciado_por: { usuario_id: usuarioId, email: user?.email ?? null },
          quando: new Date().toISOString(),
          quantidade_prevista: leads.length,
          quantidade_total_bruta: r.totalBruto,
          quantidade_ignorada: r.removidosOptOut + r.semContato,
          motivos_ignorados: motivosIgnorados,
          agendada_para: iniciarComoAgendada && agendada ? agendada : null,
          canal,
          escopo: isManager ? "multiconta" : "conta",
          contas_alvo: contasAlvo(),
          template_id: canal === "whatsapp_oficial" ? templateId : null,
        },
      });

      toast.success(iniciarComoAgendada ? "Campanha agendada" : "Rascunho salvo");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setCriando(false);
    }
  };

  const conexaoSel = conexoes.find((c) => c.id === conexaoId);
  const providerLabel = conexaoSel
    ? `${conexaoSel.nome_exibicao || conexaoSel.nome}${conexaoSel.provider ? ` · ${conexaoSel.provider}` : ""}`
    : (
      canal === "whatsapp_oficial" ? "WhatsApp Cloud API (oficial)" :
      canal === "whatsapp_nao_oficial" ? "Baileys (não oficial)" :
      canal === "email" ? "Email (SMTP)" :
      canal === "sms" ? "SMS Gateway" : "—"
    );

  const tipoEnvio = agendada ? "Agendado" : "Manual / imediato (após confirmação)";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Nova campanha</DialogTitle></DialogHeader>

        <Tabs value={step} onValueChange={(v) => setStep(v as any)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info">1. Info</TabsTrigger>
            <TabsTrigger value="publico">2. Público</TabsTrigger>
            <TabsTrigger value="mensagem">3. Mensagem</TabsTrigger>
            <TabsTrigger value="revisao">4. Revisão</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-3 pt-4">
            <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
            <div>
              <Label>Canal</Label>
              <Select value={canal} onValueChange={(v) => setCanal(v as Canal)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp_oficial">WhatsApp Oficial</SelectItem>
                  <SelectItem value="whatsapp_nao_oficial">WhatsApp Não Oficial</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="webchat">Webchat (notificação interna) — em preparação</SelectItem>
                  <SelectItem value="instagram">Instagram — em preparação</SelectItem>
                  <SelectItem value="messenger">Messenger — em preparação</SelectItem>
                  <SelectItem value="telegram">Telegram — em preparação</SelectItem>
                  <SelectItem value="tiktok">TikTok — em preparação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {CANAIS_EM_PREPARACAO.includes(canal) && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Canal em preparação</AlertTitle>
                <AlertDescription>
                  Este canal ainda não realiza envio externo. Você pode preparar a campanha, mas ela ficará apenas como rascunho/simulação.
                </AlertDescription>
              </Alert>
            )}

            {canal === "whatsapp_oficial" && (
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>WhatsApp Oficial</AlertTitle>
                <AlertDescription>
                  WhatsApp Oficial exige template aprovado para iniciar conversa ou enviar mensagem fora da janela de 24h.
                </AlertDescription>
              </Alert>
            )}

            {canal === "whatsapp_nao_oficial" && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Atenção: canal não oficial</AlertTitle>
                <AlertDescription>
                  Canal não oficial pode apresentar risco de bloqueio, instabilidade e não conformidade. Use com cautela.
                </AlertDescription>
              </Alert>
            )}

            {CANAIS_DISPARO.includes(canal) && (
              <div>
                <Label>Provider / Conexão</Label>
                <Select value={conexaoId} onValueChange={setConexaoId}>
                  <SelectTrigger><SelectValue placeholder={conexoesDoCanal.length === 0 ? "Nenhuma conexão disponível" : "Selecione a conexão"} /></SelectTrigger>
                  <SelectContent>
                    {conexoesDoCanal.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome_exibicao || c.nome} {c.provider ? `· ${c.provider}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Apenas conexões da {isManager ? "subárvore desta Conta Gerente" : "Conta Filha ativa"} (incluindo canais compartilhados vinculados).
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="publico" className="space-y-3 pt-4">
            {isManager && (
              <div>
                <Label>Contas filhas alvo</Label>
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-md border p-3">
                  {contasFilhas.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhuma conta filha vinculada.</div>
                  ) : contasFilhas.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={contasSelecionadas.includes(c.id)}
                        onCheckedChange={(v) => setContasSelecionadas((arr) =>
                          v ? [...arr, c.id] : arr.filter((x) => x !== c.id)
                        )}
                      />
                      {c.nome}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status do pipeline</Label>
                <Select value={statusPipeline} onValueChange={setStatusPipeline}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="novo">Novo</SelectItem>
                    <SelectItem value="qualificado">Qualificado</SelectItem>
                    <SelectItem value="em_negociacao">Em negociação</SelectItem>
                    <SelectItem value="ganho">Ganho</SelectItem>
                    <SelectItem value="perdido">Perdido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Canal de origem</Label>
                <Select value={canalOrigem} onValueChange={setCanalOrigem}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="meta">Meta</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="webchat">Webchat</SelectItem>
                    <SelectItem value="organico">Orgânico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Tags (vírgula)</Label><Input value={tagsTxt} onChange={(e) => setTagsTxt(e.target.value)} placeholder="vip, recorrente" /></div>
              <div><Label>Produto comprado contém</Label><Input value={produtoNome} onChange={(e) => setProdutoNome(e.target.value)} placeholder="ex: consulta" /></div>
              <div><Label>Última interação nos últimos N dias</Label><Input type="number" value={diasUltimaInteracao} onChange={(e) => setDiasUltimaInteracao(e.target.value)} placeholder="30" /></div>
            </div>
          </TabsContent>

          <TabsContent value="mensagem" className="space-y-3 pt-4">
            {canal === "whatsapp_oficial" ? (
              <div>
                <Label>Template aprovado</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum template aprovado disponível.</div>
                    ) : templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.nome} ({t.idioma})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tplSel && (
                  <div className="mt-2 rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                    {tplSel.corpo}
                  </div>
                )}
              </div>
            ) : (
              <>
                {canal === "email" && <div><Label>Assunto</Label><Input value={assunto} onChange={(e) => setAssunto(e.target.value)} /></div>}
                <div>
                  <Label>Mensagem livre</Label>
                  <Textarea rows={6} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Use {{nome}} para personalizar" />
                </div>
              </>
            )}
            <div>
              <Label>Agendar para (opcional)</Label>
              <Input type="datetime-local" value={agendada} onChange={(e) => setAgendada(e.target.value)} />
            </div>
          </TabsContent>

          <TabsContent value="revisao" className="space-y-4 pt-4">
            {revisaoLoading ? (
              <div className="text-sm text-muted-foreground">Calculando público e validando filtros…</div>
            ) : (
              <>
                {/* Resumo */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Resumo da campanha</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div><span className="text-muted-foreground">Nome:</span> <strong>{nome || "—"}</strong></div>
                    <div><span className="text-muted-foreground">Modo:</span> <strong>{isManager ? "Multiconta (gerente)" : "Conta filha"}</strong></div>
                    <div><span className="text-muted-foreground">Canal:</span> <strong>{CANAL_LABEL[canal]}</strong></div>
                    <div><span className="text-muted-foreground">Provider:</span> <strong>{providerLabel}</strong></div>
                    <div><span className="text-muted-foreground">Tipo de envio:</span> <strong>{tipoEnvio}</strong></div>
                    <div><span className="text-muted-foreground">Agendado para:</span> <strong>{agendada ? new Date(agendada).toLocaleString("pt-BR") : "—"}</strong></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Contas selecionadas:</span>{" "}
                      <strong>
                        {isManager
                          ? (contasSelecionadas.length === 0 ? "—" : contasSelecionadas.map((id) => contasMap[id] || id).join(", "))
                          : "Conta atual"}
                      </strong>
                    </div>
                  </CardContent>
                </Card>

                {/* Mensagem / template */}
                {canal === "whatsapp_oficial" ? (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Template aprovado</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <Alert>
                        <AlertTitle>Envio via template aprovado</AlertTitle>
                        <AlertDescription>Esta campanha utilizará um template já aprovado pela Meta, conforme as regras do WhatsApp Business.</AlertDescription>
                      </Alert>
                      <div><span className="text-muted-foreground">Nome:</span> <strong>{tplSel?.nome ?? "—"}</strong> <span className="text-muted-foreground">({tplSel?.nome_externo})</span></div>
                      <div><span className="text-muted-foreground">Idioma:</span> <strong>{tplSel?.idioma ?? "—"}</strong></div>
                      <div><span className="text-muted-foreground">Variáveis:</span> <strong>{variaveisTpl.length ? variaveisTpl.join(", ") : "nenhuma"}</strong></div>
                      <div className="rounded-md border bg-muted/30 p-3 whitespace-pre-wrap">{tplSel?.corpo ?? "—"}</div>
                    </CardContent>
                  </Card>
                ) : canal === "whatsapp_nao_oficial" ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Atenção: integração não oficial</AlertTitle>
                    <AlertDescription>
                      Esta campanha usa integração não oficial. Há risco de instabilidade, falha no envio ou bloqueio do número.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {canal !== "whatsapp_oficial" && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Mensagem</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {canal === "email" && <div><span className="text-muted-foreground">Assunto:</span> <strong>{assunto || "—"}</strong></div>}
                      <div className="rounded-md border bg-muted/30 p-3 whitespace-pre-wrap">{mensagem || "—"}</div>
                    </CardContent>
                  </Card>
                )}

                {/* Estatísticas de público */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Público estimado</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Total filtrado</div>
                        <div className="text-xl font-semibold">{stats?.totalBruto ?? 0}</div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Removidos por opt-out</div>
                        <div className="text-xl font-semibold text-destructive">{stats?.removidosOptOut ?? 0}</div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Sem {canal === "email" ? "e-mail" : "telefone"} válido</div>
                        <div className="text-xl font-semibold text-destructive">{stats?.semContato ?? 0}</div>
                      </div>
                      <div className="rounded-md border p-3 bg-primary/5">
                        <div className="text-xs text-muted-foreground">Destinatários finais</div>
                        <div className="text-xl font-semibold text-primary">{stats?.incluidos ?? 0}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Preview dos primeiros 10 */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Preview — primeiros 10 destinatários</CardTitle></CardHeader>
                  <CardContent>
                    {previewLeads.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Nenhum destinatário corresponde aos filtros atuais.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>{canal === "email" ? "Email" : "Telefone"}</TableHead>
                            <TableHead>Conta</TableHead>
                            <TableHead>Canal</TableHead>
                            <TableHead>Status pipeline</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewLeads.map((l) => (
                            <TableRow key={l.id}>
                              <TableCell className="font-medium">{l.nome}</TableCell>
                              <TableCell>{canal === "email" ? l.email : l.telefone}</TableCell>
                              <TableCell>{contasMap[l.empresa_id] || "—"}</TableCell>
                              <TableCell>{CANAL_LABEL[canal]}</TableCell>
                              <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Confirmação obrigatória */}
                <div className="rounded-md border bg-muted/20 p-3">
                  <label className="flex items-start gap-3 text-sm">
                    <Checkbox checked={confirmado} onCheckedChange={(v) => setConfirmado(!!v)} className="mt-0.5" />
                    <span>
                      <strong>Confirmo que revisei público, canal, template e regras de opt-out.</strong>
                      <br />
                      <span className="text-muted-foreground">
                        Iniciado por: <strong>{user?.email ?? "—"}</strong> em {new Date().toLocaleString("pt-BR")}
                      </span>
                    </span>
                  </label>
                </div>

                <Alert>
                  <AlertTitle>Modo simulação</AlertTitle>
                  <AlertDescription>
                    Os disparos não são enviados de verdade. A campanha ficará registrada e você poderá simular o envio para validar o fluxo.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="secondary" disabled={criando} onClick={() => salvar(false)}>Salvar como rascunho</Button>
          <Button
            disabled={criando || step !== "revisao" || !confirmado || (stats?.incluidos ?? 0) === 0}
            onClick={() => salvar(true)}
            title={step !== "revisao" ? "Vá até a etapa de Revisão" : (!confirmado ? "Marque a confirmação" : "")}
          >
            <Play className="mr-2 h-4 w-4" /> {agendada ? "Agendar" : "Marcar como agendada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
