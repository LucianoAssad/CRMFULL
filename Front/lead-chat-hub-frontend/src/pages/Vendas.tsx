import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, ShoppingCart, Target, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Lead = { id: string; nome: string };
type Produto = { id: string; nome: string; valor_padrao: number };
type Conversa = { id: string; lead_id: string };

type Venda = {
  id: string;
  empresa_id: string;
  lead_id: string;
  conversa_id: string | null;
  oportunidade_id: string | null;
  status: string;
  valor_total: number;
  observacoes: string | null;
  data_venda: string;
  created_at: string;
  leads?: { nome: string | null; origem: string | null } | null;
  itens_venda?: { id: string; nome_produto: string | null; produto_servico_id: string }[];
};

type Oportunidade = {
  id: string; empresa_id: string; lead_id: string; titulo: string;
  produto_id: string | null; valor_estimado: number; status: string;
  conversa_id: string | null; origem: string | null; canal_origem: string | null;
};

type Conversao = { id: string; lead_id: string; status_envio: string };

const STATUSES = [
  { value: "aberta", label: "Aberta" },
  { value: "fechada", label: "Fechada" },
  { value: "cancelada", label: "Cancelada" },
  { value: "perdida", label: "Perdida" },
];

const fmtMoney = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusBadge = (s: string) => {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    aberta: "secondary",
    fechada: "default",
    cancelada: "destructive",
    perdida: "destructive",
  };
  return <Badge variant={map[s] ?? "outline"}>{s}</Badge>;
};

