import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Users, MessageSquare, Briefcase, ShoppingCart, DollarSign, Clock, FileCheck, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";

interface CampanhaRow {
  campanha: string;
  leads: number;
  vendas: number;
  receita: number;
  taxa: number;
  ticket: number;
}

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

interface Empresa { id: string; nome: string }

interface Metrics {
  totalLeads: number;
  conversasAbertas: number;
  oportunidadesAbertas: number;
  vendasFechadas: number;
  receitaVendas: number;
  convPendentes: number;
  convExportadas: number;
}

const initial: Metrics = {
  totalLeads: 0, conversasAbertas: 0, oportunidadesAbertas: 0,
  vendasFechadas: 0, receitaVendas: 0, convPendentes: 0, convExportadas: 0,
};

export default function Dashboard() {
  const { scopedContaIds, activeContaId } = useActiveAccount();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("all");
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [m, setM] = useState<Metrics>(initial);
  const [campanhas, setCampanhas] = useState<CampanhaRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { (async () => {
    if (scopedContaIds.length === 0) { setEmpresas([]); return; }
    const { data } = await supabase
      .from("empresas").select("id, nome")
      .in("id", scopedContaIds)
      .order("nome");
    setEmpresas(data || []);
    setEmpresaId("all");
  })(); /* eslint-disable-next-line */ }, [activeContaId, scopedContaIds.join(",")]);

  const fromIso = useMemo(() => from?.toISOString(), [from]);
  const toIso = useMemo(() => {
    if (!to) return undefined;
    const d = new Date(to); d.setHours(23, 59, 59, 999); return d.toISOString();
  }, [to]);

  const load = async () => {
    if (scopedContaIds.length === 0) { setM(initial); setCampanhas([]); return; }
    setLoading(true);
    try {
      const applyEmpresa = (q: any) => {
        if (empresaId !== "all" && scopedContaIds.includes(empresaId)) return q.eq("empresa_id", empresaId);
        return q.in("empresa_id", scopedContaIds);
      };
      const applyDate = (q: any, col: string) => {
        if (fromIso) q = q.gte(col, fromIso);
        if (toIso) q = q.lte(col, toIso);
        return q;
      };

      // leads base (created_at)
      const totalLeadsRes = await applyDate(applyEmpresa(supabase.from("leads").select("*", { count: "exact", head: true })), "created_at");

      // conversas abertas (status != fechada)
      const conversasRes = await applyDate(
        applyEmpresa(supabase.from("conversas").select("*", { count: "exact", head: true })).neq("status", "fechada"),
        "created_at"
      );

      // oportunidades abertas
      const oportRes = await applyDate(
        applyEmpresa(supabase.from("oportunidades").select("*", { count: "exact", head: true })).eq("status", "aberta"),
        "created_at"
      );

      // vendas fechadas (count + soma)
      const vendasQ = applyDate(
        applyEmpresa(supabase.from("vendas").select("valor_total", { count: "exact" })).eq("status", "fechada"),
        "data_venda"
      );
      const vendasRes = await vendasQ;
      const receitaVendas = (vendasRes.data || []).reduce((s: number, r: any) => s + Number(r.valor_total || 0), 0);

      // conversoes_offline pendentes/exportadas
      const buildConvOffline = (status: string) => {
        let q = applyEmpresa(supabase.from("conversoes_offline").select("*", { count: "exact", head: true })).eq("status_envio", status);
        if (fromIso) q = q.gte("created_at", fromIso);
        if (toIso) q = q.lte("created_at", toIso);
        return q;
      };
      const pendRes = await buildConvOffline("pendente");
      const expRes = await buildConvOffline("exportado_csv");

      setM({
        totalLeads: totalLeadsRes.count || 0,
        conversasAbertas: conversasRes.count || 0,
        oportunidadesAbertas: oportRes.count || 0,
        vendasFechadas: vendasRes.count || 0,
        receitaVendas,
        convPendentes: pendRes.count || 0,
        convExportadas: expRes.count || 0,
      });

      // Campanhas: leads filtrados + vendas fechadas relacionadas via lead_id
      let lq = supabase.from("leads").select("id, utm_campaign, created_at, empresa_id");
      if (empresaId !== "all" && scopedContaIds.includes(empresaId)) lq = lq.eq("empresa_id", empresaId);
      else lq = lq.in("empresa_id", scopedContaIds);
      if (fromIso) lq = lq.gte("created_at", fromIso);
      if (toIso) lq = lq.lte("created_at", toIso);
      const { data: leadsData, error: leadsErr } = await lq.limit(10000);
      if (leadsErr) throw leadsErr;

      let vq = supabase.from("vendas").select("lead_id, valor_total, data_venda, empresa_id, status").eq("status", "fechada");
      if (empresaId !== "all" && scopedContaIds.includes(empresaId)) vq = vq.eq("empresa_id", empresaId);
      else vq = vq.in("empresa_id", scopedContaIds);
      if (fromIso) vq = vq.gte("data_venda", fromIso);
      if (toIso) vq = vq.lte("data_venda", toIso);
      const { data: vendasData, error: vendasErr } = await vq.limit(10000);
      if (vendasErr) throw vendasErr;

      const leadCampMap = new Map<string, string>();
      const map = new Map<string, { leads: number; vendas: number; receita: number }>();
      (leadsData || []).forEach((l: any) => {
        const key = (l.utm_campaign && String(l.utm_campaign).trim()) || "sem campanha";
        leadCampMap.set(l.id, key);
        const cur = map.get(key) || { leads: 0, vendas: 0, receita: 0 };
        cur.leads += 1;
        map.set(key, cur);
      });
      (vendasData || []).forEach((v: any) => {
        const key = leadCampMap.get(v.lead_id) || "sem campanha";
        const cur = map.get(key) || { leads: 0, vendas: 0, receita: 0 };
        cur.vendas += 1;
        cur.receita += Number(v.valor_total || 0);
        map.set(key, cur);
      });
      const rows: CampanhaRow[] = Array.from(map.entries()).map(([campanha, v]) => ({
        campanha,
        leads: v.leads,
        vendas: v.vendas,
        receita: v.receita,
        taxa: v.leads > 0 ? v.vendas / v.leads : 0,
        ticket: v.vendas > 0 ? v.receita / v.vendas : 0,
      })).sort((a, b) => b.receita - a.receita);
      setCampanhas(rows);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar métricas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [empresaId, fromIso, toIso]);

  const cards = [
    { label: "Total de leads", value: m.totalLeads, icon: Users },
    { label: "Conversas abertas", value: m.conversasAbertas, icon: MessageSquare },
    { label: "Oportunidades abertas", value: m.oportunidadesAbertas, icon: Briefcase },
    { label: "Vendas fechadas", value: m.vendasFechadas, icon: ShoppingCart },
    { label: "Receita de vendas", value: m.receitaVendas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), icon: DollarSign },
    { label: "Conversões pendentes", value: m.convPendentes, icon: Clock },
    { label: "Conversões exportadas", value: m.convExportadas, icon: FileCheck },
  ];

  const dateBtn = (d: Date | undefined, ph: string, set: (v?: Date) => void) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !d && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {d ? format(d, "dd/MM/yyyy") : <span>{ph}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={d} onSelect={set} initialFocus className={cn("p-3 pointer-events-auto")} />
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral do CRM</p>
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Empresa</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">De</Label>
            {dateBtn(from, "Início", setFrom)}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Até</Label>
            {dateBtn(to, "Fim", setTo)}
          </div>
          {(from || to) && (
            <Button variant="ghost" onClick={() => { setFrom(undefined); setTo(undefined); }}>Limpar</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "—" : c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-lg">Performance de Campanhas</CardTitle>
            <Button
              variant="outline"
              size="sm"
              disabled={campanhas.length === 0}
              onClick={() => {
                const header = ["Campanha", "Leads", "Vendas", "Receita", "Taxa de venda", "Ticket medio"];
                const esc = (v: any) => `"${String(v).replace(/"/g, '""')}"`;
                const lines = [header.join(",")].concat(
                  campanhas.map((r) => [r.campanha, r.leads, r.vendas, r.receita.toFixed(2), (r.taxa * 100).toFixed(2) + "%", r.ticket.toFixed(2)].map(esc).join(","))
                );
                const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `campanhas-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
          </div>
          {(() => {
            const tLeads = campanhas.reduce((s, r) => s + r.leads, 0);
            const tVendas = campanhas.reduce((s, r) => s + r.vendas, 0);
            const tVal = campanhas.reduce((s, r) => s + r.receita, 0);
            const taxa = tLeads > 0 ? tVendas / tLeads : 0;
            const ticket = tVendas > 0 ? tVal / tVendas : 0;
            return (
              <div className="flex flex-wrap gap-4 pt-2 text-sm">
                <div><span className="text-muted-foreground">Leads:</span> <strong>{tLeads}</strong></div>
                <div><span className="text-muted-foreground">Vendas:</span> <strong>{tVendas}</strong></div>
                <div><span className="text-muted-foreground">Receita:</span> <strong>{fmtBRL(tVal)}</strong></div>
                <div><span className="text-muted-foreground">Taxa de venda:</span> <strong>{fmtPct(taxa)}</strong></div>
                <div><span className="text-muted-foreground">Ticket médio:</span> <strong>{fmtBRL(ticket)}</strong></div>
              </div>
            );
          })()}
        </CardHeader>
        <CardContent className="space-y-6">
          {campanhas.length > 0 && (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campanhas.slice(0, 10)} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="campanha" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmtBRL(Number(v))} width={90} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, color: "hsl(var(--popover-foreground))" }}
                    formatter={(v: any) => fmtBRL(Number(v))}
                  />
                  <Bar dataKey="receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Taxa de venda</TableHead>
                <TableHead className="text-right">Ticket médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campanhas.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{loading ? "Carregando..." : "Sem dados"}</TableCell></TableRow>
              ) : campanhas.map((r) => (
                <TableRow key={r.campanha}>
                  <TableCell className="font-medium">{r.campanha}</TableCell>
                  <TableCell className="text-right">{r.leads}</TableCell>
                  <TableCell className="text-right">{r.vendas}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.receita)}</TableCell>
                  <TableCell className="text-right">{fmtPct(r.taxa)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.ticket)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
