import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { Lead, LEAD_STATUS_LABEL, LEAD_STATUS_COLOR, LeadStatus } from "@/lib/crm-types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MessageSquare, Pencil, Eye, Plus, Users, CheckCircle2, TrendingUp, DollarSign, MessageCircleOff } from "lucide-react";
import { VendaDialog } from "@/components/crm/VendaDialog";
import { IdentidadesLista } from "@/components/crm/IdentidadesLista";
import { OportunidadesLead } from "@/components/crm/OportunidadesLead";
import { listarIdentidadesPorEmpresa, syncLeadIdentidades, type LeadIdentidade } from "@/lib/lead-identidades";

type ConvRow = { id: string; lead_id: string; canal_id: string | null; status: string; ultima_mensagem_em: string | null; canal?: { nome: string; tipo: string } | null };
type VendaRow = { id: string; lead_id: string; valor_total: number; data_venda: string; status: string };
type ConvOff = { id: string; lead_id: string; plataforma: string | null; valor: number; nome_conversao: string | null; convertido_em: string };

const PERIODOS = [
  { v: "all", l: "Todo período" },
  { v: "7", l: "Últimos 7 dias" },
  { v: "30", l: "Últimos 30 dias" },
  { v: "90", l: "Últimos 90 dias" },
];

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Leads() {
  const navigate = useNavigate();
  const { activeContaId, activeConta } = useActiveAccount();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [conversas, setConversas] = useState<ConvRow[]>([]);
  const [vendas, setVendas] = useState<VendaRow[]>([]);
  const [conversoes, setConversoes] = useState<ConvOff[]>([]);
  const [identidades, setIdentidades] = useState<LeadIdentidade[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fOrigem, setFOrigem] = useState<string>("all");
  const [fConv, setFConv] = useState<string>("all");
  const [fPeriodo, setFPeriodo] = useState<string>("all");
  const [fCampanha, setFCampanha] = useState<string>("all");

  // Modal detalhe
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Lead>>({});

  // Modal criação
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<Partial<Lead>>({ nome: "", telefone: "", email: "", origem: "", status: "novo" });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!activeContaId) { setLeads([]); setConversas([]); setVendas([]); setConversoes([]); setIdentidades([]); return; }
    setLoading(true);
    const [{ data: l }, { data: c }, { data: v }, { data: co }, ids] = await Promise.all([
      supabase.from("leads").select("*").eq("empresa_id", activeContaId).order("created_at", { ascending: false }),
      supabase.from("conversas").select("id, lead_id, canal_id, status, ultima_mensagem_em, canal:canais_conectados(nome, tipo)").eq("empresa_id", activeContaId),
      supabase.from("vendas").select("id, lead_id, valor_total, data_venda, status").eq("empresa_id", activeContaId),
      supabase.from("conversoes_offline").select("id, lead_id, plataforma, valor, nome_conversao, convertido_em").eq("empresa_id", activeContaId),
      listarIdentidadesPorEmpresa(activeContaId),
    ]);
    setLeads((l as any) || []);
    setConversas((c as any) || []);
    setVendas((v as any) || []);
    setConversoes((co as any) || []);
    setIdentidades(ids);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeContaId]);

  const origens = useMemo(() => Array.from(new Set(leads.map((l) => l.origem).filter(Boolean))) as string[], [leads]);
  const campanhas = useMemo(() => Array.from(new Set(leads.map((l) => l.utm_campaign).filter(Boolean))) as string[], [leads]);

  const convByLead = useMemo(() => {
    const m: Record<string, ConvRow[]> = {};
    for (const c of conversas) (m[c.lead_id] ||= []).push(c);
    return m;
  }, [conversas]);
  const vendasByLead = useMemo(() => {
    const m: Record<string, VendaRow[]> = {};
    for (const v of vendas) (m[v.lead_id] ||= []).push(v);
    return m;
  }, [vendas]);
  const convOffByLead = useMemo(() => {
    const m: Record<string, ConvOff[]> = {};
    for (const c of conversoes) (m[c.lead_id] ||= []).push(c);
    return m;
  }, [conversoes]);
  const idsByLead = useMemo(() => {
    const m: Record<string, LeadIdentidade[]> = {};
    for (const i of identidades) (m[i.lead_id] ||= []).push(i);
    return m;
  }, [identidades]);

  // KPIs
  const kpis = useMemo(() => {
    const total = leads.length;
    const convertidos = leads.filter((l) => l.status === "convertido").length;
    const taxa = total > 0 ? (convertidos / total) * 100 : 0;
    const valorTotal = leads.reduce((s, l) => s + (Number(l.valor_estimado) || 0), 0);
    const semConversa = leads.filter((l) => !(convByLead[l.id] && convByLead[l.id].length > 0)).length;
    return { total, convertidos, taxa, valorTotal, semConversa };
  }, [leads, convByLead]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const minDate = fPeriodo === "all" ? null : new Date(Date.now() - parseInt(fPeriodo, 10) * 86400000);
    return leads.filter((l) => {
      if (q) {
        const hit = (l.nome || "").toLowerCase().includes(q) || (l.telefone || "").toLowerCase().includes(q) || (l.email || "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (fStatus !== "all" && l.status !== fStatus) return false;
      if (fOrigem !== "all" && (l.origem || "") !== fOrigem) return false;
      if (fCampanha !== "all" && (l.utm_campaign || "") !== fCampanha) return false;
      if (fConv === "sim" && l.status !== "convertido") return false;
      if (fConv === "nao" && l.status === "convertido") return false;
      if (minDate && new Date(l.created_at) < minDate) return false;
      return true;
    });
  }, [leads, busca, fStatus, fOrigem, fConv, fPeriodo, fCampanha]);

  const openLead = leads.find((l) => l.id === openId) || null;
  const openConvs = openId ? convByLead[openId] || [] : [];
  const openVendas = openId ? vendasByLead[openId] || [] : [];
  const openConvOff = openId ? convOffByLead[openId] || [] : [];
  const openIds = openId ? idsByLead[openId] || [] : [];

  const startEdit = () => { if (openLead) { setEditForm(openLead); setEditing(true); } };
  const saveEdit = async () => {
    if (!openLead) return;
    const patch = {
      nome: editForm.nome,
      telefone: editForm.telefone,
      email: editForm.email,
      status: editForm.status,
      origem: editForm.origem,
      notas: editForm.notas,
    };
    const { error } = await supabase.from("leads").update(patch as any).eq("id", openLead.id);
    if (error) { toast.error(error.message); return; }
    // Sincroniza identidades a partir dos campos editados
    const canalTipo = (convByLead[openLead.id] || []).find((c) => c.canal?.tipo)?.canal?.tipo || null;
    await syncLeadIdentidades({
      empresaId: openLead.empresa_id,
      leadId: openLead.id,
      telefone: editForm.telefone ?? openLead.telefone,
      email: editForm.email ?? openLead.email,
      origem: editForm.origem ?? openLead.origem,
      canalTipo,
    });
    toast.success("Lead atualizado");
    setEditing(false);
    await load();
  };

  const criarLead = async () => {
    if (!activeContaId) { toast.error("Selecione uma conta"); return; }
    if (!createForm.nome?.trim()) { toast.error("Informe o nome"); return; }
    setCreating(true);
    const { data: novo, error } = await supabase.from("leads").insert({
      empresa_id: activeContaId,
      nome: createForm.nome!.trim(),
      telefone: createForm.telefone || null,
      email: createForm.email || null,
      origem: createForm.origem || null,
      status: (createForm.status as LeadStatus) || "novo",
    } as any).select("id").maybeSingle();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    if (novo?.id) {
      await syncLeadIdentidades({
        empresaId: activeContaId,
        leadId: novo.id,
        telefone: createForm.telefone || null,
        email: createForm.email || null,
        origem: createForm.origem || null,
      });
    }
    toast.success("Lead cadastrado");
    setCreateOpen(false);
    setCreateForm({ nome: "", telefone: "", email: "", origem: "", status: "novo" });
    await load();
  };

  const abrirNoAtendimento = (leadId: string) => {
    const conv = (convByLead[leadId] || [])[0];
    if (!conv) { toast.info("Sem conversa vinculada"); return; }
    navigate(`/account/atendimento?conversa=${conv.id}`);
  };

  const Kpi = ({ icon: Icon, label, value, hint }: any) => (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="rounded-md bg-primary/10 text-primary p-2"><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold truncate">{value}</div>
          {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Leads/Clientes</h1>
          <p className="text-sm text-muted-foreground">Gerencie contatos, oportunidades e clientes desta conta.</p>
          {activeConta && <p className="text-xs text-muted-foreground mt-1">Conta ativa: {activeConta.nome}</p>}
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Cadastrar lead/cliente</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi icon={Users} label="Total de leads" value={kpis.total} />
        <Kpi icon={CheckCircle2} label="Convertidos" value={kpis.convertidos} />
        <Kpi icon={TrendingUp} label="Taxa de conversão" value={`${kpis.taxa.toFixed(1)}%`} />
        <Kpi icon={DollarSign} label="Valor convertido" value={brl(kpis.valorTotal)} />
        <Kpi icon={MessageCircleOff} label="Sem conversa" value={kpis.semConversa} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Buscar por nome, telefone ou email" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-72" />
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {(Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{LEAD_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fOrigem} onValueChange={setFOrigem}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            {origens.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fCampanha} onValueChange={setFCampanha}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas campanhas</SelectItem>
            {campanhas.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fConv} onValueChange={setFConv}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Convertido: todos</SelectItem>
            <SelectItem value="sim">Convertidos</SelectItem>
            <SelectItem value="nao">Não convertidos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fPeriodo} onValueChange={setFPeriodo}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODOS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">{filtered.length} de {leads.length}</div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Canal 1º contato</TableHead>
              <TableHead>UTM Campaign</TableHead>
              <TableHead>Convertido</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-12">
                  {loading ? "Carregando..." : leads.length === 0 ? (
                    <div className="space-y-3">
                      <p>Nenhum lead ou cliente cadastrado nesta conta.</p>
                      <p className="text-xs">Você pode importar leads em Importações ou gerar leads pelo Atendimento.</p>
                      <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Cadastrar lead/cliente</Button>
                    </div>
                  ) : "Nenhum lead encontrado com os filtros atuais."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((l) => {
              const convs = convByLead[l.id] || [];
              const primeiroCanal = convs.sort((a, b) => (a.ultima_mensagem_em || "").localeCompare(b.ultima_mensagem_em || ""))[0]?.canal?.nome;
              const convertido = l.status === "convertido";
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.nome}</TableCell>
                  <TableCell className="text-xs">
                    <div>{l.telefone || "—"}</div>
                    <div className="text-muted-foreground">{l.email || "—"}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={LEAD_STATUS_COLOR[l.status]}>{LEAD_STATUS_LABEL[l.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{l.origem || "—"}</TableCell>
                  <TableCell className="text-xs">{primeiroCanal || <span className="text-muted-foreground">Sem conversa vinculada</span>}</TableCell>
                  <TableCell className="text-xs">{l.utm_campaign || "—"}</TableCell>
                  <TableCell>
                    {convertido ? <Badge className="bg-success/15 text-success border-success/30" variant="outline">Sim</Badge> : <span className="text-xs text-muted-foreground">Não</span>}
                  </TableCell>
                  <TableCell className="text-xs">{l.valor_estimado ? brl(Number(l.valor_estimado)) : "—"}</TableCell>
                  <TableCell className="text-xs">{new Date(l.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" title="Ver detalhes" onClick={() => { setOpenId(l.id); setEditing(false); }}><Eye className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" title="Editar" onClick={() => { setOpenId(l.id); setEditForm(l); setEditing(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" title={convs.length === 0 ? "Sem conversa vinculada" : "Abrir no Atendimento"} disabled={convs.length === 0} onClick={() => abrirNoAtendimento(l.id)}><MessageSquare className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Modal criação */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cadastrar lead/cliente</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nome *</Label><Input value={createForm.nome || ""} onChange={(e) => setCreateForm({ ...createForm, nome: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={createForm.telefone || ""} onChange={(e) => setCreateForm({ ...createForm, telefone: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={createForm.email || ""} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} /></div>
            <div><Label>Origem</Label><Input placeholder="ex: site, indicação" value={createForm.origem || ""} onChange={(e) => setCreateForm({ ...createForm, origem: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={createForm.status || "novo"} onValueChange={(v) => setCreateForm({ ...createForm, status: v as LeadStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{LEAD_STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={criarLead} disabled={creating}>{creating ? "Salvando..." : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openId} onOpenChange={(o) => { if (!o) { setOpenId(null); setEditing(false); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{openLead?.nome}</DialogTitle>
          </DialogHeader>
          {openLead && (
            <div className="space-y-5 text-sm">
              {editing ? (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Nome</Label><Input value={editForm.nome || ""} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} /></div>
                  <div><Label>Telefone</Label><Input value={editForm.telefone || ""} onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })} /></div>
                  <div><Label>Email</Label><Input value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
                  <div><Label>Origem</Label><Input value={editForm.origem || ""} onChange={(e) => setEditForm({ ...editForm, origem: e.target.value })} /></div>
                  <div>
                    <Label>Status</Label>
                    <Select value={editForm.status || "novo"} onValueChange={(v) => setEditForm({ ...editForm, status: v as LeadStatus })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>{LEAD_STATUS_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Label>Observações</Label><Textarea value={editForm.notas || ""} onChange={(e) => setEditForm({ ...editForm, notas: e.target.value })} /></div>
                </div>
              ) : (
                <>
                  <section>
                    <h3 className="font-semibold mb-2">Contato</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Telefone:</span> {openLead.telefone || "—"}</div>
                      <div><span className="text-muted-foreground">Email:</span> {openLead.email || "—"}</div>
                      <div><span className="text-muted-foreground">Status:</span> {LEAD_STATUS_LABEL[openLead.status]}</div>
                      <div><span className="text-muted-foreground">Origem:</span> {openLead.origem || "—"}</div>
                      <div><span className="text-muted-foreground">Canal 1º contato:</span> {openConvs.sort((a,b) => (a.ultima_mensagem_em || "").localeCompare(b.ultima_mensagem_em || ""))[0]?.canal?.nome || "—"}</div>
                    </div>
                  </section>
                  <section>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="rounded-md border bg-muted/30 p-2 text-center">
                        <div className="text-[10px] uppercase text-muted-foreground">Identidades</div>
                        <div className="text-lg font-semibold">{openIds.length}</div>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-2 text-center">
                        <div className="text-[10px] uppercase text-muted-foreground">Conversas</div>
                        <div className="text-lg font-semibold">{openConvs.length}</div>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-2 text-center">
                        <div className="text-[10px] uppercase text-muted-foreground">Vendas</div>
                        <div className="text-lg font-semibold">{openVendas.length}</div>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-2 text-center">
                        <div className="text-[10px] uppercase text-muted-foreground">Conversões</div>
                        <div className="text-lg font-semibold">{openConvOff.length}</div>
                      </div>
                    </div>
                  </section>
                  <section>
                    <h3 className="font-semibold mb-2">Canais e identidades</h3>
                    <IdentidadesLista identidades={openIds} />
                  </section>
                  <section>
                    <h3 className="font-semibold mb-2">Origem e tracking</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">utm_source:</span> {openLead.utm_source || "—"}</div>
                      <div><span className="text-muted-foreground">utm_medium:</span> {openLead.utm_medium || "—"}</div>
                      <div><span className="text-muted-foreground">utm_campaign:</span> {openLead.utm_campaign || "—"}</div>
                      <div><span className="text-muted-foreground">utm_content:</span> {openLead.utm_content || "—"}</div>
                      <div><span className="text-muted-foreground">gclid:</span> {openLead.gclid || "—"}</div>
                      <div><span className="text-muted-foreground">fbclid:</span> {openLead.fbclid || "—"}</div>
                      <div><span className="text-muted-foreground">ttclid:</span> {openLead.ttclid || "—"}</div>
                    </div>
                  </section>
                  {openLead.notas && (
                    <section>
                      <h3 className="font-semibold mb-2">Observações</h3>
                      <p className="text-xs whitespace-pre-wrap">{openLead.notas}</p>
                    </section>
                  )}
                  <section>
                    <h3 className="font-semibold mb-2">Conversas ({openConvs.length})</h3>
                    {openConvs.length === 0 ? <p className="text-xs text-muted-foreground">Sem conversa vinculada.</p> : (
                      <ul className="text-xs space-y-1">
                        {openConvs.map((c) => (
                          <li key={c.id} className="flex justify-between items-center border-b py-1">
                            <span>{c.canal?.nome || "—"} • {c.status}</span>
                            <Button size="sm" variant="link" onClick={() => navigate(`/account/atendimento?conversa=${c.id}`)}>Abrir no Atendimento</Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <section>
                    <OportunidadesLead
                      empresaId={openLead.empresa_id}
                      leadId={openLead.id}
                      origem={openLead.origem}
                    />
                  </section>
                  <section>
                    <h3 className="font-semibold mb-2">Vendas ({openVendas.length})</h3>
                    {openVendas.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma venda.</p> : (
                      <ul className="text-xs space-y-1">
                        {openVendas.map((v) => (
                          <li key={v.id} className="flex justify-between border-b py-1">
                            <span>{new Date(v.data_venda).toLocaleDateString()} • {v.status}</span>
                            <span>{brl(Number(v.valor_total))}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-2"><VendaDialog lead={openLead} onSaved={load} /></div>
                  </section>
                  <section>
                    <h3 className="font-semibold mb-2">Conversões ({openConvOff.length})</h3>
                    {openConvOff.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma conversão.</p> : (
                      <ul className="text-xs space-y-1">
                        {openConvOff.map((c) => (
                          <li key={c.id} className="flex justify-between border-b py-1">
                            <span>{c.plataforma || "—"} • {c.nome_conversao || "—"}</span>
                            <span>{brl(Number(c.valor))}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            {editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button onClick={saveEdit}>Salvar</Button>
              </>
            ) : (
              <>
                {openLead && (convByLead[openLead.id] || []).length > 0 && (
                  <Button variant="outline" onClick={() => abrirNoAtendimento(openLead.id)}>Abrir no Atendimento</Button>
                )}
                <Button onClick={startEdit}>Editar</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