export default function Vendas() {
  const { activeConta } = useActiveAccount();
  const isFilha = activeConta?.tipo_conta === "filha";
  const empresaId = isFilha ? activeConta?.id ?? null : null;
  const [searchParams, setSearchParams] = useSearchParams();

  const [vendas, setVendas] = useState<Venda[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversoes, setConversoes] = useState<Conversao[]>([]);
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [loading, setLoading] = useState(false);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("all");
  const [filtroProduto, setFiltroProduto] = useState<string>("all");
  const [filtroOrigem, setFiltroOrigem] = useState<string>("all");
  const [filtroDe, setFiltroDe] = useState<string>("");
  const [filtroAte, setFiltroAte] = useState<string>("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Venda | null>(null);
  const [form, setForm] = useState({
    lead_id: "",
    conversa_id: "",
    produto_id: "",
    valor: "0",
    status: "fechada",
    observacoes: "",
    oportunidade_id: "none",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!empresaId) return;
    setLoading(true);
    const [v, l, p, c, co, op] = await Promise.all([
      supabase
        .from("vendas")
        .select("id, empresa_id, lead_id, conversa_id, oportunidade_id, status, valor_total, observacoes, data_venda, created_at, leads!inner(nome, origem), itens_venda(id, nome_produto, produto_servico_id)")
        .eq("empresa_id", empresaId)
        .order("data_venda", { ascending: false }),
      supabase.from("leads").select("id, nome").eq("empresa_id", empresaId).order("nome"),
      supabase.from("produtos_servicos").select("id, nome, valor_padrao").eq("empresa_id", empresaId).eq("ativo", true).order("nome"),
      supabase.from("conversas").select("id, lead_id").eq("empresa_id", empresaId),
      supabase.from("conversoes_offline").select("id, lead_id, status_envio").eq("empresa_id", empresaId),
      supabase.from("oportunidades").select("id, empresa_id, lead_id, titulo, produto_id, valor_estimado, status, conversa_id, origem, canal_origem").eq("empresa_id", empresaId),
    ]);
    setVendas((v.data as any) || []);
    setLeads((l.data as any) || []);
    setProdutos((p.data as any) || []);
    setConversas((c.data as any) || []);
    setConversoes((co.data as any) || []);
    setOportunidades((op.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [empresaId]);

  const origens = useMemo(() => {
    const set = new Set<string>();
    vendas.forEach((v) => { if (v.leads?.origem) set.add(v.leads.origem); });
    return Array.from(set);
  }, [vendas]);

  const filtradas = useMemo(() => {
    return vendas.filter((v) => {
      if (busca && !(v.leads?.nome ?? "").toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroStatus !== "all" && v.status !== filtroStatus) return false;
      if (filtroProduto !== "all" && !(v.itens_venda || []).some((i) => i.produto_servico_id === filtroProduto)) return false;
      if (filtroOrigem !== "all" && (v.leads?.origem ?? "") !== filtroOrigem) return false;
      if (filtroDe && new Date(v.data_venda) < new Date(filtroDe)) return false;
      if (filtroAte && new Date(v.data_venda) > new Date(filtroAte + "T23:59:59")) return false;
      return true;
    });
  }, [vendas, busca, filtroStatus, filtroProduto, filtroOrigem, filtroDe, filtroAte]);

  const totals = useMemo(() => {
    const totalVendido = filtradas.filter((v) => v.status === "fechada").reduce((a, v) => a + Number(v.valor_total || 0), 0);
    const qtd = filtradas.length;
    const fechadas = filtradas.filter((v) => v.status === "fechada");
    const ticket = fechadas.length ? fechadas.reduce((a, v) => a + Number(v.valor_total || 0), 0) / fechadas.length : 0;
    return {
      totalVendido,
      qtd,
      ticket,
      abertas: filtradas.filter((v) => v.status === "aberta").length,
      fechadas: fechadas.length,
      canceladas: filtradas.filter((v) => v.status === "cancelada" || v.status === "perdida").length,
    };
  }, [filtradas]);

  if (!activeConta) {
    return <div className="p-6 text-sm text-muted-foreground">Selecione uma conta para continuar.</div>;
  }
  if (!isFilha) {
    return <div className="p-6 text-sm text-muted-foreground">Este módulo está disponível apenas para Contas Filhas.</div>;
  }

  const openNew = () => {
    setEditing(null);
    setForm({ lead_id: "", conversa_id: "", produto_id: "", valor: "0", status: "fechada", observacoes: "", oportunidade_id: "none" });
    setDialogOpen(true);
  };

  const openEdit = (v: Venda) => {
    setEditing(v);
    const item = (v.itens_venda || [])[0];
    setForm({
      lead_id: v.lead_id,
      conversa_id: v.conversa_id ?? "",
      produto_id: item?.produto_servico_id ?? "",
      valor: String(v.valor_total ?? 0),
      status: v.status,
      observacoes: v.observacoes ?? "",
      oportunidade_id: v.oportunidade_id ?? "none",
    });
    setDialogOpen(true);
  };

  const aplicarOportunidade = (opp: Oportunidade) => {
    setEditing(null);
    setForm({
      lead_id: opp.lead_id,
      conversa_id: opp.conversa_id ?? "",
      produto_id: opp.produto_id ?? "",
      valor: String(opp.valor_estimado ?? 0),
      status: "fechada",
      observacoes: "",
      oportunidade_id: opp.id,
    });
  };

  // Pré-seleção via querystring ?oportunidade=
  useEffect(() => {
    const oppId = searchParams.get("oportunidade");
    if (!oppId || oportunidades.length === 0) return;
    const opp = oportunidades.find((o) => o.id === oppId);
    if (opp) {
      aplicarOportunidade(opp);
      setDialogOpen(true);
    }
    searchParams.delete("oportunidade");
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oportunidades]);

  // Pré-seleção via querystring ?venda=
  useEffect(() => {
    const vId = searchParams.get("venda");
    if (!vId || vendas.length === 0) return;
    const v = vendas.find((x) => x.id === vId);
    if (v) openEdit(v);
    searchParams.delete("venda");
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendas]);

  const oppMap = useMemo(() => {
    const m: Record<string, Oportunidade> = {};
    oportunidades.forEach((o) => { m[o.id] = o; });
    return m;
  }, [oportunidades]);

  const oportunidadesDoLead = (leadId: string) =>
    oportunidades.filter((o) => o.lead_id === leadId);

  const save = async () => {
    if (!empresaId) return;
    if (!editing) {
      if (!form.lead_id) return toast.error("Selecione o lead/cliente");
      if (!form.produto_id) return toast.error("Selecione o produto");
    }
    const valor = parseFloat(form.valor || "0");
    if (!(valor >= 0)) return toast.error("Valor inválido");

    setSaving(true);
    try {
      const oportunidade_id = form.oportunidade_id !== "none" ? form.oportunidade_id : null;

      if (editing) {
        const { error } = await supabase
          .from("vendas")
          .update({
            status: form.status,
            valor_total: valor,
            observacoes: form.observacoes || null,
            oportunidade_id,
          })
          .eq("id", editing.id);
        if (error) throw error;

        if (form.produto_id) {
          const prod = produtos.find((p) => p.id === form.produto_id);
          await supabase.from("itens_venda").delete().eq("venda_id", editing.id);
          await supabase.from("itens_venda").insert({
            venda_id: editing.id,
            produto_servico_id: form.produto_id,
            nome_produto: prod?.nome ?? null,
            quantidade: 1,
            valor_unitario: valor,
            valor_total: valor,
          });
        }
        toast.success("Venda atualizada");
      } else {
        const prod = produtos.find((p) => p.id === form.produto_id);
        const { data: venda, error } = await supabase
          .from("vendas")
          .insert({
            empresa_id: empresaId,
            lead_id: form.lead_id,
            conversa_id: form.conversa_id || null,
            oportunidade_id,
            status: form.status,
            valor_total: valor,
            observacoes: form.observacoes || null,
            data_venda: new Date().toISOString(),
          })
          .select()
          .single();
        if (error) throw error;

        await supabase.from("itens_venda").insert({
          venda_id: venda.id,
          produto_servico_id: form.produto_id,
          nome_produto: prod?.nome ?? null,
          quantidade: 1,
          valor_unitario: valor,
          valor_total: valor,
        });
        toast.success("Venda registrada");
      }

      // Marcar oportunidade vinculada como ganha quando venda é fechada
      if (oportunidade_id && form.status === "fechada") {
        const opp = oportunidades.find((o) => o.id === oportunidade_id);
        if (opp && opp.status !== "ganha") {
          await supabase.from("oportunidades").update({
            status: "ganha",
            ganha_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", oportunidade_id);
        }
      }

      setDialogOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const gerarConversao = async (v: Venda) => {
    try {
      const lead = (v as any).leads;
      const nomeProd = (v.itens_venda || []).map((i) => i.nome_produto).filter(Boolean).join(" + ") || "Venda";
      const { error } = await supabase.from("conversoes_offline").insert({
        empresa_id: v.empresa_id,
        lead_id: v.lead_id,
        plataforma: "outros",
        nome_conversao: nomeProd,
        valor: v.valor_total,
        descricao: `Venda #${v.id.slice(0, 8)}`,
        convertido_em: v.data_venda,
        data_conversao: v.data_venda,
        status_envio: "pendente",
      } as any);
      if (error) throw error;
      toast.success("Conversão gerada");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar conversão");
    }
  };

  const conversoesByLead = useMemo(() => {
    const m = new Map<string, Conversao>();
    conversoes.forEach((c) => m.set(c.lead_id, c));
    return m;
  }, [conversoes]);

  const conversasDoLead = (leadId: string) => conversas.filter((c) => c.lead_id === leadId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Vendas</h1>
          <p className="text-sm text-muted-foreground">Acompanhe as vendas registradas nesta conta operacional.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Nova venda</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="Total vendido" value={fmtMoney(totals.totalVendido)} />
        <SummaryCard label="Qtd. vendas" value={String(totals.qtd)} />
        <SummaryCard label="Ticket médio" value={fmtMoney(totals.ticket)} />
        <SummaryCard label="Abertas" value={String(totals.abertas)} />
        <SummaryCard label="Fechadas" value={String(totals.fechadas)} />
        <SummaryCard label="Canceladas/Perdidas" value={String(totals.canceladas)} />
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroProduto} onValueChange={setFiltroProduto}>
            <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos produtos</SelectItem>
              {produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
            <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas origens</SelectItem>
              {origens.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input type="date" value={filtroDe} onChange={(e) => setFiltroDe(e.target.value)} />
            <Input type="date" value={filtroAte} onChange={(e) => setFiltroAte(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
          ) : filtradas.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <ShoppingCart className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma venda registrada nesta conta.</p>
              <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Registrar primeira venda</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente/Lead</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Conversa</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Conversão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((v) => {
                  const conv = conversoesByLead.get(v.lead_id);
                  const prod = (v.itens_venda || []).map((i) => i.nome_produto).filter(Boolean).join(", ");
                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span>{v.leads?.nome ?? "—"}</span>
                          {v.oportunidade_id && oppMap[v.oportunidade_id] && (
                            <Badge variant="secondary" className="text-[9px] w-fit gap-1">
                              <Target className="h-2.5 w-2.5" />
                              {oppMap[v.oportunidade_id].titulo} · {oppMap[v.oportunidade_id].status}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{prod || "—"}</TableCell>
                      <TableCell>{fmtMoney(v.valor_total)}</TableCell>
                      <TableCell>{statusBadge(v.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{v.leads?.origem ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{v.conversa_id ? v.conversa_id.slice(0, 8) : "—"}</TableCell>
                      <TableCell className="text-xs">{new Date(v.data_venda).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        {conv ? (
                          <Badge variant="outline">{conv.status_envio}</Badge>
                        ) : v.status === "fechada" ? (
                          <Button size="sm" variant="ghost" onClick={() => gerarConversao(v)}>
                            <Target className="mr-1 h-3 w-3" /> Gerar
                          </Button>
                        ) : (
                          <Badge variant="outline">Conversão não gerada</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openEdit(v)}>Editar</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar venda" : "Nova venda"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Lead/Cliente</Label>
              <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v, conversa_id: "" })} disabled={!!editing}>
                <SelectTrigger><SelectValue placeholder="Selecione o lead" /></SelectTrigger>
                <SelectContent>
                  {leads.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.lead_id && (
              <div className="space-y-1.5">
                <Label>Oportunidade vinculada (recomendado)</Label>
                <Select value={form.oportunidade_id} onValueChange={(v) => {
                  if (v === "none") { setForm({ ...form, oportunidade_id: "none" }); return; }
                  const opp = oportunidades.find((o) => o.id === v);
                  if (opp) aplicarOportunidade(opp);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem oportunidade</SelectItem>
                    {oportunidadesDoLead(form.lead_id).map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.titulo} · {o.status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {oportunidadesDoLead(form.lead_id).length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Nenhuma oportunidade encontrada para este cliente. Você ainda pode registrar a venda sem vínculo ou criar uma oportunidade no Pipeline.
                  </p>
                )}
                {form.oportunidade_id !== "none" && oppMap[form.oportunidade_id] && (
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 p-2 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" /> Vinculada à oportunidade <strong>{oppMap[form.oportunidade_id].titulo}</strong>
                    </span>
                    <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => window.location.assign("/account/pipeline")}>Abrir no Pipeline</Button>
                  </div>
                )}
              </div>
            )}
            {form.lead_id && conversasDoLead(form.lead_id).length > 0 && (
              <div className="space-y-1.5">
                <Label>Conversa vinculada (opcional)</Label>
                <Select value={form.conversa_id || "none"} onValueChange={(v) => setForm({ ...form, conversa_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {conversasDoLead(form.lead_id).map((c) => (
                      <SelectItem key={c.id} value={c.id}>#{c.id.slice(0, 8)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Produto</Label>
              <Select
                value={form.produto_id}
                onValueChange={(v) => {
                  const p = produtos.find((x) => x.id === v);
                  setForm({ ...form, produto_id: v, valor: p ? String(p.valor_padrao ?? form.valor) : form.valor });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor</Label>
                <Input type="number" min="0" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} maxLength={1000} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
