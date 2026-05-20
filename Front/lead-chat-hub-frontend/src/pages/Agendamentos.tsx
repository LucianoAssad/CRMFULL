import React, { useEffect, useState, useMemo } from "react";
import {
  CalendarIcon, Plus, Clock, MapPin, Link2, User, Phone, Check, X, ChevronLeft, ChevronRight, RefreshCw,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth,
  addMonths, subMonths, startOfWeek, endOfWeek, isToday, parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Agendamento {
  id: string;
  empresa_id: string;
  lead_id: string;
  conversa_id: string | null;
  usuario_id: string | null;
  titulo: string;
  descricao: string | null;
  tipo: string;
  status: string;
  data_inicio: string;
  data_fim: string | null;
  dia_todo: boolean;
  local: string | null;
  link_reuniao: string | null;
  lembrete_minutos: number | null;
  notas: string | null;
  created_at: string;
}

interface Lead { id: string; nome: string; telefone: string | null }
interface Usuario { id: string; nome: string }

const TIPOS: { v: string; l: string; emoji: string }[] = [
  { v: "reuniao",   l: "Reunião",      emoji: "🤝" },
  { v: "ligacao",   l: "Ligação",      emoji: "📞" },
  { v: "visita",    l: "Visita",       emoji: "🏠" },
  { v: "tarefa",    l: "Tarefa",       emoji: "✅" },
  { v: "follow_up", l: "Follow-up",    emoji: "🔔" },
];

const STATUS: { v: string; l: string; cls: string }[] = [
  { v: "agendado",   l: "Agendado",   cls: "bg-info/15 text-info border-info/30" },
  { v: "confirmado", l: "Confirmado", cls: "bg-primary/15 text-primary border-primary/30" },
  { v: "concluido",  l: "Concluído",  cls: "bg-success/15 text-success border-success/30" },
  { v: "cancelado",  l: "Cancelado",  cls: "bg-destructive/15 text-destructive border-destructive/30" },
  { v: "remarcado",  l: "Remarcado",  cls: "bg-warning/15 text-warning border-warning/30" },
];

const LEMBRETES = [
  { v: 0,    l: "Na hora" },
  { v: 15,   l: "15 min antes" },
  { v: 30,   l: "30 min antes" },
  { v: 60,   l: "1h antes" },
  { v: 1440, l: "1 dia antes" },
];

const emptyForm = () => ({
  lead_id: "",
  usuario_id: "",
  titulo: "",
  descricao: "",
  tipo: "reuniao",
  status: "agendado",
  data_inicio: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  data_fim: "",
  dia_todo: false,
  local: "",
  link_reuniao: "",
  lembrete_minutos: "30",
  notas: "",
});

// ── Página principal ─────────────────────────────────────────────────────────
export default function Agendamentos() {
  const { activeContaId, scopedContaIds } = useActiveAccount();
  const { usuarioId } = useAuth();

  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [leads, setLeads]               = useState<Lead[]>([]);
  const [usuarios, setUsuarios]         = useState<Usuario[]>([]);
  const [loading, setLoading]           = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selected, setSelected]         = useState<Date>(new Date());
  const [open, setOpen]                 = useState(false);
  const [editing, setEditing]           = useState<Agendamento | null>(null);
  const [form, setForm]                 = useState(emptyForm());
  const [saving, setSaving]             = useState(false);
  const [tab, setTab]                   = useState<"calendario" | "lista">("calendario");

  const ids = useMemo(() => (activeContaId ? [activeContaId] : scopedContaIds), [activeContaId, scopedContaIds]);

  const load = async () => {
    if (ids.length === 0) { setAgendamentos([]); setLoading(false); return; }
    setLoading(true);
    const [a, l, u] = await Promise.all([
      supabase.from("agendamentos").select("*").in("empresa_id", ids).order("data_inicio"),
      supabase.from("leads").select("id,nome,telefone").in("empresa_id", ids).order("nome").limit(500),
      supabase.from("usuarios").select("id,nome").in("empresa_id", ids).order("nome").limit(100),
    ]);
    setAgendamentos((a.data as any) || []);
    setLeads((l.data as any) || []);
    setUsuarios((u.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ids.join(",")]);

  // ── Calendário ─────────────────────────────────────────────────────────────
  const calDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end   = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const agByDay = useMemo(() => {
    const map: Record<string, Agendamento[]> = {};
    for (const a of agendamentos) {
      const key = a.data_inicio.slice(0, 10);
      (map[key] ||= []).push(a);
    }
    return map;
  }, [agendamentos]);

  const selectedDayAg = useMemo(
    () => agendamentos.filter((a) => isSameDay(parseISO(a.data_inicio), selected)),
    [agendamentos, selected],
  );

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const openNew = (date?: Date) => {
    const d = date || selected;
    setEditing(null);
    setForm({
      ...emptyForm(),
      data_inicio: format(d, "yyyy-MM-dd") + "T09:00",
      usuario_id: usuarioId || "",
    });
    setOpen(true);
  };

  const openEdit = (ag: Agendamento) => {
    setEditing(ag);
    setForm({
      lead_id: ag.lead_id,
      usuario_id: ag.usuario_id || "",
      titulo: ag.titulo,
      descricao: ag.descricao || "",
      tipo: ag.tipo,
      status: ag.status,
      data_inicio: ag.data_inicio.slice(0, 16),
      data_fim: ag.data_fim ? ag.data_fim.slice(0, 16) : "",
      dia_todo: ag.dia_todo,
      local: ag.local || "",
      link_reuniao: ag.link_reuniao || "",
      lembrete_minutos: String(ag.lembrete_minutos ?? 30),
      notas: ag.notas || "",
    } as any);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) return toast.error("Título é obrigatório");
    if (!form.lead_id) return toast.error("Selecione um lead");
    if (!form.data_inicio) return toast.error("Informe a data/hora de início");
    if (ids.length === 0) return;
    setSaving(true);
    const payload: any = {
      empresa_id: ids[0],
      lead_id: form.lead_id,
      usuario_id: form.usuario_id || null,
      titulo: form.titulo.trim(),
      descricao: form.descricao || null,
      tipo: form.tipo,
      status: form.status,
      data_inicio: new Date(form.data_inicio).toISOString(),
      data_fim: form.data_fim ? new Date(form.data_fim as string).toISOString() : null,
      dia_todo: (form as any).dia_todo,
      local: form.local || null,
      link_reuniao: form.link_reuniao || null,
      lembrete_minutos: form.lembrete_minutos ? Number(form.lembrete_minutos) : null,
      notas: form.notas || null,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("agendamentos").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("agendamentos").insert(payload));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Agendamento atualizado" : "Agendamento criado");
    setOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este agendamento?")) return;
    const { error } = await supabase.from("agendamentos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    load();
  };

  const handleStatusChange = async (ag: Agendamento, status: string) => {
    await supabase.from("agendamentos").update({ status, updated_at: new Date().toISOString() } as any).eq("id", ag.id);
    load();
  };

  const upd = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const tipoLabel = (t: string) => TIPOS.find((x) => x.v === t)?.emoji + " " + (TIPOS.find((x) => x.v === t)?.l ?? t);
  const statusMeta = (s: string) => STATUS.find((x) => x.v === s) ?? STATUS[0];
  const leadNome = (id: string) => leads.find((l) => l.id === id)?.nome ?? "—";
  const usuarioNome = (id: string | null) => id ? (usuarios.find((u) => u.id === id)?.nome ?? "—") : "—";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Agendamentos</h1>
          <p className="text-sm text-muted-foreground">Reuniões, ligações, visitas e follow-ups</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => openNew()}>
            <Plus className="mr-1 h-4 w-4" /> Novo agendamento
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="calendario"><CalendarIcon className="mr-1 h-4 w-4" /> Calendário</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
        </TabsList>

        {/* ── Calendário ── */}
        <TabsContent value="calendario" className="mt-0 pt-3">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
            {/* Grid do calendário */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="capitalize text-base">
                    {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>Hoje</Button>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Cabeçalho dias da semana */}
                <div className="grid grid-cols-7 border-b">
                  {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => (
                    <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
                  ))}
                </div>
                {/* Dias */}
                <div className="grid grid-cols-7">
                  {calDays.map((day) => {
                    const key = format(day, "yyyy-MM-dd");
                    const dayAgs = agByDay[key] || [];
                    const isSelected = isSameDay(day, selected);
                    const inMonth = isSameMonth(day, currentMonth);
                    return (
                      <button
                        key={key}
                        onClick={() => { setSelected(day); }}
                        onDoubleClick={() => openNew(day)}
                        className={cn(
                          "min-h-[80px] border-b border-r p-1 text-left transition-colors hover:bg-muted/50",
                          !inMonth && "bg-muted/20 text-muted-foreground/40",
                          isSelected && "bg-primary/10 ring-1 ring-inset ring-primary/30",
                          isToday(day) && "font-bold",
                        )}
                      >
                        <span className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                          isToday(day) && "bg-primary text-primary-foreground",
                        )}>
                          {format(day, "d")}
                        </span>
                        <div className="mt-0.5 space-y-0.5">
                          {dayAgs.slice(0, 3).map((ag) => (
                            <div
                              key={ag.id}
                              onClick={(e) => { e.stopPropagation(); openEdit(ag); }}
                              className={cn(
                                "truncate rounded px-1 py-0.5 text-[10px] font-medium cursor-pointer",
                                statusMeta(ag.status).cls,
                              )}
                            >
                              {TIPOS.find((t) => t.v === ag.tipo)?.emoji} {ag.titulo}
                            </div>
                          ))}
                          {dayAgs.length > 3 && (
                            <div className="text-[9px] text-muted-foreground pl-1">+{dayAgs.length - 3}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Painel do dia selecionado */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm capitalize">
                    {format(selected, "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={() => openNew(selected)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedDayAg.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum agendamento</p>
                ) : selectedDayAg.map((ag) => (
                  <AgCard key={ag.id} ag={ag} leads={leads} usuarios={usuarios}
                    onEdit={() => openEdit(ag)}
                    onDelete={() => handleDelete(ag.id)}
                    onStatusChange={(s) => handleStatusChange(ag, s)}
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Lista ── */}
        <TabsContent value="lista" className="mt-0 pt-3">
          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : agendamentos.length === 0 ? (
              <div className="rounded-md border p-10 text-center">
                <p className="text-muted-foreground">Nenhum agendamento encontrado.</p>
                <Button className="mt-3" onClick={() => openNew()}><Plus className="mr-1 h-4 w-4" /> Criar agendamento</Button>
              </div>
            ) : agendamentos.map((ag) => (
              <AgCard key={ag.id} ag={ag} leads={leads} usuarios={usuarios}
                onEdit={() => openEdit(ag)}
                onDelete={() => handleDelete(ag.id)}
                onStatusChange={(s) => handleStatusChange(ag, s)}
                showDate
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Dialog criar/editar ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={(e) => upd("titulo", e.target.value)} placeholder="Ex: Reunião de apresentação" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => upd("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.emoji} {t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => upd("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Lead *</Label>
              <Select value={form.lead_id} onValueChange={(v) => upd("lead_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o lead" /></SelectTrigger>
                <SelectContent>
                  {leads.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}{l.telefone ? ` · ${l.telefone}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Select value={form.usuario_id || "none"} onValueChange={(v) => upd("usuario_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(form as any).dia_todo} onCheckedChange={(v) => upd("dia_todo", v)} />
              <Label>Dia todo</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Início *</Label>
                <input
                  type={!(form as any).dia_todo ? "datetime-local" : "date"}
                  value={(form as any).dia_todo ? form.data_inicio.slice(0, 10) : form.data_inicio}
                  onChange={(e) => upd("data_inicio", e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <Label>Fim</Label>
                <input
                  type={!(form as any).dia_todo ? "datetime-local" : "date"}
                  value={(form as any).dia_todo ? (form.data_fim as string).slice(0, 10) : (form.data_fim as string)}
                  onChange={(e) => upd("data_fim", e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Local</Label>
              <Input value={form.local} onChange={(e) => upd("local", e.target.value)} placeholder="Endereço ou link" />
            </div>
            <div className="space-y-1">
              <Label>Link da reunião</Label>
              <Input value={form.link_reuniao} onChange={(e) => upd("link_reuniao", e.target.value)} placeholder="https://meet.google.com/..." />
            </div>
            <div className="space-y-1">
              <Label>Lembrete</Label>
              <Select value={String(form.lembrete_minutos)} onValueChange={(v) => upd("lembrete_minutos", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEMBRETES.map((l) => <SelectItem key={l.v} value={String(l.v)}>{l.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.descricao} onChange={(e) => upd("descricao", e.target.value)} placeholder="Detalhes do agendamento..." />
            </div>
            <div className="space-y-1">
              <Label>Notas internas</Label>
              <Textarea rows={2} value={form.notas} onChange={(e) => upd("notas", e.target.value)} placeholder="Observações para a equipe..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando…" : editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Card de agendamento ───────────────────────────────────────────────────────
function AgCard({
  ag, leads, usuarios, onEdit, onDelete, onStatusChange, showDate,
}: {
  ag: Agendamento;
  leads: { id: string; nome: string }[];
  usuarios: { id: string; nome: string }[];
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: string) => void;
  showDate?: boolean;
}) {
  const tipo = TIPOS.find((t) => t.v === ag.tipo);
  const statusM = STATUS.find((s) => s.v === ag.status) ?? STATUS[0];
  const lead = leads.find((l) => l.id === ag.lead_id);
  const resp = ag.usuario_id ? usuarios.find((u) => u.id === ag.usuario_id) : null;

  return (
    <div className="rounded-md border bg-card p-3 space-y-1.5 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-base">{tipo?.emoji}</span>
          <span className="font-medium text-sm truncate">{ag.titulo}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="outline" className={cn("text-[10px]", statusM.cls)}>{statusM.l}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {showDate && (
          <span className="flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" />
            {format(parseISO(ag.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
          </span>
        )}
        {!ag.dia_todo && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(parseISO(ag.data_inicio), "HH:mm")}
            {ag.data_fim && ` – ${format(parseISO(ag.data_fim), "HH:mm")}`}
          </span>
        )}
        {lead && <span className="flex items-center gap-1"><User className="h-3 w-3" />{lead.nome}</span>}
        {resp  && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{resp.nome}</span>}
        {ag.local && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{ag.local}</span>}
        {ag.link_reuniao && (
          <a href={ag.link_reuniao} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
            <Link2 className="h-3 w-3" /> Link
          </a>
        )}
      </div>

      {ag.descricao && <p className="text-xs text-muted-foreground line-clamp-1">{ag.descricao}</p>}

      <div className="flex items-center gap-1 pt-0.5">
        {ag.status !== "concluido" && (
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-success" onClick={() => onStatusChange("concluido")}>
            <Check className="h-3 w-3 mr-1" /> Concluído
          </Button>
        )}
        {ag.status !== "cancelado" && (
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-muted-foreground" onClick={() => onStatusChange("cancelado")}>
            <X className="h-3 w-3 mr-1" /> Cancelar
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs ml-auto" onClick={onEdit}>Editar</Button>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive" onClick={onDelete}>Excluir</Button>
      </div>
    </div>
  );
}
