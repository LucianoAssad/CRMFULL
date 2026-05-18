import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Download, Plus, Target, DollarSign, Clock, CheckCircle2, AlertTriangle,
  RefreshCw, Eye, FileSpreadsheet, FileText, Settings2, Send, Layers,
} from "lucide-react";
import { toast } from "sonner";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { format } from "date-fns";
import {
  validateConversionDestination,
  buildPayloadPreview,
  getAvailableMethods,
  getEventTypes,
  getConversionPlatformLabel,
  getSendMethodLabel,
  getDestinationStatusLabel,
  getEventTypeLabel,
  type ConversionPlatform,
  type SendMethod,
  type ConfiguracaoConversaoCore,
  type IdentidadeCore,
  type ConversaoCore,
  type LeadCore,
} from "@/lib/conversion-platform-rules";

// =============================================================================
// Tipos locais
// =============================================================================

interface Conversao {
  id: string;
  empresa_id: string;
  lead_id: string;
  conversa_id: string | null;
  plataforma: string | null;
  nome_conversao: string | null;
  descricao: string | null;
  valor: number;
  data_conversao: string | null;
  convertido_em: string;
  gclid: string | null;
  fbclid: string | null;
  ttclid: string | null;
  email: string | null;
  telefone: string | null;
  status_envio: string;
  lead?: { nome: string; email: string | null; telefone: string | null; utm_campaign: string | null; origem: string | null } | null;
}

interface Destino {
  id: string;
  empresa_id: string;
  conversao_id: string;
  plataforma: string;
  metodo_envio: string;
  tipo_evento_plataforma: string | null;
  status_envio: string;
  identificadores: Record<string, any>;
  payload_preview: Record<string, any>;
  erro: string | null;
  exportacao_id: string | null;
  enviado_em: string | null;
  created_at: string;
  updated_at: string;
}

