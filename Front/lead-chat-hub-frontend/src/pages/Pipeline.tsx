import { useEffect, useMemo, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, GitBranch, Sparkles, Search, MessageSquare, User, ShoppingCart, Trophy, X, Download } from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { NovaOportunidadeDialog } from "@/components/crm/NovaOportunidadeDialog";

interface Pipeline { id: string; empresa_id: string; nome: string; ativo: boolean }
interface Etapa { id: string; pipeline_id: string; nome: string; ordem: number; cor: string }
interface LeadMin { id: string; nome: string; email: string | null; telefone: string | null }
interface ProdutoMin { id: string; nome: string; valor_padrao: number }
interface UsuarioMin { id: string; nome: string }
interface Oportunidade {
  id: string;
  empresa_id: string;
  lead_id: string;
  pipeline_id: string | null;
  etapa_id: string | null;
  titulo: string;
  produto_id: string | null;
  valor_estimado: number;
  status: string;
  origem: string | null;
  canal_origem: string | null;
  conversa_id: string | null;
  responsavel_id: string | null;
  motivo_perda: string | null;
  ganha_em: string | null;
  perdida_em: string | null;
  ultima_interacao_em: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}
type VendaVinculada = { id: string; valor_total: number; status: string; data_venda: string; lead_id: string; produtos: string };

