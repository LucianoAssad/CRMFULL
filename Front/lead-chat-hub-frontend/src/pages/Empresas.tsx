import { useEffect, useMemo, useState } from "react";
import {
  Plus, Pencil, Copy, ChevronDown, ChevronRight, LogIn, MoreHorizontal,
  Search, Eye, ExternalLink, Building2, Users, Activity, AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Table, TableHead, TableHeader, TableRow, TableBody, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { formatCodigoPublico } from "@/lib/codigo-publico";
import { getActiveRole } from "@/lib/permissions";

type TipoConta = "gerente" | "filha";

interface Empresa {
  id: string;
  nome: string;
  documento: string | null;
  site: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  tipo_conta: TipoConta;
  conta_gerente_id: string | null;
  codigo_publico: string | null;
  created_at: string;
}

type SaudeStatus = "boa" | "atencao" | "critica" | "sem_dados";

interface ContaMetrics {
  leads: number;
  atendimentos_abertos: number;
  oportunidades_abertas: number;
  vendas: number;
  conversoes_pendentes: number;
  conversoes_erro: number;
  ultima_atividade: string | null;
}

type Periodo = "hoje" | "7d" | "30d" | "mes";

const empty = {
  nome: "", documento: "", site: "", telefone: "", email: "", ativo: true,
  tipo_conta: "filha" as TipoConta,
  conta_gerente_id: "" as string,
};

function periodoSince(p: Periodo): Date {
  const d = new Date();
  if (p === "hoje") { d.setHours(0, 0, 0, 0); return d; }
  if (p === "7d") { d.setDate(d.getDate() - 7); return d; }
  if (p === "30d") { d.setDate(d.getDate() - 30); return d; }
  // este mês
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  const diff = Date.now() - d.getTime();
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Ontem";
  if (dias < 30) return `${dias}d atrás`;
  return d.toLocaleDateString();
}

function calcSaude(m: ContaMetrics, ativo: boolean): SaudeStatus {
  if (!ativo) return "sem_dados";
  const sem = m.leads === 0 && m.atendimentos_abertos === 0 && m.oportunidades_abertas === 0 && m.vendas === 0 && !m.ultima_atividade;
  if (sem) return "sem_dados";
  const dias = m.ultima_atividade ? Math.floor((Date.now() - new Date(m.ultima_atividade).getTime()) / 86400000) : 999;
  if (dias > 30 || m.atendimentos_abertos > 20 || m.conversoes_erro > 0) return "critica";
  if (m.atendimentos_abertos > 0 || m.conversoes_pendentes > 0 || (m.leads === 0 && m.vendas === 0)) return "atencao";
  return "boa";
}

function SaudeBadge({ s }: { s: SaudeStatus }) {
  const map: Record<SaudeStatus, { label: string; cls: string }> = {
    boa: { label: "Boa", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
    atencao: { label: "Atenção", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
    critica: { label: "Crítica", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    sem_dados: { label: "Sem dados", cls: "bg-muted text-muted-foreground" },
  };
  return <Badge variant="outline" className={map[s].cls}>{map[s].label}</Badge>;
}

export default function Empresas() {
  const navigate = useNavigate();
  const { reload: reloadAccounts, setActiveContaId, scopedContaIds, activeConta } = useActiveAccount();

  const [items, setItems] = useState<Empresa[]>([]);
  const [metrics, setMetrics] = useState<Record<string, ContaMetrics>>({});
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todas" | "gerente" | "filha">("todas");
  const [filtroStatus, setFiltroStatus] = useState<"todas" | "ativas" | "inativas">("todas");
  const [filtroSaude, setFiltroSaude] = useState<"todas" | SaudeStatus>("todas");
  const [filtroPai, setFiltroPai] = useState<string>("todas");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [loading, setLoading] = useState(false);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<Empresa | null>(null);

  const canManage = ["super_admin", "admin_gerente", "admin_filha"].includes(getActiveRole());

  const load = async () => {
    if (scopedContaIds.length === 0) { setItems([]); return; }
    const { data, error } = await supabase
      .from("empresas")
      .select("*")
      .in("id", scopedContaIds)
      .order("nome");
    if (error) { toast.error(error.message); return; }
    setItems((data as any) || []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeConta?.id, scopedContaIds.join(",")]);

  // Métricas no período
  useEffect(() => {
    if (scopedContaIds.length === 0) { setMetrics({}); return; }
    let cancel = false;
    (async () => {
      const since = periodoSince(periodo).toISOString();
      const ids = scopedContaIds;

      const [leadsR, convR, oppR, vendasR, cnvR, leadsAllR] = await Promise.all([
        supabase.from("leads").select("empresa_id, created_at").in("empresa_id", ids).gte("created_at", since),
        supabase.from("conversas").select("empresa_id, updated_at, status").in("empresa_id", ids).eq("status", "aberta"),
        supabase.from("oportunidades").select("empresa_id, status").in("empresa_id", ids).eq("status", "aberta"),
        supabase.from("vendas").select("empresa_id, data_venda").in("empresa_id", ids).gte("data_venda", since),
        supabase.from("conversoes_offline").select("empresa_id, status_envio, created_at").in("empresa_id", ids),
        supabase.from("leads").select("empresa_id, created_at").in("empresa_id", ids).order("created_at", { ascending: false }).limit(1000),
      ]);

      if (cancel) return;
      const m: Record<string, ContaMetrics> = {};
      const init = (id: string) => (m[id] ||= {
        leads: 0, atendimentos_abertos: 0, oportunidades_abertas: 0,
        vendas: 0, conversoes_pendentes: 0, conversoes_erro: 0, ultima_atividade: null,
      });
      ids.forEach(init);

      (leadsR.data || []).forEach((r: any) => {
        const x = init(r.empresa_id); x.leads++;
        if (!x.ultima_atividade || r.created_at > x.ultima_atividade) x.ultima_atividade = r.created_at;
      });
      (convR.data || []).forEach((r: any) => {
        const x = init(r.empresa_id); x.atendimentos_abertos++;
        if (r.updated_at && (!x.ultima_atividade || r.updated_at > x.ultima_atividade)) x.ultima_atividade = r.updated_at;
      });
      (oppR.data || []).forEach((r: any) => init(r.empresa_id).oportunidades_abertas++);
      (vendasR.data || []).forEach((r: any) => {
        const x = init(r.empresa_id); x.vendas++;
        if (r.data_venda && (!x.ultima_atividade || r.data_venda > x.ultima_atividade)) x.ultima_atividade = r.data_venda;
      });
      (cnvR.data || []).forEach((r: any) => {
        const x = init(r.empresa_id);
        if (r.status_envio === "pendente") x.conversoes_pendentes++;
        if (r.status_envio === "erro") x.conversoes_erro++;
      });
      (leadsAllR.data || []).forEach((r: any) => {
        const x = init(r.empresa_id);
        if (!x.ultima_atividade || r.created_at > x.ultima_atividade) x.ultima_atividade = r.created_at;
      });

      setMetrics(m);
    })();
    return () => { cancel = true; };
  }, [scopedContaIds.join(","), periodo]);

  const byId = useMemo(() => {
    const m: Record<string, Empresa> = {};
    items.forEach((e) => { m[e.id] = e; });
    return m;
  }, [items]);

  const childrenOf = useMemo(() => {
    const map: Record<string, Empresa[]> = {};
    for (const e of items) {
      if (e.conta_gerente_id) (map[e.conta_gerente_id] ||= []).push(e);
    }
    Object.values(map).forEach((arr) => arr.sort((a, b) => {
      if (a.tipo_conta !== b.tipo_conta) return a.tipo_conta === "gerente" ? -1 : 1;
      return a.nome.localeCompare(b.nome);
    }));
    return map;
  }, [items]);

  const raizes = useMemo(() => {
    const arr = items.filter((i) => !i.conta_gerente_id || !byId[i.conta_gerente_id]);
    return arr.sort((a, b) => {
      if (a.tipo_conta !== b.tipo_conta) return a.tipo_conta === "gerente" ? -1 : 1;
      return a.nome.localeCompare(b.nome);
    });
  }, [items, byId]);

  const isDescendant = (rootId: string, candidateId: string): boolean => {
    if (rootId === candidateId) return true;
    const stack = [...(childrenOf[rootId] || [])];
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur.id === candidateId) return true;
      stack.push(...(childrenOf[cur.id] || []));
    }
    return false;
  };

  const gerentes = useMemo(() => items.filter((i) => i.tipo_conta === "gerente"), [items]);
  const gerentesElegiveisComoPai = useMemo(() => {
    return gerentes.filter((g) => {
      if (!editing) return true;
      if (g.id === editing.id) return false;
      if (isDescendant(editing.id, g.id)) return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gerentes, editing, childrenOf]);

  // Filtragem para tabela Resumo
  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return items.filter((e) => {
      if (filtroTipo !== "todas" && e.tipo_conta !== filtroTipo) return false;
      if (filtroStatus === "ativas" && !e.ativo) return false;
      if (filtroStatus === "inativas" && e.ativo) return false;
      if (filtroPai !== "todas" && e.conta_gerente_id !== filtroPai) return false;
      if (q) {
        const code = (e.codigo_publico || "").toLowerCase();
        if (!e.nome.toLowerCase().includes(q) && !code.includes(q)) return false;
      }
      if (filtroSaude !== "todas") {
        const m = metrics[e.id];
        if (!m) return filtroSaude === "sem_dados";
        if (calcSaude(m, e.ativo) !== filtroSaude) return false;
      }
      return true;
    });
  }, [items, busca, filtroTipo, filtroStatus, filtroSaude, filtroPai, metrics]);

  // KPIs
  const kpis = useMemo(() => {
    const totalLeads = Object.values(metrics).reduce((s, m) => s + m.leads, 0);
    const totalVendas = Object.values(metrics).reduce((s, m) => s + m.vendas, 0);
    const totalConvPend = Object.values(metrics).reduce((s, m) => s + m.conversoes_pendentes, 0);
    const semAtividade = items.filter((e) => {
      const m = metrics[e.id];
      return e.ativo && (!m || calcSaude(m, e.ativo) === "sem_dados");
    }).length;
    return {
      totalContas: items.length,
      gerentes: items.filter((i) => i.tipo_conta === "gerente").length,
      filhas: items.filter((i) => i.tipo_conta === "filha").length,
      semAtividade,
      leads: totalLeads,
      vendas: totalVendas,
      convPendentes: totalConvPend,
    };
  }, [items, metrics]);

  const openNew = (preset?: Partial<typeof empty>) => {
    setEditing(null);
    setForm({ ...empty, ...preset });
    setOpen(true);
  };
  const openEdit = (e: Empresa) => {
    setEditing(e);
    setForm({
      nome: e.nome,
      documento: e.documento ?? "",
      site: e.site ?? "",
      telefone: e.telefone ?? "",
      email: e.email ?? "",
      ativo: e.ativo,
      tipo_conta: e.tipo_conta ?? "filha",
      conta_gerente_id: e.conta_gerente_id ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    const nome = form.nome.trim();
    if (!nome) { toast.error("Informe o nome"); return; }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) { toast.error("E-mail inválido"); return; }

    let gerenteId: string | null = form.conta_gerente_id || null;
    if (form.tipo_conta === "filha" && !gerenteId) {
      toast.error("Selecione a conta gerente"); return;
    }
    if (editing && gerenteId) {
      if (gerenteId === editing.id) { toast.error("Uma conta não pode ser vinculada a si mesma"); return; }
      if (isDescendant(editing.id, gerenteId)) { toast.error("Hierarquia circular não permitida"); return; }
    }

    setLoading(true);
    const payload: any = {
      nome,
      documento: form.documento.trim() || null,
      site: form.site.trim() || null,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      ativo: form.ativo,
      tipo_conta: editing ? editing.tipo_conta : form.tipo_conta,
      conta_gerente_id: gerenteId,
    };
    const op = editing
      ? supabase.from("empresas").update(payload).eq("id", editing.id)
      : supabase.from("empresas").insert(payload);
    const { error } = await op;
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Conta atualizada" : "Conta criada");
    setOpen(false);
    load(); reloadAccounts();
  };

  const toggleAtivo = async (e: Empresa) => {
    const { error } = await supabase.from("empresas").update({ ativo: !e.ativo }).eq("id", e.id);
    if (error) { toast.error(error.message); return; }
    toast.success(e.ativo ? "Conta desativada" : "Conta reativada");
    load(); reloadAccounts();
    setConfirmToggle(null);
  };

  const acessarConta = (e: Empresa, destino?: { manager: string; account: string }) => {
    setActiveContaId(e.id);
    const modo = e.tipo_conta === "gerente" ? "manager" : "account";
    try { localStorage.setItem("modo_sistema", modo); } catch {}
    toast.success(`Acessando ${e.nome}`);
    const rota = destino
      ? (modo === "manager" ? destino.manager : destino.account)
      : (modo === "manager" ? "/manager/dashboard" : "/account/dashboard");
    navigate(rota, { replace: true });
  };

  const acessarSeguranca = (e: Empresa) =>
    acessarConta(e, { manager: "/manager/usuarios", account: "/account/usuarios" });
  const acessarConversoes = (e: Empresa) =>
    acessarConta(e, { manager: "/manager/conversoes", account: "/account/conversoes" });
  const acessarDashboard = (e: Empresa) =>
    acessarConta(e, { manager: "/manager/dashboard", account: "/account/dashboard" });
  const acessarContaFilha = (e: Empresa, rotaAccount: string) => {
    if (e.tipo_conta !== "filha") return;
    setActiveContaId(e.id);
    try { localStorage.setItem("modo_sistema", "account"); } catch {}
    toast.success(`Acessando ${e.nome}`);
    navigate(rotaAccount, { replace: true });
  };

  const copyCode = async (code: string | null) => {
    if (!code) return;
    const f = formatCodigoPublico(code);
    await navigator.clipboard.writeText(f);
    toast.success("Código copiado: " + f);
  };

  const toggleCollapse = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const exportCsv = () => {
    const header = ["Conta", "Codigo", "Tipo", "Superior", "Status", "Saude", "Leads", "Atendimentos", "Oportunidades", "Vendas", "Conversoes pendentes", "Ultima atividade"];
    const rows = filtered.map((e) => {
      const m = metrics[e.id];
      const s = m ? calcSaude(m, e.ativo) : "sem_dados";
      const sup = e.conta_gerente_id ? byId[e.conta_gerente_id]?.nome ?? "" : "";
      return [
        e.nome, formatCodigoPublico(e.codigo_publico) || "",
        e.tipo_conta, sup, e.ativo ? "Ativa" : "Inativa", s,
        m?.leads ?? 0, m?.atendimentos_abertos ?? 0, m?.oportunidades_abertas ?? 0,
        m?.vendas ?? 0, m?.conversoes_pendentes ?? 0, m?.ultima_atividade ?? "",
      ];
    });
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `contas-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const detailConta = detailId ? byId[detailId] : null;
  const detailMetrics = detailId ? metrics[detailId] : undefined;

  // Menu ações por linha
  const RowActions = ({ e }: { e: Empresa }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Mais ações">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover">
        <DropdownMenuItem onClick={() => setDetailId(e.id)}>
          <Eye className="mr-2 h-4 w-4" /> Ver detalhes
        </DropdownMenuItem>
        {canManage && (
          <DropdownMenuItem onClick={() => openEdit(e)}>
            <Pencil className="mr-2 h-4 w-4" /> Editar dados básicos
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => copyCode(e.codigo_publico)}>
          <Copy className="mr-2 h-4 w-4" /> Copiar código público
        </DropdownMenuItem>
        {canManage && e.tipo_conta === "gerente" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openNew({ tipo_conta: "gerente", conta_gerente_id: e.id })}>
              <Plus className="mr-2 h-4 w-4" /> Criar Conta Gerente abaixo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openNew({ tipo_conta: "filha", conta_gerente_id: e.id })}>
              <Plus className="mr-2 h-4 w-4" /> Criar Conta Filha abaixo
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        {canManage && (
          <DropdownMenuItem onClick={() => setConfirmToggle(e)}>
            {e.ativo ? "Desativar" : "Reativar"}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => acessarSeguranca(e)}>
          <ExternalLink className="mr-2 h-4 w-4" /> Acesso e segurança
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Linha hierarquia
  const HierRow = ({ e, level = 0 }: { e: Empresa; level?: number }) => {
    const filhos = childrenOf[e.id] || [];
    const isCollapsed = collapsed[e.id];
    const m = metrics[e.id];
    const saude = m ? calcSaude(m, e.ativo) : "sem_dados";
    return (
      <div>
        <div
          className="flex items-center gap-2 rounded-md border bg-card p-3 hover:bg-accent/40 transition-colors"
          style={{ marginLeft: level * 20 }}
        >
          {filhos.length > 0 ? (
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => toggleCollapse(e.id)}>
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          ) : <span className="w-6" />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium">{e.nome}</span>
              <Badge variant={e.tipo_conta === "gerente" ? "default" : "outline"}>
                {e.tipo_conta === "gerente" ? "Gerente" : "Filha"}
              </Badge>
              <Badge variant={e.ativo ? "secondary" : "outline"}>{e.ativo ? "Ativa" : "Inativa"}</Badge>
              <SaudeBadge s={saude} />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="font-mono">{formatCodigoPublico(e.codigo_publico)}</span>
              {m && (
                <>
                  <span>Leads: {m.leads}</span>
                  <span>Vendas: {m.vendas}</span>
                  {m.conversoes_pendentes > 0 && <span>Conv. pend.: {m.conversoes_pendentes}</span>}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => acessarConta(e)}>
              <LogIn className="mr-1 h-3.5 w-3.5" /> Acessar
            </Button>
            <RowActions e={e} />
          </div>
        </div>
        {!isCollapsed && filhos.length > 0 && (
          <div className="mt-2 space-y-2">
            {filhos.map((c) => <HierRow key={c.id} e={c} level={level + 1} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contas</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe as contas da sua hierarquia, veja indicadores operacionais e acesse rapidamente cada unidade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv}>Exportar</Button>
          {canManage && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openNew()}><Plus className="mr-1 h-4 w-4" /> Nova conta</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "Editar conta" : "Nova conta"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Nome *</Label>
                    <Input value={form.nome} onChange={(ev) => setForm({ ...form, nome: ev.target.value })} maxLength={150} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Tipo de conta *</Label>
                      {editing ? (
                        <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm">
                          <Badge variant="secondary">
                            {form.tipo_conta === "gerente" ? "Conta Gerente" : "Conta Filha"}
                          </Badge>
                        </div>
                      ) : (
                        <Select
                          value={form.tipo_conta}
                          onValueChange={(v) => setForm({ ...form, tipo_conta: v as TipoConta })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gerente">Gerente</SelectItem>
                            <SelectItem value="filha">Filha</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>{form.tipo_conta === "filha" ? "Conta gerente *" : "Vincular a uma gerente (opcional)"}</Label>
                      <Select value={form.conta_gerente_id} onValueChange={(v) => setForm({ ...form, conta_gerente_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {gerentesElegiveisComoPai.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma gerente disponível</div>}
                          {gerentesElegiveisComoPai.map((g) => (
                            <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Documento</Label>
                      <Input value={form.documento} onChange={(ev) => setForm({ ...form, documento: ev.target.value })} maxLength={30} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Telefone</Label>
                      <Input value={form.telefone} onChange={(ev) => setForm({ ...form, telefone: ev.target.value })} maxLength={30} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input type="email" value={form.email} onChange={(ev) => setForm({ ...form, email: ev.target.value })} maxLength={150} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Site</Label>
                    <Input value={form.site} onChange={(ev) => setForm({ ...form, site: ev.target.value })} maxLength={200} placeholder="https://..." />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <Label htmlFor="ativo">Ativa</Label>
                    <Switch id="ativo" checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={save} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filtro de período */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Período:</span>
        {([
          ["hoje", "Hoje"],
          ["7d", "7 dias"],
          ["30d", "30 dias"],
          ["mes", "Este mês"],
        ] as [Periodo, string][]).map(([v, label]) => (
          <Button
            key={v}
            size="sm"
            variant={periodo === v ? "default" : "outline"}
            onClick={() => setPeriodo(v)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Kpi icon={Building2} label="Total" value={kpis.totalContas} />
        <Kpi icon={Users} label="Gerentes" value={kpis.gerentes} />
        <Kpi icon={Building2} label="Filhas" value={kpis.filhas} />
        <Kpi icon={AlertTriangle} label="Sem atividade" value={kpis.semAtividade} />
        <Kpi icon={Activity} label="Leads" value={kpis.leads} />
        <Kpi icon={Activity} label="Vendas" value={kpis.vendas} />
        <Kpi icon={AlertTriangle} label="Conv. pendentes" value={kpis.convPendentes} />
      </div>

      {/* Filtros */}
      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto_auto]">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-1p-ignore="true"
            data-lpignore="true"
            name="busca-contas"
          />
        </div>
        <Select value={filtroTipo} onValueChange={(v: any) => setFiltroTipo(v)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os tipos</SelectItem>
            <SelectItem value="gerente">Gerentes</SelectItem>
            <SelectItem value="filha">Filhas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={(v: any) => setFiltroStatus(v)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos status</SelectItem>
            <SelectItem value="ativas">Ativas</SelectItem>
            <SelectItem value="inativas">Inativas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroSaude} onValueChange={(v: any) => setFiltroSaude(v)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Toda saúde</SelectItem>
            <SelectItem value="boa">Boa</SelectItem>
            <SelectItem value="atencao">Atenção</SelectItem>
            <SelectItem value="critica">Crítica</SelectItem>
            <SelectItem value="sem_dados">Sem dados</SelectItem>
          </SelectContent>
        </Select>
        {gerentes.length > 1 && (
          <Select value={filtroPai} onValueChange={(v: any) => setFiltroPai(v)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Superior" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Toda superior</SelectItem>
              {gerentes.map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Abas */}
      <Tabs defaultValue="resumo">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="hierarquia">Hierarquia</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="mt-4">
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead className="hidden md:table-cell">Superior</TableHead>
                  <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Saúde</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Leads</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Atend. abertos</TableHead>
                  <TableHead className="hidden xl:table-cell text-right">Op. abertas</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Vendas</TableHead>
                  <TableHead className="hidden xl:table-cell text-right">Conv. pend.</TableHead>
                  <TableHead className="hidden md:table-cell">Última atividade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-sm text-muted-foreground py-8">
                      Nenhuma conta encontrada.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((e) => {
                  const m = metrics[e.id];
                  const s = m ? calcSaude(m, e.ativo) : "sem_dados";
                  const sup = e.conta_gerente_id ? byId[e.conta_gerente_id]?.nome : "—";
                  return (
                    <TableRow key={e.id}>
                      <TableCell>
                        <button
                          className="text-left hover:underline"
                          onClick={() => setDetailId(e.id)}
                        >
                          <div className="font-medium">{e.nome}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {formatCodigoPublico(e.codigo_publico)}
                          </div>
                        </button>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{sup}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={e.tipo_conta === "gerente" ? "default" : "outline"}>
                          {e.tipo_conta === "gerente" ? "Gerente" : "Filha"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.ativo ? "secondary" : "outline"}>{e.ativo ? "Ativa" : "Inativa"}</Badge>
                      </TableCell>
                      <TableCell><SaudeBadge s={s} /></TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums">{m?.leads ?? 0}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums">{m?.atendimentos_abertos ?? 0}</TableCell>
                      <TableCell className="hidden xl:table-cell text-right tabular-nums">{m?.oportunidades_abertas ?? 0}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums">{m?.vendas ?? 0}</TableCell>
                      <TableCell className="hidden xl:table-cell text-right tabular-nums">{m?.conversoes_pendentes ?? 0}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{fmtDate(m?.ultima_atividade ?? null)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => acessarConta(e)}>
                            <LogIn className="mr-1 h-3.5 w-3.5" /> Acessar
                          </Button>
                          <RowActions e={e} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="hierarquia" className="mt-4">
          {raizes.length === 0 ? (
            <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
              Nenhuma conta nesta hierarquia.
            </div>
          ) : (
            <div className="space-y-2">
              {raizes.map((g) => <HierRow key={g.id} e={g} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirmar desativar/reativar */}
      <Dialog open={!!confirmToggle} onOpenChange={(o) => !o && setConfirmToggle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmToggle?.ativo ? "Desativar conta?" : "Reativar conta?"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmToggle?.ativo
              ? `A conta "${confirmToggle?.nome}" deixará de aparecer para os usuários.`
              : `A conta "${confirmToggle?.nome}" voltará a aparecer para os usuários.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmToggle(null)}>Cancelar</Button>
            <Button onClick={() => confirmToggle && toggleAtivo(confirmToggle)}>
              {confirmToggle?.ativo ? "Desativar" : "Reativar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drawer de detalhes */}
      <Sheet open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {detailConta && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {detailConta.nome}
                  <Badge variant={detailConta.tipo_conta === "gerente" ? "default" : "outline"}>
                    {detailConta.tipo_conta === "gerente" ? "Gerente" : "Filha"}
                  </Badge>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Código: <span className="font-mono">{formatCodigoPublico(detailConta.codigo_publico)}</span></div>
                  <div>Superior: {detailConta.conta_gerente_id ? byId[detailConta.conta_gerente_id]?.nome ?? "—" : "—"}</div>
                  <div>Status: {detailConta.ativo ? "Ativa" : "Inativa"}</div>
                  <div>Saúde: {detailMetrics ? calcSaude(detailMetrics, detailConta.ativo) : "sem dados"}</div>
                  <div>Última atividade: {fmtDate(detailMetrics?.ultima_atividade ?? null)}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Mini label="Leads" value={detailMetrics?.leads ?? 0} />
                  <Mini label="Atend. abertos" value={detailMetrics?.atendimentos_abertos ?? 0} />
                  <Mini label="Op. abertas" value={detailMetrics?.oportunidades_abertas ?? 0} />
                  <Mini label="Vendas" value={detailMetrics?.vendas ?? 0} />
                  <Mini label="Conv. pendentes" value={detailMetrics?.conversoes_pendentes ?? 0} />
                </div>

                <div className="space-y-2">
                  <Button className="w-full" onClick={() => acessarConta(detailConta)}>
                    <LogIn className="mr-2 h-4 w-4" /> Acessar conta
                  </Button>
                  {detailConta.tipo_conta === "filha" && (
                    <>
                      <Button variant="outline" className="w-full" onClick={() => acessarContaFilha(detailConta, "/account/atendimento")}>
                        Atendimento
                      </Button>
                      <Button variant="outline" className="w-full" onClick={() => acessarContaFilha(detailConta, "/account/leads")}>
                        Leads / Clientes
                      </Button>
                      <Button variant="outline" className="w-full" onClick={() => acessarContaFilha(detailConta, "/account/pipeline")}>
                        Pipeline
                      </Button>
                      <Button variant="outline" className="w-full" onClick={() => acessarContaFilha(detailConta, "/account/vendas")}>
                        Vendas
                      </Button>
                    </>
                  )}
                  <Button variant="outline" className="w-full" onClick={() => acessarConversoes(detailConta)}>
                    Conversões
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => acessarSeguranca(detailConta)}>
                    Acesso e segurança
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