interface Exportacao {
  id: string;
  empresa_id: string;
  plataforma: string;
  metodo_envio: string;
  status: string;
  arquivo_url: string | null;
  google_sheet_url: string | null;
  total_registros: number;
  total_sucesso: number;
  total_erro: number;
  filtros: Record<string, any>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface Configuracao {
  id: string;
  empresa_id: string;
  plataforma: string;
  metodo_padrao: string;
  google_customer_id: string | null;
  google_conversion_action_id: string | null;
  meta_pixel_id: string | null;
  meta_dataset_id: string | null;
  tiktok_advertiser_id: string | null;
  tiktok_event_source_id: string | null;
  token_status: string;
  ativo: boolean;
  configuracoes: Record<string, any>;
}

interface LeadOpt {
  id: string; nome: string;
  gclid: string | null; fbclid: string | null; ttclid: string | null;
  email: string | null; telefone: string | null;
  utm_campaign: string | null; origem: string | null;
}
interface VendaOpt { id: string; lead_id: string; valor_total: number; data_venda: string }
interface IdentidadeRow { id: string; lead_id: string; tipo: string; valor: string; canal: string | null }

const PLATAFORMAS: ConversionPlatform[] = ["google_ads", "meta_ads", "tiktok_ads"];

// =============================================================================
// Utils
// =============================================================================

const csvEscape = (v: any) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const downloadCsv = (filename: string, rows: string[][]) => {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
const brl = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_DESTINO_META: Record<string, string> = {
  pendente: "bg-warning/15 text-warning border-warning/30",
  pronto_para_exportar: "bg-info/15 text-info border-info/30",
  exportado_csv: "bg-info/15 text-info border-info/30",
  sincronizado_google_sheets: "bg-info/15 text-info border-info/30",
  enviado_api: "bg-success/15 text-success border-success/30",
  erro: "bg-destructive/15 text-destructive border-destructive/30",
  nao_aplicavel: "bg-muted text-muted-foreground border-border",
};

const STATUS_EXPORT_META: Record<string, string> = {
  pendente: "bg-warning/15 text-warning border-warning/30",
  processando: "bg-info/15 text-info border-info/30",
  concluido: "bg-success/15 text-success border-success/30",
  erro: "bg-destructive/15 text-destructive border-destructive/30",
};

const TOKEN_STATUS_META: Record<string, { label: string; cls: string }> = {
  nao_configurado: { label: "Não configurado", cls: "bg-muted text-muted-foreground border-border" },
  configurado: { label: "Configurado", cls: "bg-success/15 text-success border-success/30" },
  erro: { label: "Erro", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  expirado: { label: "Expirado", cls: "bg-warning/15 text-warning border-warning/30" },
};

// =============================================================================
// Componente principal
// =============================================================================

export default function Conversoes() {
  const { activeContaId, activeConta } = useActiveAccount();
  const [tab, setTab] = useState("eventos");
  const [loading, setLoading] = useState(false);

  const [conversoes, setConversoes] = useState<Conversao[]>([]);
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [exportacoes, setExportacoes] = useState<Exportacao[]>([]);
  const [configs, setConfigs] = useState<Configuracao[]>([]);
  const [leads, setLeads] = useState<LeadOpt[]>([]);
  const [vendas, setVendas] = useState<VendaOpt[]>([]);
  const [identidades, setIdentidades] = useState<IdentidadeRow[]>([]);

  const reload = useCallback(async () => {
    if (!activeContaId) {
      setConversoes([]); setDestinos([]); setExportacoes([]); setConfigs([]);
      setLeads([]); setVendas([]); setIdentidades([]);
      return;
    }
    setLoading(true);
    const [c, d, e, cf, l, v, ids] = await Promise.all([
      supabase.from("conversoes_offline")
        .select("*")
        .eq("empresa_id", activeContaId).order("convertido_em", { ascending: false }),
      supabase.from("conversao_destinos").select("*")
        .eq("empresa_id", activeContaId).order("updated_at", { ascending: false }),
      supabase.from("exportacoes_conversoes").select("*")
        .eq("empresa_id", activeContaId).order("created_at", { ascending: false }),
      supabase.from("configuracoes_conversao").select("*")
        .eq("empresa_id", activeContaId),
      supabase.from("leads")
        .select("id,nome,gclid,fbclid,ttclid,email,telefone,utm_campaign,origem")
        .eq("empresa_id", activeContaId).order("nome"),
      supabase.from("vendas").select("id,lead_id,valor_total,data_venda")
        .eq("empresa_id", activeContaId).order("data_venda", { ascending: false }),
      supabase.from("lead_identidades").select("id,lead_id,tipo,valor,canal")
        .eq("empresa_id", activeContaId),
    ]);

    // Backend does not support nested selects — enrich conversoes with lead data from the separate leads fetch
    const leadsData: LeadOpt[] = (l.data as any) || [];
    const leadMapLocal: Record<string, LeadOpt> = {};
    for (const lead of leadsData) leadMapLocal[lead.id] = lead;

    const conversoesBrutes: any[] = (c.data as any) || [];
    const conversoesFinal: Conversao[] = conversoesBrutes.map((conv) => ({
      ...conv,
      lead: leadMapLocal[conv.lead_id]
        ? {
            nome: leadMapLocal[conv.lead_id].nome,
            email: leadMapLocal[conv.lead_id].email,
            telefone: leadMapLocal[conv.lead_id].telefone,
            utm_campaign: leadMapLocal[conv.lead_id].utm_campaign,
            origem: leadMapLocal[conv.lead_id].origem,
          }
        : null,
    }));

    setConversoes(conversoesFinal);
    setDestinos((d.data as any) || []);
    setExportacoes((e.data as any) || []);
    setConfigs((cf.data as any) || []);
    setLeads(leadsData);
    setVendas((v.data as any) || []);
    setIdentidades((ids.data as any) || []);
    setLoading(false);
  }, [activeContaId]);

  useEffect(() => { reload(); }, [reload]);

  // --- KPIs --------------------------------------------------------------
  const kpis = useMemo(() => {
    const eventos = conversoes.length;
    const valor = conversoes.reduce((s, i) => s + (Number(i.valor) || 0), 0);
    const pend = destinos.filter((d) => d.status_envio === "pendente").length;
    const prontos = destinos.filter((d) => d.status_envio === "pronto_para_exportar").length;
    const exp = destinos.filter((d) => d.status_envio === "exportado_csv").length;
    const erros = destinos.filter((d) => d.status_envio === "erro").length;
    return { eventos, valor, pend, prontos, exp, erros };
  }, [conversoes, destinos]);

  // --- Helpers compartilhados -------------------------------------------
  const idsByLead = useMemo(() => {
    const m: Record<string, IdentidadeCore[]> = {};
    for (const i of identidades) {
      (m[i.lead_id] ||= []).push({ tipo: i.tipo, valor: i.valor, canal: i.canal });
    }
    return m;
  }, [identidades]);

  const cfgByPlat = useMemo(() => {
    const m: Record<string, Configuracao> = {};
    for (const c of configs) m[c.plataforma] = c;
    return m;
  }, [configs]);

  const leadById = useMemo(() => {
    const m: Record<string, LeadOpt> = {};
    for (const l of leads) m[l.id] = l;
    return m;
  }, [leads]);

  const destByConv = useMemo(() => {
    const m: Record<string, Destino[]> = {};
    for (const d of destinos) (m[d.conversao_id] ||= []).push(d);
    return m;
  }, [destinos]);

  // --- Geração de destinos ----------------------------------------------
  const gerarDestinosParaConversao = async (conv: Conversao, silent = false) => {
    if (!activeContaId) return;
    const lead = leadById[conv.lead_id] || null;
    const leadIdents = idsByLead[conv.lead_id] || [];
    const conversao: ConversaoCore = {
      id: conv.id, empresa_id: conv.empresa_id, lead_id: conv.lead_id,
      valor: Number(conv.valor) || 0,
      convertido_em: conv.convertido_em, data_conversao: conv.data_conversao,
      nome_conversao: conv.nome_conversao,
      gclid: conv.gclid, fbclid: conv.fbclid, ttclid: conv.ttclid,
      email: conv.email, telefone: conv.telefone,
    };
    const leadCore: LeadCore | null = lead ? { id: lead.id, email: lead.email, telefone: lead.telefone, nome: lead.nome } : null;

    let upserts = 0;
    for (const plat of PLATAFORMAS) {
      const cfg = cfgByPlat[plat] as ConfiguracaoConversaoCore | undefined;
      const metodo: SendMethod = (cfg?.metodo_padrao as SendMethod) || "csv";
      const tipoEvento = getEventTypes(plat)[0];
      const result = validateConversionDestination({
        plataforma: plat, metodo_envio: metodo, tipo_evento_plataforma: tipoEvento,
        conversao, lead: leadCore, identidades: leadIdents, configuracao: cfg ?? null,
      });

      const existing = (destByConv[conv.id] || []).find((d) => d.plataforma === plat && d.metodo_envio === metodo);
      const row = {
        empresa_id: activeContaId,
        conversao_id: conv.id,
        plataforma: plat,
        metodo_envio: metodo,
        tipo_evento_plataforma: tipoEvento,
        status_envio: result.status === "pronto_para_exportar" ? "pronto_para_exportar" : "pendente",
        identificadores: { ...result.identificadores_disponiveis, _pendencias: result.pendencias } as any,
        payload_preview: result.payload_preview as any,
        erro: result.pendencias.length > 0 ? result.pendencias.join(" • ") : null,
      };
      if (existing) {
        // Não sobrescreve destino já exportado/enviado
        if (["exportado_csv", "enviado_api", "sincronizado_google_sheets"].includes(existing.status_envio)) continue;
        const { error } = await supabase.from("conversao_destinos").update(row).eq("id", existing.id);
        if (!error) upserts++;
      } else {
        const { error } = await supabase.from("conversao_destinos").insert(row);
        if (!error) upserts++;
      }
    }
    if (!silent) toast.success(`${upserts} destino(s) atualizado(s)`);
    return upserts;
  };

  // =====================================================================
  // ABA EVENTOS
  // =====================================================================
  const [openNew, setOpenNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    lead_id: "", venda_id: "", nome_conversao: "",
    valor: "", moeda: "BRL", data: today, observacoes: "",
  });

  const vendasDoLead = useMemo(() => vendas.filter((v) => v.lead_id === form.lead_id), [vendas, form.lead_id]);

  const onSelectVenda = (id: string) => {
    const v = vendas.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      venda_id: id,
      valor: v ? String(v.valor_total) : f.valor,
      data: v ? new Date(v.data_venda).toISOString().slice(0, 10) : f.data,
    }));
  };

  const criarConversao = async () => {
    if (!activeContaId) return;
    if (!form.lead_id) { toast.error("Selecione um lead"); return; }
    const valor = parseFloat(form.valor);
    if (!(valor > 0)) { toast.error("Valor deve ser maior que zero"); return; }
    const dataIso = new Date(form.data + "T12:00:00").toISOString();
    if (new Date(dataIso) > new Date()) { toast.error("Data da conversão não pode ser futura"); return; }
    const lead = leads.find((l) => l.id === form.lead_id);
    if (!lead) return;

    setSaving(true);
    const { data: ins, error } = await supabase.from("conversoes_offline").insert({
      empresa_id: activeContaId,
      lead_id: form.lead_id,
      nome_conversao: form.nome_conversao || "Conversao",
      descricao: form.observacoes || null,
      valor,
      data_conversao: dataIso,
      convertido_em: dataIso,
      email: lead.email,
      telefone: lead.telefone,
      gclid: lead.gclid,
      fbclid: lead.fbclid,
      ttclid: lead.ttclid,
      status_envio: "pendente",
    } as any).select().single();
    if (error || !ins) { setSaving(false); toast.error(error?.message || "Erro"); return; }

    // Refresh local then generate destinations
    await reload();
    await gerarDestinosParaConversao(ins as any, true);
    await reload();
    setSaving(false);
    setOpenNew(false);
    setForm({ lead_id: "", venda_id: "", nome_conversao: "", valor: "", moeda: "BRL", data: today, observacoes: "" });
    toast.success("Conversão registrada e destinos gerados");
  };

  const vendaPorLead = useMemo(() => {
    const m: Record<string, VendaOpt[]> = {};
    for (const v of vendas) (m[v.lead_id] ||= []).push(v);
    return m;
  }, [vendas]);

  // =====================================================================
  // ABA DESTINOS — filtros
  // =====================================================================
  const [fPlat, setFPlat] = useState("all");
  const [fMetodo, setFMetodo] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fPeriodo, setFPeriodo] = useState("all");
  const [busca, setBusca] = useState("");

  const destinosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const minDate = fPeriodo === "all" ? null : new Date(Date.now() - parseInt(fPeriodo, 10) * 86400000);
    return destinos.filter((d) => {
      if (fPlat !== "all" && d.plataforma !== fPlat) return false;
      if (fMetodo !== "all" && d.metodo_envio !== fMetodo) return false;
      if (fStatus !== "all" && d.status_envio !== fStatus) return false;
      if (minDate && new Date(d.updated_at) < minDate) return false;
      if (q) {
        const conv = conversoes.find((c) => c.id === d.conversao_id);
        const nome = (conv?.lead?.nome || "").toLowerCase();
        const email = (conv?.lead?.email || "").toLowerCase();
        if (!nome.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [destinos, conversoes, fPlat, fMetodo, fStatus, fPeriodo, busca]);

  const [openPayload, setOpenPayload] = useState<Destino | null>(null);
  const [openDestinosOf, setOpenDestinosOf] = useState<Conversao | null>(null);

  const recalcDestino = async (d: Destino) => {
    const conv = conversoes.find((c) => c.id === d.conversao_id);
    if (!conv) return;
    await gerarDestinosParaConversao(conv);
    await reload();
  };

  const marcarNaoAplicavel = async (d: Destino) => {
    const { error } = await supabase.from("conversao_destinos")
      .update({ status_envio: "nao_aplicavel" }).eq("id", d.id);
    if (error) toast.error(error.message); else { toast.success("Destino marcado"); reload(); }
  };

  // =====================================================================
  // ABA EXPORTAÇÕES
  // =====================================================================
  const [openExp, setOpenExp] = useState(false);
  const [expForm, setExpForm] = useState<{ plataforma: ConversionPlatform }>({ plataforma: "google_ads" });
  const [expSaving, setExpSaving] = useState(false);

  const elegiveisParaCsv = useMemo(() => {
    return destinos.filter((d) =>
      d.plataforma === expForm.plataforma &&
      d.metodo_envio === "csv" &&
      (d.status_envio === "pronto_para_exportar" || d.status_envio === "pendente")
    );
  }, [destinos, expForm.plataforma]);

  const gerarExportacaoCsv = async () => {
    if (!activeContaId) return;
    if (elegiveisParaCsv.length === 0) { toast.info("Nenhum destino elegível"); return; }
    setExpSaving(true);

    // Cria registro de exportação
    const { data: exp, error } = await supabase.from("exportacoes_conversoes").insert({
      empresa_id: activeContaId,
      plataforma: expForm.plataforma,
      metodo_envio: "csv",
      status: "concluido",
      total_registros: elegiveisParaCsv.length,
      total_sucesso: elegiveisParaCsv.length,
      total_erro: 0,
      filtros: { plataforma: expForm.plataforma, metodo_envio: "csv" },
    } as any).select().single();
    if (error || !exp) { setExpSaving(false); toast.error(error?.message || "Erro"); return; }

    // Atualiza destinos
    const ids = elegiveisParaCsv.map((d) => d.id);
    await supabase.from("conversao_destinos")
      .update({ status_envio: "exportado_csv", exportacao_id: exp.id, enviado_em: new Date().toISOString() })
      .in("id", ids);

    // Gera CSV baixável
    const header = ["destino_id", "conversao_id", "plataforma", "tipo_evento", "lead", "email", "telefone", "valor", "moeda", "data", "payload_json"];
    const body = elegiveisParaCsv.map((d) => {
      const conv = conversoes.find((c) => c.id === d.conversao_id);
      return [
        d.id, d.conversao_id, d.plataforma, d.tipo_evento_plataforma || "",
        conv?.lead?.nome || "", conv?.lead?.email || "", conv?.lead?.telefone || "",
        String(conv?.valor ?? 0), "BRL",
        conv?.data_conversao || conv?.convertido_em || "",
        JSON.stringify(d.payload_preview || {}),
      ];
    });
    downloadCsv(`${expForm.plataforma}_${Date.now()}.csv`, [header, ...body]);

    setExpSaving(false);
    setOpenExp(false);
    await reload();
    toast.success("Exportação concluída");
  };

  // =====================================================================
  // ABA CONFIGURAÇÕES
  // =====================================================================
  const updateConfig = async (cfg: Configuracao, patch: Partial<Configuracao>) => {
    const { error } = await supabase.from("configuracoes_conversao").update(patch as any).eq("id", cfg.id);
    if (error) toast.error(error.message);
    else { toast.success("Configuração atualizada"); reload(); }
  };

  // =====================================================================
  // RENDER
  // =====================================================================
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

  if (!activeContaId) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Selecione uma Conta Filha para visualizar conversões.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Conversões</h1>
          <p className="text-sm text-muted-foreground">
            Eventos internos, destinos por plataforma, exportações e configurações.
          </p>
          {activeConta && <p className="text-xs text-muted-foreground mt-1">Conta ativa: {activeConta.nome}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={Target} label="Eventos internos" value={kpis.eventos} />
        <Kpi icon={Clock} label="Destinos pendentes" value={kpis.pend} />
        <Kpi icon={Send} label="Prontos para exportar" value={kpis.prontos} />
        <Kpi icon={Download} label="Exportados CSV" value={kpis.exp} />
        <Kpi icon={AlertTriangle} label="Erros" value={kpis.erros} />
        <Kpi icon={DollarSign} label="Valor total" value={brl(kpis.valor)} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="eventos"><Layers className="h-4 w-4 mr-1" /> Eventos</TabsTrigger>
          <TabsTrigger value="destinos"><Send className="h-4 w-4 mr-1" /> Destinos</TabsTrigger>
          <TabsTrigger value="exportacoes"><Download className="h-4 w-4 mr-1" /> Exportações</TabsTrigger>
          <TabsTrigger value="configuracoes"><Settings2 className="h-4 w-4 mr-1" /> Configurações</TabsTrigger>
        </TabsList>

        {/* ============================ EVENTOS ============================ */}
        <TabsContent value="eventos" className="space-y-3">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <p className="text-xs text-muted-foreground">
              Conversão interna do Krescer. Cada evento gera destinos para Google Ads, Meta Ads e TikTok Ads.
            </p>
            <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1" /> Nova conversão</Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead/Cliente</TableHead>
                  <TableHead>Venda</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Moeda</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Origem/Campanha</TableHead>
                  <TableHead>Status interno</TableHead>
                  <TableHead>Destinos</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversoes.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
                    {loading ? "Carregando..." : "Nenhuma conversão registrada nesta conta."}
                  </TableCell></TableRow>
                ) : conversoes.map((i) => {
                  const venda = (vendaPorLead[i.lead_id] || []).find((v) => {
                    const dv = new Date(v.data_venda).toISOString().slice(0, 10);
                    const dc = new Date(i.data_conversao || i.convertido_em).toISOString().slice(0, 10);
                    return dv === dc;
                  });
                  const ds = destByConv[i.id] || [];
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">
                        {i.lead?.nome ?? "—"}
                        {i.lead?.email && <div className="text-xs text-muted-foreground">{i.lead.email}</div>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {venda ? <span>#{venda.id.slice(0, 8)} · {brl(Number(venda.valor_total))}</span> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">{i.nome_conversao || "Conversao"}</TableCell>
                      <TableCell className="text-right">{brl(Number(i.valor))}</TableCell>
                      <TableCell className="text-xs">BRL</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(i.data_conversao || i.convertido_em), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-xs">{i.lead?.utm_campaign || i.lead?.origem || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{i.status_envio}</Badge></TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium">{ds.length}</span>
                        {ds.length > 0 && (
                          <span className="text-muted-foreground"> · {ds.filter(d => d.status_envio === "pronto_para_exportar").length} prontos</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setOpenDestinosOf(i)} title="Ver destinos">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={async () => { await gerarDestinosParaConversao(i); await reload(); }} title="Recalcular destinos">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ============================ DESTINOS ============================ */}
        <TabsContent value="destinos" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Input placeholder="Buscar lead/cliente" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-56" />
            <Select value={fPlat} onValueChange={setFPlat}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas plataformas</SelectItem>
                {PLATAFORMAS.map(p => <SelectItem key={p} value={p}>{getConversionPlatformLabel(p)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fMetodo} onValueChange={setFMetodo}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos métodos</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="google_sheets">Google Sheets</SelectItem>
                <SelectItem value="api_oficial">API oficial</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {["pendente","pronto_para_exportar","exportado_csv","sincronizado_google_sheets","enviado_api","erro","nao_aplicavel"].map(s => (
                  <SelectItem key={s} value={s}>{getDestinationStatusLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fPeriodo} onValueChange={setFPeriodo}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo período</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead/Cliente</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Tipo de evento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Identificadores</TableHead>
                  <TableHead>Pendências</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {destinosFiltrados.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum destino encontrado.
                  </TableCell></TableRow>
                ) : destinosFiltrados.map((d) => {
                  const conv = conversoes.find((c) => c.id === d.conversao_id);
                  const ids = d.identificadores || {};
                  const pend: string[] = Array.isArray(ids._pendencias) ? ids._pendencias : [];
                  const idKeys = Object.keys(ids).filter((k) => k !== "_pendencias");
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs">
                        <div className="font-medium">{conv?.lead?.nome || "—"}</div>
                        <div className="text-muted-foreground">{conv?.nome_conversao || "Conversao"}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{getConversionPlatformLabel(d.plataforma)}</Badge></TableCell>
                      <TableCell className="text-xs">{getSendMethodLabel(d.metodo_envio)}</TableCell>
                      <TableCell className="text-xs">{getEventTypeLabel(d.plataforma, d.tipo_evento_plataforma)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_DESTINO_META[d.status_envio] || ""}>
                          {getDestinationStatusLabel(d.status_envio)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {idKeys.length === 0 ? <span className="text-muted-foreground">—</span> : (
                          <div className="flex flex-wrap gap-1">
                            {idKeys.slice(0, 3).map((k) => <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>)}
                            {idKeys.length > 3 && <span className="text-muted-foreground">+{idKeys.length - 3}</span>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-[220px]">
                        {pend.length === 0 ? <span className="text-muted-foreground">—</span> :
                          <span className="text-warning" title={pend.join(" • ")}>{pend[0]}{pend.length > 1 ? ` (+${pend.length - 1})` : ""}</span>}
                        {d.erro && pend.length === 0 && <span className="text-destructive">{d.erro}</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(d.updated_at), "dd/MM HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setOpenPayload(d)} title="Payload preview">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => recalcDestino(d)} title="Recalcular">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          {d.status_envio !== "nao_aplicavel" && d.status_envio !== "exportado_csv" && (
                            <Button size="sm" variant="ghost" onClick={() => marcarNaoAplicavel(d)} title="Marcar como não aplicável">
                              ✕
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ============================ EXPORTAÇÕES ============================ */}
        <TabsContent value="exportacoes" className="space-y-3">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <p className="text-xs text-muted-foreground">
              Lotes de exportação. CSV está disponível. Google Sheets e API oficial em preparação.
            </p>
            <Button onClick={() => setOpenExp(true)}><Download className="h-4 w-4 mr-1" /> Nova exportação CSV</Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Sucesso</TableHead>
                  <TableHead className="text-right">Erros</TableHead>
                  <TableHead>Arquivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exportacoes.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma exportação ainda.
                  </TableCell></TableRow>
                ) : exportacoes.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{format(new Date(e.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell><Badge variant="outline">{getConversionPlatformLabel(e.plataforma)}</Badge></TableCell>
                    <TableCell className="text-xs">{getSendMethodLabel(e.metodo_envio)}</TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_EXPORT_META[e.status] || ""}>{e.status}</Badge></TableCell>
                    <TableCell className="text-right">{e.total_registros}</TableCell>
                    <TableCell className="text-right text-success">{e.total_sucesso}</TableCell>
                    <TableCell className="text-right text-destructive">{e.total_erro}</TableCell>
                    <TableCell className="text-xs">
                      {e.arquivo_url ? <a className="text-primary underline" href={e.arquivo_url} target="_blank" rel="noreferrer">Arquivo</a>
                        : e.google_sheet_url ? <a className="text-primary underline" href={e.google_sheet_url} target="_blank" rel="noreferrer">Sheet</a>
                        : <span className="text-muted-foreground">CSV gerado no momento da exportação</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
            <Card><CardContent className="p-4 flex items-center gap-3 text-sm">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">Google Sheets</div>
                <div className="text-xs text-muted-foreground">Em preparação. Disponível em uma próxima etapa.</div>
              </div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3 text-sm">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">API oficial</div>
                <div className="text-xs text-muted-foreground">Em preparação. Não envia eventos para plataformas nesta etapa.</div>
              </div>
            </CardContent></Card>
          </div>
        </TabsContent>

        {/* ============================ CONFIGURAÇÕES ============================ */}
        <TabsContent value="configuracoes" className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Configure como cada plataforma receberá conversões offline desta Conta Filha.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLATAFORMAS.map((plat) => {
              const cfg = cfgByPlat[plat];
              if (!cfg) return (
                <Card key={plat}><CardHeader><CardTitle className="text-base">{getConversionPlatformLabel(plat)}</CardTitle></CardHeader>
                <CardContent className="text-xs text-muted-foreground">Configuração não inicializada.</CardContent></Card>
              );
              const ts = TOKEN_STATUS_META[cfg.token_status] || TOKEN_STATUS_META.nao_configurado;
              return (
                <Card key={plat}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <CardTitle className="text-base">{getConversionPlatformLabel(plat)}</CardTitle>
                    <Badge variant="outline" className={ts.cls}>{ts.label}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Ativa</Label>
                      <Switch checked={cfg.ativo} onCheckedChange={(v) => updateConfig(cfg, { ativo: v })} />
                    </div>
                    <div>
                      <Label className="text-xs">Método padrão</Label>
                      <Select value={cfg.metodo_padrao} onValueChange={(v) => updateConfig(cfg, { metodo_padrao: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {getAvailableMethods(plat).map(m => <SelectItem key={m} value={m}>{getSendMethodLabel(m)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {plat === "google_ads" && (
                      <>
                        <CfgInput label="Customer ID" value={cfg.google_customer_id} onSave={(v) => updateConfig(cfg, { google_customer_id: v })} />
                        <CfgInput label="Conversion Action ID" value={cfg.google_conversion_action_id} onSave={(v) => updateConfig(cfg, { google_conversion_action_id: v })} />
                      </>
                    )}
                    {plat === "meta_ads" && (
                      <>
                        <CfgInput label="Pixel ID" value={cfg.meta_pixel_id} onSave={(v) => updateConfig(cfg, { meta_pixel_id: v })} />
                        <CfgInput label="Dataset ID" value={cfg.meta_dataset_id} onSave={(v) => updateConfig(cfg, { meta_dataset_id: v })} />
                      </>
                    )}
                    {plat === "tiktok_ads" && (
                      <>
                        <CfgInput label="Advertiser ID" value={cfg.tiktok_advertiser_id} onSave={(v) => updateConfig(cfg, { tiktok_advertiser_id: v })} />
                        <CfgInput label="Event Source ID" value={cfg.tiktok_event_source_id} onSave={(v) => updateConfig(cfg, { tiktok_event_source_id: v })} />
                      </>
                    )}
                    <div>
                      <Label className="text-xs">Status do token</Label>
                      <Select value={cfg.token_status} onValueChange={(v) => updateConfig(cfg, { token_status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nao_configurado">Não configurado</SelectItem>
                          <SelectItem value="configurado">Configurado</SelectItem>
                          <SelectItem value="erro">Erro</SelectItem>
                          <SelectItem value="expirado">Expirado</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground mt-1">Tokens reais serão validados em uma próxima etapa.</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ============= Modal Nova conversão ============= */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova conversão interna</DialogTitle>
            <DialogDescription>O evento gera destinos para Google Ads, Meta Ads e TikTok Ads automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Lead/Cliente *</Label>
              <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v, venda_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {leads.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Venda vinculada (opcional)</Label>
              <Select value={form.venda_id || "none"} onValueChange={(v) => onSelectVenda(v === "none" ? "" : v)} disabled={!form.lead_id}>
                <SelectTrigger><SelectValue placeholder={form.lead_id ? "Sem venda" : "Selecione um lead primeiro"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem venda vinculada</SelectItem>
                  {vendasDoLead.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      #{v.id.slice(0, 8)} · {brl(Number(v.valor_total))} · {format(new Date(v.data_venda), "dd/MM/yyyy")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de conversão</Label>
              <Input value={form.nome_conversao} placeholder="Ex.: Compra, Lead, Cadastro" onChange={(e) => setForm({ ...form, nome_conversao: e.target.value })} />
            </div>
            <div>
              <Label>Valor *</Label>
              <Input type="number" min="0" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
            </div>
            <div>
              <Label>Moeda</Label>
              <Select value={form.moeda} onValueChange={(v) => setForm({ ...form, moeda: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data da conversão *</Label>
              <Input type="date" max={today} value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={criarConversao} disabled={saving}>{saving ? "Salvando..." : "Registrar conversão"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============= Modal Payload preview ============= */}
      <Dialog open={!!openPayload} onOpenChange={(v) => !v && setOpenPayload(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payload preview · {openPayload && getConversionPlatformLabel(openPayload.plataforma)}</DialogTitle>
            <DialogDescription>Pré-visualização do payload que será enviado. Não há chamada externa nesta etapa.</DialogDescription>
          </DialogHeader>
          {openPayload && (
            <ScrollArea className="max-h-[60vh]">
              <pre className="text-xs bg-muted p-3 rounded font-mono whitespace-pre-wrap break-all">
{JSON.stringify(openPayload.payload_preview, null, 2)}
              </pre>
              {Array.isArray(openPayload.identificadores?._pendencias) && openPayload.identificadores._pendencias.length > 0 && (
                <div className="mt-3 text-xs">
                  <div className="font-medium mb-1">Pendências:</div>
                  <ul className="list-disc pl-5 space-y-0.5 text-warning">
                    {openPayload.identificadores._pendencias.map((p: string, idx: number) => <li key={idx}>{p}</li>)}
                  </ul>
                </div>
              )}
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* ============= Modal Destinos da conversão ============= */}
      <Dialog open={!!openDestinosOf} onOpenChange={(v) => !v && setOpenDestinosOf(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Destinos da conversão</DialogTitle>
            <DialogDescription>{openDestinosOf?.lead?.nome} · {openDestinosOf?.nome_conversao || "Conversao"}</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Plataforma</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Tipo de evento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pendências</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(openDestinosOf ? destByConv[openDestinosOf.id] || [] : []).map((d) => {
                  const pend: string[] = Array.isArray(d.identificadores?._pendencias) ? d.identificadores._pendencias : [];
                  return (
                    <TableRow key={d.id}>
                      <TableCell>{getConversionPlatformLabel(d.plataforma)}</TableCell>
                      <TableCell className="text-xs">{getSendMethodLabel(d.metodo_envio)}</TableCell>
                      <TableCell className="text-xs">{getEventTypeLabel(d.plataforma, d.tipo_evento_plataforma)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_DESTINO_META[d.status_envio] || ""}>
                          {getDestinationStatusLabel(d.status_envio)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-warning">
                        {pend.length === 0 ? <span className="text-muted-foreground">—</span> : pend.join(" • ")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={async () => { if (openDestinosOf) { await gerarDestinosParaConversao(openDestinosOf); await reload(); } }}>
              <RefreshCw className="h-4 w-4 mr-1" /> Recalcular destinos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============= Modal Nova exportação ============= */}
      <Dialog open={openExp} onOpenChange={setOpenExp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova exportação CSV</DialogTitle>
            <DialogDescription>Inclui destinos prontos ou pendentes desta plataforma com método CSV.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Plataforma</Label>
              <Select value={expForm.plataforma} onValueChange={(v) => setExpForm({ plataforma: v as ConversionPlatform })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATAFORMAS.map(p => <SelectItem key={p} value={p}>{getConversionPlatformLabel(p)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{elegiveisParaCsv.length}</span> destino(s) elegível(eis).
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenExp(false)}>Cancelar</Button>
            <Button onClick={gerarExportacaoCsv} disabled={expSaving || elegiveisParaCsv.length === 0}>
              {expSaving ? "Gerando..." : "Gerar CSV"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Subcomponente: Input de configuração com salvamento on blur
// =============================================================================

function CfgInput({ label, value, onSave }: { label: string; value: string | null; onSave: (v: string | null) => void }) {
  const [v, setV] = useState(value || "");
  useEffect(() => { setV(value || ""); }, [value]);
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if ((value || "") !== v) onSave(v.trim() || null); }}
        placeholder="—"
      />
    </div>
  );
}