const DEFAULT_ETAPAS = [
  { nome: "Novo", cor: "#3b82f6" },
  { nome: "Em atendimento", cor: "#f59e0b" },
  { nome: "Orçamento enviado", cor: "#8b5cf6" },
  { nome: "Venda realizada", cor: "#10b981" },
  { nome: "Perdido", cor: "#ef4444" },
];

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  ganha: "Ganha",
  perdida: "Perdida",
  cancelada: "Cancelada",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  aberta: "default",
  ganha: "secondary",
  perdida: "destructive",
  cancelada: "outline",
};

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Pipeline() {
  const { activeConta } = useActiveAccount();
  const isFilha = activeConta?.tipo_conta === "filha";
  const empresaId = isFilha ? activeConta?.id ?? null : null;
  const navigate = useNavigate();

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineId, setPipelineId] = useState<string>("");
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [leadsMap, setLeadsMap] = useState<Record<string, LeadMin>>({});
  const [produtosMap, setProdutosMap] = useState<Record<string, ProdutoMin>>({});
  const [usuariosMap, setUsuariosMap] = useState<Record<string, UsuarioMin>>({});
  const [vendasPorOpp, setVendasPorOpp] = useState<Record<string, VendaVinculada[]>>({});
  const [loading, setLoading] = useState(false);

  // Filters
  const [busca, setBusca] = useState("");
  const [fResp, setFResp] = useState<string>("all");
  const [fProduto, setFProduto] = useState<string>("all");
  const [fOrigem, setFOrigem] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fPeriodo, setFPeriodo] = useState<string>("all");

  // Pipeline/Etapa CRUD dialogs
  const [pOpen, setPOpen] = useState(false);
  const [pEdit, setPEdit] = useState<Pipeline | null>(null);
  const [pForm, setPForm] = useState({ nome: "", ativo: true });
  const [eOpen, setEOpen] = useState(false);
  const [eEdit, setEEdit] = useState<Etapa | null>(null);
  const [eForm, setEForm] = useState({ nome: "", ordem: "0", cor: "#3b82f6" });

  // New oportunidade dialog
  const [oOpen, setOOpen] = useState(false);
  const novoOpForm = () => ({
    lead_id: "", titulo: "", produto_id: "none", valor_estimado: "0",
    pipeline_id: pipelineId, etapa_id: "", origem: "", canal_origem: "",
    conversa_id: "none", responsavel_id: "none", observacoes: "",
  });
  const [oForm, setOForm] = useState(novoOpForm());
  const [conversasLead, setConversasLead] = useState<{ id: string; canal_id: string | null; ultima_mensagem: string | null }[]>([]);

  // Detail dialog
  const [detalhe, setDetalhe] = useState<Oportunidade | null>(null);
  const [perdaOpen, setPerdaOpen] = useState(false);
  const [motivoPerda, setMotivoPerda] = useState("");

  const loadPipelines = useCallback(async () => {
    if (!empresaId) { setPipelines([]); setPipelineId(""); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("pipelines").select("*").eq("empresa_id", empresaId).order("nome");
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const list = (data as any) || [];
    setPipelines(list);
    setPipelineId((prev) => (list.find((p: Pipeline) => p.id === prev) ? prev : list.find((p: Pipeline) => p.ativo)?.id ?? list[0]?.id ?? ""));
  }, [empresaId]);

  const loadEtapas = async (pid: string) => {
    if (!pid) { setEtapas([]); return; }
    const { data, error } = await supabase
      .from("pipeline_etapas").select("*").eq("pipeline_id", pid).order("ordem");
    if (error) { toast.error(error.message); return; }
    setEtapas((data as any) || []);
  };

  const loadOportunidades = async (pid: string) => {
    if (!empresaId || !pid) { setOportunidades([]); return; }
    const { data, error } = await supabase
      .from("oportunidades")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("pipeline_id", pid)
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    const list = (data as any[]) || [];
    setOportunidades(list);

    const leadIds = Array.from(new Set(list.map((o) => o.lead_id))).filter(Boolean);
    const prodIds = Array.from(new Set(list.map((o) => o.produto_id))).filter(Boolean) as string[];
    const userIds = Array.from(new Set(list.map((o) => o.responsavel_id))).filter(Boolean) as string[];

    const [leadsR, prodsR, usersR] = await Promise.all([
      leadIds.length
        ? supabase.from("leads").select("id,nome,email,telefone").in("id", leadIds)
        : Promise.resolve({ data: [] } as any),
      prodIds.length
        ? supabase.from("produtos_servicos").select("id,nome,valor_padrao").in("id", prodIds)
        : Promise.resolve({ data: [] } as any),
      userIds.length
        ? supabase.from("usuarios").select("id,nome").in("id", userIds)
        : Promise.resolve({ data: [] } as any),
    ]);
    const lm: Record<string, LeadMin> = {};
    (leadsR.data as any[] | null || []).forEach((l) => { lm[l.id] = l; });
    setLeadsMap(lm);
    const pm: Record<string, ProdutoMin> = {};
    (prodsR.data as any[] | null || []).forEach((p) => { pm[p.id] = p; });
    setProdutosMap(pm);
    const um: Record<string, UsuarioMin> = {};
    (usersR.data as any[] | null || []).forEach((u) => { um[u.id] = u; });
    setUsuariosMap(um);

    // vendas vinculadas por oportunidade
    const oppIds = list.map((o) => o.id);
    if (oppIds.length) {
      const { data: vendasData } = await supabase
        .from("vendas")
        .select("id, valor_total, status, data_venda, lead_id, oportunidade_id")
        .eq("empresa_id", empresaId)
        .in("oportunidade_id", oppIds);
      const vendasRaw: any[] = (vendasData as any) || [];
      // Fetch itens_venda separately
      let itensPorVenda: Record<string, string> = {};
      if (vendasRaw.length > 0) {
        const vids = vendasRaw.map((v) => v.id);
        const { data: itensData } = await supabase
          .from("itens_venda")
          .select("venda_id, nome_produto")
          .in("venda_id", vids);
        const itensByVenda: Record<string, string[]> = {};
        for (const item of (itensData as any) || []) {
          if (item.nome_produto) (itensByVenda[item.venda_id] ||= []).push(item.nome_produto);
        }
        for (const [vid, nomes] of Object.entries(itensByVenda)) itensPorVenda[vid] = nomes.join(", ");
      }
      const map: Record<string, VendaVinculada[]> = {};
      vendasRaw.forEach((v) => {
        const produtos = itensPorVenda[v.id] || "";
        const item = { id: v.id, valor_total: Number(v.valor_total || 0), status: v.status, data_venda: v.data_venda, lead_id: v.lead_id, produtos };
        if (!map[v.oportunidade_id]) map[v.oportunidade_id] = [];
        map[v.oportunidade_id].push(item);
      });
      setVendasPorOpp(map);
    } else {
      setVendasPorOpp({});
    }
  };

  useEffect(() => { loadPipelines(); }, [loadPipelines]);
  useEffect(() => {
    if (pipelineId) {
      loadEtapas(pipelineId);
      loadOportunidades(pipelineId);
    } else {
      setEtapas([]); setOportunidades([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId, empresaId]);

  // ===== Filter values =====
  const origensDisponiveis = useMemo(
    () => Array.from(new Set(oportunidades.map((o) => o.origem).filter(Boolean) as string[])),
    [oportunidades]
  );

  const oportunidadesFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const now = Date.now();
    const periodMs: Record<string, number> = {
      "7d": 7 * 86400000, "30d": 30 * 86400000, "90d": 90 * 86400000,
    };
    return oportunidades.filter((o) => {
      const lead = leadsMap[o.lead_id];
      if (q && !o.titulo.toLowerCase().includes(q) && !(lead?.nome.toLowerCase().includes(q))) return false;
      if (fResp !== "all" && o.responsavel_id !== fResp) return false;
      if (fProduto !== "all" && o.produto_id !== fProduto) return false;
      if (fOrigem !== "all" && o.origem !== fOrigem) return false;
      if (fStatus !== "all" && o.status !== fStatus) return false;
      if (fPeriodo !== "all" && periodMs[fPeriodo]) {
        if (now - new Date(o.created_at).getTime() > periodMs[fPeriodo]) return false;
      }
      return true;
    });
  }, [oportunidades, leadsMap, busca, fResp, fProduto, fOrigem, fStatus, fPeriodo]);

  const oppsPorEtapa = useMemo(() => {
    const map: Record<string, Oportunidade[]> = {};
    etapas.forEach((e) => { map[e.id] = []; });
    map["__sem_etapa__"] = [];
    oportunidadesFiltradas.forEach((o) => {
      const k = o.etapa_id && map[o.etapa_id] ? o.etapa_id : "__sem_etapa__";
      map[k].push(o);
    });
    return map;
  }, [etapas, oportunidadesFiltradas]);

  // ===== New oportunidade flow =====
  const openNovaOportunidade = () => {
    if (!pipelineId) { toast.error("Selecione um pipeline"); return; }
    if (etapas.length === 0) { toast.error("Configure as etapas antes de criar oportunidades"); return; }
    setOOpen(true);
  };

  const [leadsBusca, setLeadsBusca] = useState<LeadMin[]>([]);
  useEffect(() => {
    if (!oOpen || !empresaId) return;
    supabase.from("leads")
      .select("id,nome,email,telefone")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setLeadsBusca((data as any) || []));
  }, [oOpen, empresaId]);

  const [produtosOpts, setProdutosOpts] = useState<ProdutoMin[]>([]);
  const [usuariosOpts, setUsuariosOpts] = useState<UsuarioMin[]>([]);
  useEffect(() => {
    if (!oOpen || !empresaId) return;
    Promise.all([
      supabase.from("produtos_servicos").select("id,nome,valor_padrao")
        .eq("empresa_id", empresaId).eq("ativo", true).order("nome"),
      supabase.from("usuarios").select("id,nome").eq("empresa_id", empresaId).eq("ativo", true).order("nome"),
    ]).then(([p, u]) => {
      setProdutosOpts((p.data as any) || []);
      setUsuariosOpts((u.data as any) || []);
    });
  }, [oOpen, empresaId]);

  useEffect(() => {
    if (!oForm.lead_id) { setConversasLead([]); return; }
    supabase.from("conversas")
      .select("id,canal_id,ultima_mensagem")
      .eq("lead_id", oForm.lead_id)
      .order("ultima_mensagem_em", { ascending: false })
      .limit(20)
      .then(({ data }) => setConversasLead((data as any) || []));
  }, [oForm.lead_id]);

  const onSelectProdutoNew = (pid: string) => {
    if (pid === "none") { setOForm({ ...oForm, produto_id: "none" }); return; }
    const p = produtosOpts.find((x) => x.id === pid);
    setOForm({
      ...oForm,
      produto_id: pid,
      valor_estimado: p ? String(p.valor_padrao || 0) : oForm.valor_estimado,
      titulo: oForm.titulo || (p?.nome ?? ""),
    });
  };

  const salvarNovaOportunidade = async () => {
    if (!empresaId || !pipelineId) return;
    if (!oForm.lead_id) return toast.error("Selecione o lead/cliente");
    if (!oForm.titulo.trim()) return toast.error("Informe o título");
    if (!oForm.etapa_id) return toast.error("Selecione a etapa inicial");
    const payload = {
      empresa_id: empresaId,
      lead_id: oForm.lead_id,
      pipeline_id: pipelineId,
      etapa_id: oForm.etapa_id,
      titulo: oForm.titulo.trim(),
      produto_id: oForm.produto_id !== "none" ? oForm.produto_id : null,
      valor_estimado: parseFloat(oForm.valor_estimado || "0") || 0,
      origem: oForm.origem.trim() || null,
      canal_origem: oForm.canal_origem.trim() || null,
      conversa_id: oForm.conversa_id !== "none" ? oForm.conversa_id : null,
      responsavel_id: oForm.responsavel_id !== "none" ? oForm.responsavel_id : null,
      observacoes: oForm.observacoes.trim() || null,
      status: "aberta",
    };
    const { error } = await supabase.from("oportunidades").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Oportunidade criada");
    setOOpen(false);
    loadOportunidades(pipelineId);
  };

  // ===== Move opp =====
  const moverOportunidade = async (opp: Oportunidade, novaEtapaId: string) => {
    if (opp.etapa_id === novaEtapaId) return;
    const { error } = await supabase
      .from("oportunidades")
      .update({ etapa_id: novaEtapaId, updated_at: new Date().toISOString() })
      .eq("id", opp.id);
    if (error) return toast.error(error.message);
    setOportunidades((arr) => arr.map((o) => o.id === opp.id ? { ...o, etapa_id: novaEtapaId } : o));
    if (detalhe?.id === opp.id) setDetalhe({ ...detalhe, etapa_id: novaEtapaId });
  };

  // ===== Mark won/lost =====
  const marcarGanha = async (opp: Oportunidade) => {
    // tentar etapa "ganho/venda"
    const etapaGanho = etapas.find((e) => /ganh|venda|fechad/i.test(e.nome));
    const upd: any = { status: "ganha", ganha_em: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (etapaGanho) upd.etapa_id = etapaGanho.id;
    const { error } = await supabase.from("oportunidades").update(upd).eq("id", opp.id);
    if (error) return toast.error(error.message);
    toast.success("Oportunidade marcada como ganha");
    await loadOportunidades(pipelineId);
    setDetalhe(null);
  };

  const confirmarPerda = async () => {
    if (!detalhe) return;
    if (!motivoPerda.trim()) return toast.error("Informe o motivo da perda");
    const etapaPerda = etapas.find((e) => /perd|cancel/i.test(e.nome));
    const upd: any = {
      status: "perdida",
      motivo_perda: motivoPerda.trim(),
      perdida_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (etapaPerda) upd.etapa_id = etapaPerda.id;
    const { error } = await supabase.from("oportunidades").update(upd).eq("id", detalhe.id).select().single();
    if (error) return toast.error(error.message);
    toast.success("Oportunidade marcada como perdida");
    setPerdaOpen(false);
    setMotivoPerda("");
    setDetalhe(null);
    await loadOportunidades(pipelineId);
  };

  // ===== Pipeline/Etapa CRUD =====
  const openNewPipeline = () => { setPEdit(null); setPForm({ nome: "Pipeline comercial", ativo: true }); setPOpen(true); };
  const openEditPipeline = (p: Pipeline) => { setPEdit(p); setPForm({ nome: p.nome, ativo: p.ativo }); setPOpen(true); };
  const savePipeline = async () => {
    if (!empresaId) return;
    const nome = pForm.nome.trim();
    if (!nome) return toast.error("Informe o nome");
    const op = pEdit
      ? supabase.from("pipelines").update({ nome, ativo: pForm.ativo }).eq("id", pEdit.id)
      : supabase.from("pipelines").insert({ empresa_id: empresaId, nome, ativo: pForm.ativo });
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(pEdit ? "Pipeline atualizado" : "Pipeline criado");
    setPOpen(false);
    await loadPipelines();
  };
  const togglePipeline = async (p: Pipeline) => {
    const { error } = await supabase.from("pipelines").update({ ativo: !p.ativo }).eq("id", p.id);
    if (error) return toast.error(error.message);
    loadPipelines();
  };
  const openNewEtapa = () => {
    setEEdit(null);
    setEForm({ nome: "", ordem: String((etapas.at(-1)?.ordem ?? -1) + 1), cor: "#3b82f6" });
    setEOpen(true);
  };
  const openEditEtapa = (e: Etapa) => {
    setEEdit(e); setEForm({ nome: e.nome, ordem: String(e.ordem), cor: e.cor }); setEOpen(true);
  };
  const saveEtapa = async () => {
    if (!pipelineId) return toast.error("Selecione um pipeline");
    const nome = eForm.nome.trim();
    if (!nome) return toast.error("Informe o nome");
    const ordem = parseInt(eForm.ordem || "0", 10);
    if (isNaN(ordem)) return toast.error("Ordem inválida");
    const payload = { pipeline_id: pipelineId, nome, ordem, cor: eForm.cor };
    const op = eEdit
      ? supabase.from("pipeline_etapas").update(payload).eq("id", eEdit.id)
      : supabase.from("pipeline_etapas").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(eEdit ? "Etapa atualizada" : "Etapa criada");
    setEOpen(false);
    loadEtapas(pipelineId);
  };
  const removeEtapa = async (e: Etapa) => {
    if (!confirm(`Excluir etapa "${e.nome}"?`)) return;
    const { error } = await supabase.from("pipeline_etapas").delete().eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success("Etapa removida");
    loadEtapas(pipelineId);
  };
  const moveEtapa = async (e: Etapa, dir: -1 | 1) => {
    const idx = etapas.findIndex((x) => x.id === e.id);
    const swap = etapas[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("pipeline_etapas").update({ ordem: swap.ordem }).eq("id", e.id),
      supabase.from("pipeline_etapas").update({ ordem: e.ordem }).eq("id", swap.id),
    ]);
    loadEtapas(pipelineId);
  };
  const criarEtapasPadrao = async () => {
    if (!empresaId) return;
    let pid = pipelineId;
    if (!pid) {
      const { data, error } = await supabase
        .from("pipelines")
        .insert({ empresa_id: empresaId, nome: "Pipeline comercial", ativo: true });
      if (error) return toast.error(error.message);
      pid = (data as any)?.id;
    }
    const payload = DEFAULT_ETAPAS.map((d, i) => ({ pipeline_id: pid, nome: d.nome, ordem: i, cor: d.cor }));
    const { error: ee } = await supabase.from("pipeline_etapas").insert(payload);
    if (ee) return toast.error(ee.message);
    toast.success("Etapas padrão criadas");
    await loadPipelines();
    setPipelineId(pid!);
    loadEtapas(pid!);
  };

  // ===== Drag & drop =====
  const onDragStart = (e: React.DragEvent, oppId: string) => {
    e.dataTransfer.setData("text/plain", oppId);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onDrop = (e: React.DragEvent, etapaId: string) => {
    e.preventDefault();
    const oppId = e.dataTransfer.getData("text/plain");
    const opp = oportunidades.find((o) => o.id === oppId);
    if (opp) moverOportunidade(opp, etapaId);
  };

  if (!activeConta) return <div className="p-6 text-sm text-muted-foreground">Selecione uma conta para continuar.</div>;
  if (!isFilha) return <div className="p-6 text-sm text-muted-foreground">Este módulo está disponível apenas para Contas Filhas.</div>;

  const pipelineSelecionado = pipelines.find((p) => p.id === pipelineId);
  const detalheLead = detalhe ? leadsMap[detalhe.lead_id] : null;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline comercial</h1>
          <p className="text-sm text-muted-foreground">Quadro de oportunidades da Conta Filha ativa.</p>
        </div>
        {pipelines.length > 0 && (
          <Select value={pipelineId} onValueChange={setPipelineId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Selecione um pipeline" /></SelectTrigger>
            <SelectContent>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome} {!p.ativo && "(inativo)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs defaultValue="quadro">
        <TabsList>
          <TabsTrigger value="quadro">Quadro</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>

        {/* ===================== QUADRO ===================== */}
        <TabsContent value="quadro" className="space-y-3">
          {pipelines.length === 0 ? (
            <div className="rounded-md border p-10 text-center space-y-3">
              <GitBranch className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum pipeline cadastrado para esta conta.</p>
              <div className="flex justify-center gap-2">
                <Button onClick={openNewPipeline}><Plus className="mr-1 h-4 w-4" /> Criar pipeline</Button>
                <Button variant="outline" onClick={criarEtapasPadrao}>
                  <Sparkles className="mr-1 h-4 w-4" /> Criar etapas padrão
                </Button>
              </div>
            </div>
          ) : etapas.length === 0 ? (
            <div className="rounded-md border p-10 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Configure as etapas do pipeline antes de criar oportunidades.</p>
              <Button variant="outline" onClick={criarEtapasPadrao}>
                <Sparkles className="mr-1 h-4 w-4" /> Criar etapas padrão
              </Button>
            </div>
          ) : (
            <>
              {/* Filtros */}
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Buscar por cliente ou título..." value={busca} onChange={(e) => setBusca(e.target.value)} />
                </div>
                <Select value={fStatus} onValueChange={setFStatus}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    <SelectItem value="aberta">Aberta</SelectItem>
                    <SelectItem value="ganha">Ganha</SelectItem>
                    <SelectItem value="perdida">Perdida</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={fResp} onValueChange={setFResp}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Responsável" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos responsáveis</SelectItem>
                    {Object.values(usuariosMap).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={fProduto} onValueChange={setFProduto}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Produto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos produtos</SelectItem>
                    {Object.values(produtosMap).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={fOrigem} onValueChange={setFOrigem}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Origem" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas origens</SelectItem>
                    {origensDisponiveis.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={fPeriodo} onValueChange={setFPeriodo}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Período" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todo período</SelectItem>
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                    <SelectItem value="90d">Últimos 90 dias</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => exportToCsv("pipeline", oportunidadesFiltradas.map((o) => ({
                  titulo: o.titulo,
                  lead: leadsMap[o.lead_id]?.nome ?? "",
                  status: o.status,
                  etapa: etapas.find((e) => e.id === o.etapa_id)?.nome ?? "",
                  valor_estimado: o.valor_estimado,
                  origem: o.origem,
                  canal_origem: o.canal_origem,
                  created_at: o.created_at,
                })))}><Download className="mr-1 h-4 w-4" /> Exportar CSV</Button>
                <Button onClick={openNovaOportunidade}><Plus className="mr-1 h-4 w-4" /> Nova oportunidade</Button>
              </div>

              {/* Kanban */}
              {oportunidadesFiltradas.length === 0 && oportunidades.length === 0 ? (
                <div className="rounded-md border p-10 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">Nenhuma oportunidade neste pipeline.</p>
                  <Button onClick={openNovaOportunidade}><Plus className="mr-1 h-4 w-4" /> Criar primeira oportunidade</Button>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-3">
                  {etapas.map((etapa) => {
                    const opps = oppsPorEtapa[etapa.id] || [];
                    const total = opps.reduce((s, o) => s + Number(o.valor_estimado || 0), 0);
                    return (
                      <div
                        key={etapa.id}
                        className="w-72 shrink-0 rounded-md border bg-muted/30 flex flex-col"
                        onDragOver={onDragOver}
                        onDrop={(e) => onDrop(e, etapa.id)}
                      >
                        <div className="p-3 border-b" style={{ borderTopColor: etapa.cor, borderTopWidth: 3 }}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm" style={{ color: etapa.cor }}>{etapa.nome}</span>
                            <Badge variant="outline" className="text-[10px]">{opps.length}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{fmtBRL(total)}</div>
                        </div>
                        <div className="p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-360px)] overflow-y-auto">
                          {opps.map((opp) => {
                            const lead = leadsMap[opp.lead_id];
                            const prod = opp.produto_id ? produtosMap[opp.produto_id] : null;
                            const resp = opp.responsavel_id ? usuariosMap[opp.responsavel_id] : null;
                            return (
                              <div
                                key={opp.id}
                                draggable
                                onDragStart={(e) => onDragStart(e, opp.id)}
                                onClick={() => setDetalhe(opp)}
                                className="rounded-md border bg-background p-2.5 cursor-pointer hover:border-primary transition-colors space-y-1.5"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-sm font-medium leading-tight">{opp.titulo}</span>
                                  <Badge variant={STATUS_VARIANT[opp.status]} className="text-[10px] shrink-0">
                                    {STATUS_LABEL[opp.status] ?? opp.status}
                                  </Badge>
                                </div>
                                {lead && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <User className="h-3 w-3" /> {lead.nome}
                                  </div>
                                )}
                                {prod && (
                                  <div className="text-xs text-muted-foreground">{prod.nome}</div>
                                )}
                                <div className="flex items-center justify-between pt-0.5">
                                  <span className="text-sm font-mono font-semibold">{fmtBRL(Number(opp.valor_estimado))}</span>
                                  {resp && <span className="text-[10px] text-muted-foreground">{resp.nome}</span>}
                                </div>
                                {(opp.origem || opp.canal_origem || (vendasPorOpp[opp.id]?.length ?? 0) > 0) && (
                                  <div className="flex flex-wrap gap-1">
                                    {opp.origem && <Badge variant="outline" className="text-[9px] px-1">{opp.origem}</Badge>}
                                    {opp.canal_origem && <Badge variant="outline" className="text-[9px] px-1">{opp.canal_origem}</Badge>}
                                    {(vendasPorOpp[opp.id]?.length ?? 0) > 0 && (
                                      <Badge variant="secondary" className="text-[9px] px-1 gap-0.5">
                                        <ShoppingCart className="h-2.5 w-2.5" /> {vendasPorOpp[opp.id].length} venda{vendasPorOpp[opp.id].length > 1 ? "s" : ""}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                                {opp.ultima_interacao_em && (
                                  <div className="text-[10px] text-muted-foreground">
                                    Última: {new Date(opp.ultima_interacao_em).toLocaleDateString("pt-BR")}
                                  </div>
                                )}
                                {/* Mover para etapa (fallback) */}
                                <Select value={opp.etapa_id ?? ""} onValueChange={(v) => moverOportunidade(opp, v)}>
                                  <SelectTrigger
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-7 text-[11px]"
                                  >
                                    <SelectValue placeholder="Mover para..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {etapas.map((et) => (
                                      <SelectItem key={et.id} value={et.id}>{et.nome}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                          {opps.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4">—</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {(oppsPorEtapa["__sem_etapa__"]?.length ?? 0) > 0 && (
                    <div className="w-72 shrink-0 rounded-md border bg-muted/30">
                      <div className="p-3 border-b">
                        <span className="font-medium text-sm">Sem etapa</span>
                      </div>
                      <div className="p-2 space-y-2">
                        {oppsPorEtapa["__sem_etapa__"].map((opp) => (
                          <div key={opp.id} onClick={() => setDetalhe(opp)} className="rounded-md border bg-background p-2 cursor-pointer text-xs">
                            {opp.titulo}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ===================== CONFIGURAÇÃO ===================== */}
        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Pipelines</CardTitle>
                <CardDescription>Pipelines comerciais desta Conta Filha.</CardDescription>
              </div>
              <Button onClick={openNewPipeline}><Plus className="mr-1 h-4 w-4" /> Novo pipeline</Button>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
              ) : pipelines.length === 0 ? (
                <div className="p-10 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">Nenhum pipeline cadastrado.</p>
                  <Button onClick={openNewPipeline}><Plus className="mr-1 h-4 w-4" /> Criar pipeline</Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-32 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pipelines.map((p) => (
                      <TableRow key={p.id} data-state={pipelineId === p.id ? "selected" : undefined}>
                        <TableCell className="font-medium cursor-pointer" onClick={() => setPipelineId(p.id)}>{p.nome}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch checked={p.ativo} onCheckedChange={() => togglePipeline(p)} />
                            <Badge variant={p.ativo ? "default" : "secondary"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => openEditPipeline(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {pipelineId && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Etapas {pipelineSelecionado ? `· ${pipelineSelecionado.nome}` : ""}</CardTitle>
                  <CardDescription>As etapas serão usadas no Quadro de oportunidades.</CardDescription>
                </div>
                <Button onClick={openNewEtapa}><Plus className="mr-1 h-4 w-4" /> Nova etapa</Button>
              </CardHeader>
              <CardContent className="p-0">
                {etapas.length === 0 ? (
                  <div className="p-10 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada.</p>
                    <div className="flex justify-center gap-2">
                      <Button onClick={openNewEtapa}><Plus className="mr-1 h-4 w-4" /> Cadastrar primeira etapa</Button>
                      <Button variant="outline" onClick={criarEtapasPadrao}>
                        <Sparkles className="mr-1 h-4 w-4" /> Criar etapas padrão
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Ordem</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead className="w-32">Cor</TableHead>
                        <TableHead className="w-44 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {etapas.map((e, idx) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-mono text-xs">{e.ordem}</TableCell>
                          <TableCell className="font-medium">{e.nome}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="inline-block h-5 w-5 rounded border" style={{ background: e.cor }} />
                              <span className="text-xs text-muted-foreground">{e.cor}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => moveEtapa(e, -1)}><ArrowUp className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" disabled={idx === etapas.length - 1} onClick={() => moveEtapa(e, 1)}><ArrowDown className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => openEditEtapa(e)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => removeEtapa(e)}><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog Pipeline */}
      <Dialog open={pOpen} onOpenChange={setPOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{pEdit ? "Editar" : "Novo"} pipeline</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={pForm.nome} onChange={(ev) => setPForm({ ...pForm, nome: ev.target.value })} maxLength={120} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label>Ativo</Label>
              <Switch checked={pForm.ativo} onCheckedChange={(v) => setPForm({ ...pForm, ativo: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPOpen(false)}>Cancelar</Button>
            <Button onClick={savePipeline}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Etapa */}
      <Dialog open={eOpen} onOpenChange={setEOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{eEdit ? "Editar" : "Nova"} etapa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={eForm.nome} onChange={(ev) => setEForm({ ...eForm, nome: ev.target.value })} maxLength={120} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ordem</Label>
                <Input type="number" value={eForm.ordem} onChange={(ev) => setEForm({ ...eForm, ordem: ev.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <div className="flex items-center gap-2">
                  <Input type="color" value={eForm.cor} onChange={(ev) => setEForm({ ...eForm, cor: ev.target.value })} className="h-10 w-14 p-1" />
                  <Input value={eForm.cor} onChange={(ev) => setEForm({ ...eForm, cor: ev.target.value })} maxLength={9} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEOpen(false)}>Cancelar</Button>
            <Button onClick={saveEtapa}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Nova Oportunidade (componente reutilizável) */}
      {empresaId && (
        <NovaOportunidadeDialog
          empresaId={empresaId}
          pipelineId={pipelineId}
          open={oOpen}
          onOpenChange={setOOpen}
          onCreated={() => loadOportunidades(pipelineId)}
        />
      )}

      {/* Dialog Detalhe */}
      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-2xl">
          {detalhe && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detalhe.titulo}
                  <Badge variant={STATUS_VARIANT[detalhe.status]}>{STATUS_LABEL[detalhe.status] ?? detalhe.status}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Cliente: </span><strong>{detalheLead?.nome ?? "—"}</strong></div>
                  <div><span className="text-muted-foreground">Valor: </span><strong>{fmtBRL(Number(detalhe.valor_estimado))}</strong></div>
                  <div><span className="text-muted-foreground">Produto: </span>{detalhe.produto_id ? produtosMap[detalhe.produto_id]?.nome ?? "—" : "—"}</div>
                  <div><span className="text-muted-foreground">Responsável: </span>{detalhe.responsavel_id ? usuariosMap[detalhe.responsavel_id]?.nome ?? "—" : "—"}</div>
                  <div><span className="text-muted-foreground">Origem: </span>{detalhe.origem ?? "—"}</div>
                  <div><span className="text-muted-foreground">Canal: </span>{detalhe.canal_origem ?? "—"}</div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Etapa: </span>
                    <Select value={detalhe.etapa_id ?? ""} onValueChange={(v) => moverOportunidade(detalhe, v)}>
                      <SelectTrigger className="inline-flex w-auto h-7 ml-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {etapas.map((et) => <SelectItem key={et.id} value={et.id}>{et.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {detalhe.observacoes && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Observações: </span>{detalhe.observacoes}
                    </div>
                  )}
                  {detalhe.motivo_perda && (
                    <div className="col-span-2 text-destructive">
                      <span className="text-muted-foreground">Motivo da perda: </span>{detalhe.motivo_perda}
                    </div>
                  )}
                </div>

                {/* Vendas vinculadas */}
                <div className="space-y-2 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Vendas vinculadas</span>
                    {(vendasPorOpp[detalhe.id]?.length ?? 0) > 0 && (
                      <Badge variant="secondary" className="text-[10px]">{vendasPorOpp[detalhe.id].length}</Badge>
                    )}
                  </div>
                  {(vendasPorOpp[detalhe.id]?.length ?? 0) === 0 ? (
                    <p className="text-xs text-muted-foreground">Esta oportunidade ainda não possui venda vinculada.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {vendasPorOpp[detalhe.id].map((v) => (
                        <div key={v.id} className="flex items-center justify-between rounded-md border bg-muted/30 p-2 text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold">{fmtBRL(v.valor_total)}</span>
                              <Badge variant="outline" className="text-[9px] px-1">{v.status}</Badge>
                            </div>
                            <div className="text-muted-foreground">
                              {v.produtos || "—"} · {leadsMap[v.lead_id]?.nome ?? "—"} · {new Date(v.data_venda).toLocaleDateString("pt-BR")}
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/account/vendas?venda=${v.id}`)}>Abrir</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {detalhe.conversa_id && (
                    <Button variant="outline" size="sm" onClick={() => navigate("/account/atendimento")}>
                      <MessageSquare className="mr-1 h-4 w-4" /> Abrir no Atendimento
                    </Button>
                  )}
                  {detalheLead && (
                    <Button variant="outline" size="sm" onClick={() => navigate("/account/leads")}>
                      <User className="mr-1 h-4 w-4" /> Ver Lead/Cliente
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => navigate(`/account/vendas?oportunidade=${detalhe.id}`)}>
                    <ShoppingCart className="mr-1 h-4 w-4" /> Registrar venda
                  </Button>
                  {detalhe.status === "aberta" && (
                    <>
                      <Button size="sm" onClick={() => marcarGanha(detalhe)}>
                        <Trophy className="mr-1 h-4 w-4" /> Marcar como ganha
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => { setMotivoPerda(""); setPerdaOpen(true); }}>
                        <X className="mr-1 h-4 w-4" /> Marcar como perdida
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Motivo de perda */}
      <Dialog open={perdaOpen} onOpenChange={setPerdaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar oportunidade como perdida</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Motivo da perda *</Label>
            <Textarea rows={3} value={motivoPerda} onChange={(e) => setMotivoPerda(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPerdaOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarPerda}>Confirmar perda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
