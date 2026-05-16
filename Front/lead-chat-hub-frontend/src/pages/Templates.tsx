import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";

interface Empresa { id: string; nome: string; }
export interface VariavelDef { label: string; exemplo: string; }
export interface WhatsappTemplate {
  id: string;
  empresa_id: string;
  nome: string;
  nome_externo: string;
  idioma: string;
  categoria: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  corpo: string;
  variaveis: VariavelDef[];
  status: "draft" | "aprovado" | "rejeitado" | "arquivado";
  ativo: boolean;
  provider: string;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

const IDIOMAS = [
  { code: "pt_BR", label: "Português (BR)" },
  { code: "en_US", label: "English (US)" },
  { code: "es_ES", label: "Español" },
];
const CATEGORIAS = ["MARKETING", "UTILITY", "AUTHENTICATION"] as const;
const STATUSES = ["draft", "aprovado", "rejeitado", "arquivado"] as const;

const empty = {
  nome: "",
  nome_externo: "",
  idioma: "pt_BR",
  categoria: "UTILITY" as (typeof CATEGORIAS)[number],
  corpo: "",
  variaveis: [] as VariavelDef[],
  status: "draft" as (typeof STATUSES)[number],
  ativo: true,
};

export function extractVarCount(corpo: string): number {
  const matches = corpo.match(/\{\{\s*\d+\s*\}\}/g) || [];
  const nums = matches.map((m) => parseInt(m.replace(/\D/g, ""), 10));
  return nums.length ? Math.max(...nums) : 0;
}

export function renderTemplate(corpo: string, valores: string[]): string {
  return corpo.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => valores[parseInt(n, 10) - 1] ?? `{{${n}}}`);
}

