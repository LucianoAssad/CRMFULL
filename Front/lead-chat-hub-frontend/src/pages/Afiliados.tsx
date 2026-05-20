import React, { useEffect, useState, useMemo } from "react";
import {
  Plus, Users, DollarSign, TrendingUp, Copy, Check, Pencil, Trash2, RefreshCw, Link,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Afiliado {
  id: string; empresa_id: string; nome: string; email: string | null;
  telefone: string | null; codigo_afiliado: string; percentual_comissao: number;
  total_indicacoes: number; total_convertidas: number; total_comissao: number;
  status: string; created_at: string;
}
interface Indicacao {
  id: string; empresa_id: string; afiliado_id: string; nome_indicado: string;
  email_indicado: string | null; telefone_indicado: string | null; status: string;
  valor_venda: number | null; valor_comissao: number | null;
  comissao_paga: boolean; paga_em: string | null; observacoes: string | null; created_at: string;
}

const STATUS_AF: Record<string, string> = { ativo: "Ativo", inativo: "Inativo", suspenso: "Suspenso" };
const STATUS_IND: Record<string, { l: string; cls: string }> = {
  pendente:   { l: "Pendente",   cls: "bg-warning/15 text-warning border-warning/30" },
  contatado:  { l: "Contatado",  cls: "bg-info/15 text-info border-info/30" },
  convertido: { l: "Convertido", cls: "bg-success/15 text-success border-success/30" },
  perdido:    { l: "Perdido",    cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

function gerarCodigo() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function Afiliados() {
  const { activeContaId, scopedContaIds } = useActiveAccount();
  const ids = useMemo(() => activeContaId ? [activeContaId] : scopedContaIds, [activeContaId, scopedContaIds]);

  const [afiliados, setAfiliados]   = useState<Afiliado[]>([]);
  const [indicacoes, setIndicacoes] = useState<Indicacao[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState("afiliados");
  const [open, setOpen]             = useState(false);
  const [editingAf, setEditingAf]   = useState<Afiliado | null>(null);
  const [openInd, setOpenInd]       = useState(false);
  const [selAfiliado, setSelAfiliado] = useState("");
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", percentual_comissao: "10", codigo_afiliado: gerarCodigo() });
  const [formInd, setFormInd] = useState({ afiliado_id: "", nome_indicado: "", email_indicado: "", telefone_indicado: "", observacoes: "" });
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    if (ids.length === 0) { setAfiliados([]); setIndicacoes([]); setLoading(false); return; }
    setLoading(true);
    const [a, i] = await Promise.all([
      supabase.from("afiliados").select("*").in("empresa_id", ids).order("nome"),
      supabase.from("indicacoes").select("*").in("empresa_id", ids).order("created_at", { ascending: false }),
    ]);
    setAfiliados((a.data as any) || []);
    setIndicacoes((i.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ids.join(",")]);

  // KPIs
  const kpis = useMemo(() => ({
    totalAfiliados: afiliados.length,
    afiliadosAtivos: afiliados.filter((a) => a.status === "ativo").length,
    totalIndicacoes: indicacoes.length,
    totalConvertidas: indicacoes.filter((i) => i.status === "convertido").length,
    totalComissao: indicacoes.reduce((s, i) => s + Number(i.valor_comissao || 0), 0),
    comissaoPendente: indicacoes.filter((i) => i.status === "convertido" && !i.comissao_paga)
      .reduce((s, i) => s + Number(i.valor_comissao || 0), 0),
  }), [afiliados, indicacoes]);

  const copyLink = (codigo: string, id: string) => {
    const url = `${window.location.origin}/cadastro?afiliado=${codigo}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Link copiado!");
  };

  const saveAfiliado = async () => {
    if (!form.nome.trim()) return toast.error("Nome obrigatório");
    if (ids.length === 0) return;
    setSaving(true);
    const payload: any = {
      empresa_id: ids[0], nome: form.nome.trim(), email: form.email || null,
      telefone: form.telefone || null, codigo_afiliado: form.codigo_afiliado,
      percentual_comissao: Number(form.percentual_comissao),
      status: "ativo", updated_at: new Date().toISOString(),
    };
    let error;
    if (editingAf) {
      ({ error } = await supabase.from("afiliados").update(payload).eq("id", editingAf.id));
    } else {
      ({ error } = await supabase.from("afiliados").insert(payload));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editingAf ? "Afiliado atualizado" : "Afiliado cadastrado!");
    setOpen(false); load();
  };

  const saveIndicacao = async () => {
    if (!formInd.nome_indicado.trim() || !formInd.afiliado_id) return toast.error("Preencha os campos obrigatórios");
    if (ids.length === 0) return;
    setSaving(true);
    const { error } = await supabase.from("indicacoes").insert({
      empresa_id: ids[0], afiliado_id: formInd.afiliado_id,
      nome_indicado: formInd.nome_indicado.trim(), email_indicado: formInd.email_indicado || null,
      telefone_indicado: formInd.telefone_indicado || null, status: "pendente",
      observacoes: formInd.observacoes || null,
    } as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Indicação registrada!");
    setOpenInd(false); load();
  };

  const updateIndicacaoStatus = async (id: string, status: string) => {
    await supabase.from("indicacoes").update({ status, updated_at: new Date().toISOString() } as any).eq("id", id);
    load();
  };

  const pagarComissao = async (ind: Indicacao) => {
    await supabase.from("indicacoes").update({ comissao_paga: true, paga_em: new Date().toISOString() } as any).eq("id", ind.id);
    toast.success("Comissão marcada como paga");
    load();
  };

  const deleteAfiliado = async (id: string) => {
    if (!confirm("Excluir afiliado?")) return;
    await supabase.from("afiliados").delete().eq("id", id);
    toast.success("Excluído"); load();
  };

  const upd = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const updI = (k: string, v: string) => setFormInd((f) => ({ ...f, [k]: v }));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Users className="h-6 w-6" /> Programa de Afiliados</h1>
          <p className="text-sm text-muted-foreground">Gerencie afiliados, indicações e comissões</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={() => { setFormInd({ afiliado_id: afiliados[0]?.id || "", nome_indicado: "", email_indicado: "", telefone_indicado: "", observacoes: "" }); setOpenInd(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Nova indicação
          </Button>
          <Button onClick={() => { setEditingAf(null); setForm({ nome: "", email: "", telefone: "", percentual_comissao: "10", codigo_afiliado: gerarCodigo() }); setOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Novo afiliado
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Afiliados", value: kpis.totalAfiliados, icon: Users },
          { label: "Ativos", value: kpis.afiliadosAtivos, icon: TrendingUp },
          { label: "Indicações", value: kpis.totalIndicacoes, icon: Link },
          { label: "Convertidas", value: kpis.totalConvertidas, icon: Check },
          { label: "Total comissão", value: fmtBRL(kpis.totalComissao), icon: DollarSign },
          { label: "Pendente pagar", value: fmtBRL(kpis.comissaoPendente), icon: DollarSign },
        ].map((k) => (
          <Card key={k.label} className="text-center">
            <CardContent className="pt-4 pb-3">
              <k.icon className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
              <p className="text-lg font-bold">{loading ? "—" : k.value}</p>
              <p className="text-[11px] text-muted-foreground">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="afiliados">Afiliados ({afiliados.length})</TabsTrigger>
          <TabsTrigger value="indicacoes">Indicações ({indicacoes.length})</TabsTrigger>
        </TabsList>

        {/* Afiliados */}
        <TabsContent value="afiliados" className="pt-3">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead className="text-right">Indicações</TableHead>
                  <TableHead className="text-right">Convertidas</TableHead>
                  <TableHead className="text-right">Total ganho</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                ) : afiliados.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum afiliado cadastrado.</TableCell></TableRow>
                ) : afiliados.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{a.nome}</p>
                      {a.email && <p className="text-xs text-muted-foreground">{a.email}</p>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{a.codigo_afiliado}</code>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyLink(a.codigo_afiliado, a.id)}>
                          {copiedId === a.id ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{a.percentual_comissao}%</TableCell>
                    <TableCell className="text-right">{a.total_indicacoes}</TableCell>
                    <TableCell className="text-right">{a.total_convertidas}</TableCell>
                    <TableCell className="text-right">{fmtBRL(Number(a.total_comissao))}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px]", a.status === "ativo" ? "border-success/40 text-success" : "")}>
                        {STATUS_AF[a.status] ?? a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingAf(a); setForm({ nome: a.nome, email: a.email || "", telefone: a.telefone || "", percentual_comissao: String(a.percentual_comissao), codigo_afiliado: a.codigo_afiliado }); setOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteAfiliado(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Indicações */}
        <TabsContent value="indicacoes" className="pt-3">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicado</TableHead>
                  <TableHead>Afiliado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Venda</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {indicacoes.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma indicação ainda.</TableCell></TableRow>
                ) : indicacoes.map((i) => {
                  const af = afiliados.find((a) => a.id === i.afiliado_id);
                  const sm = STATUS_IND[i.status] ?? STATUS_IND.pendente;
                  return (
                    <TableRow key={i.id}>
                      <TableCell>
                        <p className="font-medium text-sm">{i.nome_indicado}</p>
                        {i.telefone_indicado && <p className="text-xs text-muted-foreground">{i.telefone_indicado}</p>}
                      </TableCell>
                      <TableCell className="text-sm">{af?.nome ?? "—"}</TableCell>
                      <TableCell>
                        <Select value={i.status} onValueChange={(v) => updateIndicacaoStatus(i.id, v)}>
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <Badge variant="outline" className={cn("text-[10px]", sm.cls)}>{sm.l}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_IND).map(([k, v]) => <SelectItem key={k} value={k}>{v.l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right text-sm">{i.valor_venda ? fmtBRL(Number(i.valor_venda)) : "—"}</TableCell>
                      <TableCell className="text-right text-sm">{i.valor_comissao ? fmtBRL(Number(i.valor_comissao)) : "—"}</TableCell>
                      <TableCell>
                        {i.status === "convertido" && (
                          i.comissao_paga
                            ? <Badge variant="outline" className="text-[10px] text-success border-success/40">✓ Pago</Badge>
                            : <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => pagarComissao(i)}>Marcar pago</Button>
                        )}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog afiliado */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingAf ? "Editar afiliado" : "Novo afiliado"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => upd("nome", e.target.value)} /></div>
            <div className="space-y-1"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => upd("email", e.target.value)} /></div>
            <div className="space-y-1"><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => upd("telefone", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Código</Label><Input value={form.codigo_afiliado} onChange={(e) => upd("codigo_afiliado", e.target.value.toUpperCase())} className="font-mono" /></div>
              <div className="space-y-1"><Label>Comissão %</Label><Input type="number" min={0} max={100} value={form.percentual_comissao} onChange={(e) => upd("percentual_comissao", e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={saveAfiliado} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog indicação */}
      <Dialog open={openInd} onOpenChange={setOpenInd}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova indicação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Afiliado *</Label>
              <Select value={formInd.afiliado_id} onValueChange={(v) => updI("afiliado_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{afiliados.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Nome do indicado *</Label><Input value={formInd.nome_indicado} onChange={(e) => updI("nome_indicado", e.target.value)} /></div>
            <div className="space-y-1"><Label>Telefone</Label><Input value={formInd.telefone_indicado} onChange={(e) => updI("telefone_indicado", e.target.value)} /></div>
            <div className="space-y-1"><Label>E-mail</Label><Input value={formInd.email_indicado} onChange={(e) => updI("email_indicado", e.target.value)} /></div>
            <div className="space-y-1"><Label>Observações</Label><Input value={formInd.observacoes} onChange={(e) => updI("observacoes", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenInd(false)}>Cancelar</Button>
            <Button onClick={saveIndicacao} disabled={saving}>{saving ? "Salvando…" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