export default function Templates() {
  const { scopedContaIds, activeContaId } = useActiveAccount();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [items, setItems] = useState<WhatsappTemplate[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
  const [ativoFilter, setAtivoFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WhatsappTemplate | null>(null);
  const [form, setForm] = useState({ ...empty });

  const loadEmpresas = async () => {
    if (scopedContaIds.length === 0) { setEmpresas([]); setEmpresaId(""); return; }
    const { data, error } = await supabase
      .from("empresas").select("id, nome")
      .in("id", scopedContaIds)
      .order("nome");
    if (error) { toast.error(error.message); return; }
    setEmpresas(data || []);
    setEmpresaId(activeContaId ?? data?.[0]?.id ?? "");
  };

  const loadItems = async (eid: string) => {
    if (!eid || !scopedContaIds.includes(eid)) { setItems([]); return; }
    const { data, error } = await supabase
      .from("whatsapp_templates" as any)
      .select("*")
      .eq("empresa_id", eid)
      .order("nome");
    if (error) { toast.error(error.message); return; }
    setItems(((data as any) || []).map((d: any) => ({ ...d, variaveis: d.variaveis ?? [] })));
  };

  useEffect(() => { loadEmpresas(); /* eslint-disable-next-line */ }, [activeContaId, scopedContaIds.join(",")]);
  useEffect(() => { if (empresaId) loadItems(empresaId); else setItems([]); }, [empresaId]);

  const filtered = useMemo(() => items.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (categoriaFilter !== "all" && t.categoria !== categoriaFilter) return false;
    if (ativoFilter === "ativos" && !t.ativo) return false;
    if (ativoFilter === "inativos" && t.ativo) return false;
    return true;
  }), [items, statusFilter, categoriaFilter, ativoFilter]);

  const openNew = () => { setEditing(null); setForm({ ...empty }); setOpen(true); };
  const openEdit = (t: WhatsappTemplate) => {
    setEditing(t);
    setForm({
      nome: t.nome, nome_externo: t.nome_externo, idioma: t.idioma,
      categoria: t.categoria, corpo: t.corpo, variaveis: t.variaveis || [],
      status: t.status, ativo: t.ativo,
    });
    setOpen(true);
  };

  const varCount = extractVarCount(form.corpo);
  // Sincroniza variáveis com {{N}} detectados
  const ensureVarsLength = (arr: VariavelDef[], n: number) => {
    const next = [...arr];
    while (next.length < n) next.push({ label: `Variável ${next.length + 1}`, exemplo: "" });
    next.length = n;
    return next;
  };

  const save = async () => {
    if (!empresaId) { toast.error("Selecione uma empresa"); return; }
    if (!form.nome.trim() || !form.nome_externo.trim() || !form.corpo.trim()) {
      toast.error("Nome interno, nome externo e corpo são obrigatórios"); return;
    }
    const variaveis = ensureVarsLength(form.variaveis, varCount);
    const payload = {
      empresa_id: empresaId,
      nome: form.nome.trim(),
      nome_externo: form.nome_externo.trim(),
      idioma: form.idioma,
      categoria: form.categoria,
      corpo: form.corpo,
      variaveis,
      status: form.status,
      ativo: form.ativo,
    };
    if (editing) {
      const { error } = await supabase.from("whatsapp_templates" as any).update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Template atualizado");
    } else {
      const { error } = await supabase.from("whatsapp_templates" as any).insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Template cadastrado");
    }
    setOpen(false);
    loadItems(empresaId);
  };

  const toggleAtivo = async (t: WhatsappTemplate) => {
    const { error } = await supabase.from("whatsapp_templates" as any).update({ ativo: !t.ativo }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    loadItems(empresaId);
  };
  const setStatus = async (t: WhatsappTemplate, status: string) => {
    const { error } = await supabase.from("whatsapp_templates" as any).update({ status }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    loadItems(empresaId);
  };
  const remove = async (t: WhatsappTemplate) => {
    if (!confirm(`Excluir "${t.nome}"?`)) return;
    const { error } = await supabase.from("whatsapp_templates" as any).delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    loadItems(empresaId);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      aprovado: "bg-emerald-100 text-emerald-800 border-emerald-300",
      draft: "bg-slate-100 text-slate-800 border-slate-300",
      rejeitado: "bg-red-100 text-red-800 border-red-300",
      arquivado: "bg-amber-100 text-amber-800 border-amber-300",
    };
    return <Badge variant="outline" className={map[s]}>{s}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <h1 className="text-lg font-semibold">Templates do WhatsApp</h1>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Empresa" /></SelectTrigger>
              <SelectContent>
                {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={ativoFilter} onValueChange={setAtivoFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativos">Ativos</SelectItem>
                <SelectItem value="inativos">Inativos</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Novo template</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editing ? "Editar" : "Novo"} template</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Nome interno</Label>
                      <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="follow_up_24h" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nome externo (Meta)</Label>
                      <Input value={form.nome_externo} onChange={(e) => setForm({ ...form, nome_externo: e.target.value })} placeholder="follow_up_24h" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Idioma</Label>
                      <Select value={form.idioma} onValueChange={(v) => setForm({ ...form, idioma: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {IDIOMAS.map((i) => <SelectItem key={i.code} value={i.code}>{i.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Categoria</Label>
                      <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Corpo (use {"{{1}}"}, {"{{2}}"}...)</Label>
                    <Textarea
                      rows={5}
                      value={form.corpo}
                      onChange={(e) => {
                        const corpo = e.target.value;
                        const n = extractVarCount(corpo);
                        setForm({ ...form, corpo, variaveis: ensureVarsLength(form.variaveis, n) });
                      }}
                      placeholder="Olá {{1}}, tudo bem? Retomando contato sobre {{2}}."
                    />
                  </div>
                  {varCount > 0 && (
                    <div className="space-y-2 rounded-md border p-3">
                      <Label className="text-sm">Variáveis detectadas</Label>
                      {Array.from({ length: varCount }).map((_, i) => {
                        const v = form.variaveis[i] || { label: "", exemplo: "" };
                        return (
                          <div key={i} className="grid grid-cols-[60px_1fr_1fr] items-center gap-2">
                            <span className="font-mono text-xs">{`{{${i + 1}}}`}</span>
                            <Input placeholder="Rótulo" value={v.label}
                              onChange={(e) => {
                                const arr = ensureVarsLength(form.variaveis, varCount);
                                arr[i] = { ...arr[i], label: e.target.value };
                                setForm({ ...form, variaveis: arr });
                              }} />
                            <Input placeholder="Exemplo" value={v.exemplo}
                              onChange={(e) => {
                                const arr = ensureVarsLength(form.variaveis, varCount);
                                arr[i] = { ...arr[i], exemplo: e.target.value };
                                setForm({ ...form, variaveis: arr });
                              }} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <Label htmlFor="ativo">Ativo</Label>
                    <Switch id="ativo" checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={save}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        {empresas.length === 0 ? (
          <p className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhuma empresa cadastrada.
          </p>
        ) : filtered.length === 0 ? (
          <p className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum template encontrado.
          </p>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Externo / Idioma</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.nome}</div>
                      <div className="line-clamp-1 max-w-md text-xs text-muted-foreground">{t.corpo}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs">{t.nome_externo}</div>
                      <div className="text-xs text-muted-foreground">{t.idioma}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{t.categoria}</Badge></TableCell>
                    <TableCell>
                      <Select value={t.status} onValueChange={(v) => setStatus(t, v)}>
                        <SelectTrigger className="h-7 w-32 px-2 text-xs">
                          <SelectValue>{statusBadge(t.status)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Switch checked={t.ativo} onCheckedChange={() => toggleAtivo(t)} /></TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(t)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
