import React, { useEffect, useState } from "react";
import { Plus, Users, MessageSquare, RefreshCw, Trash2, Settings2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Grupos WA são gerenciados via uma conversa especial com tipo="grupo"
// O canal precisa suportar grupos (Evolution API / WPPConnect)

interface Canal { id: string; nome: string; tipo: string; provider: string | null; identificador: string | null; ativo: boolean }
interface Grupo {
  id: string;
  empresa_id: string;
  canal_id: string;
  nome: string;
  identificador: string; // group JID ex: "120363xxxxxxx@g.us"
  descricao: string | null;
  participantes: number;
  ativo: boolean;
  configuracoes: Record<string, any> | null;
  created_at: string;
}

export default function GruposWhatsapp() {
  const { activeContaId, scopedContaIds } = useActiveAccount();
  const ids = activeContaId ? [activeContaId] : scopedContaIds;

  const [canais, setCanais]   = useState<Canal[]>([]);
  const [grupos, setGrupos]   = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState<Grupo | null>(null);
  const [form, setForm]       = useState({ canal_id: "", nome: "", identificador: "", descricao: "" });
  const [saving, setSaving]   = useState(false);

  const load = async () => {
    if (ids.length === 0) { setCanais([]); setGrupos([]); setLoading(false); return; }
    setLoading(true);
    const [c, g] = await Promise.all([
      supabase.from("canais_conectados").select("id,nome,tipo,provider,identificador,ativo").in("empresa_id", ids).eq("tipo", "whatsapp").eq("ativo", true),
      // Grupos ficam em canais_conectados com tipo especial ou em tabela separada
      // Por enquanto usamos o campo configuracoes para armazenar meta de grupos localmente
      supabase.from("canais_conectados").select("*").in("empresa_id", ids).eq("tipo", "whatsapp_grupo"),
    ]);
    setCanais((c.data as any) || []);
    setGrupos((g.data as any)?.map((g: any) => ({
      id: g.id,
      empresa_id: g.empresa_id,
      canal_id: (g.configuracoes as any)?._canal_pai || "",
      nome: g.nome,
      identificador: g.identificador || "",
      descricao: (g.configuracoes as any)?._descricao || null,
      participantes: (g.configuracoes as any)?._participantes || 0,
      ativo: g.ativo,
      configuracoes: g.configuracoes,
      created_at: g.created_at,
    })) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ids.join(",")]);

  const canaisSuportados = canais.filter((c) =>
    c.provider === "evolution_api" || c.provider === "wppconnect" || c.provider === "whatsapp_nao_oficial"
  );

  const handleSave = async () => {
    if (!form.canal_id || !form.nome.trim()) return toast.error("Canal e nome são obrigatórios");
    if (ids.length === 0) return;
    setSaving(true);
    const payload: any = {
      empresa_id: ids[0],
      tipo: "whatsapp_grupo",
      nome: form.nome.trim(),
      identificador: form.identificador.trim() || null,
      ativo: true,
      configuracoes: {
        _canal_pai: form.canal_id,
        _descricao: form.descricao || null,
        _participantes: 0,
      },
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("canais_conectados").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("canais_conectados").insert(payload));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Grupo atualizado" : "Grupo registrado");
    setOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este grupo?")) return;
    await supabase.from("canais_conectados").delete().eq("id", id);
    toast.success("Grupo removido");
    load();
  };

  const upd = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Users className="h-6 w-6" /> Grupos WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Gerencie grupos vinculados aos seus canais</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => { setEditing(null); setForm({ canal_id: canaisSuportados[0]?.id || "", nome: "", identificador: "", descricao: "" }); setOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Registrar grupo
          </Button>
        </div>
      </div>

      {canaisSuportados.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Nenhum canal WhatsApp com suporte a grupos encontrado.
            Para usar grupos, conecte um canal via <strong>Evolution API</strong> ou <strong>WPPConnect</strong> em <a href="/account/conexoes" className="underline">Conexões</a>.
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : grupos.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum grupo registrado ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">Registre grupos do WhatsApp para gerenciá-los aqui e usá-los em campanhas.</p>
          <Button className="mt-4" onClick={() => { setEditing(null); setForm({ canal_id: canaisSuportados[0]?.id || "", nome: "", identificador: "", descricao: "" }); setOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Registrar primeiro grupo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {grupos.map((g) => {
            const canal = canais.find((c) => c.id === g.canal_id);
            return (
              <Card key={g.id} className={cn(!g.ativo && "opacity-60")}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm">{g.nome}</CardTitle>
                      {canal && <CardDescription className="text-xs">{canal.nome}</CardDescription>}
                    </div>
                    <Badge variant={g.ativo ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {g.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {g.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{g.descricao}</p>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {g.participantes > 0 && (
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{g.participantes} participantes</span>
                    )}
                    {g.identificador && (
                      <span className="font-mono text-[10px] truncate">{g.identificador}</span>
                    )}
                  </div>
                  <div className="flex gap-1 pt-1">
                    <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={() => {
                      setEditing(g);
                      setForm({ canal_id: g.canal_id, nome: g.nome, identificador: g.identificador, descricao: g.descricao || "" });
                      setOpen(true);
                    }}>
                      <Settings2 className="mr-1 h-3 w-3" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleDelete(g.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar grupo" : "Registrar grupo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Canal WhatsApp *</Label>
              <Select value={form.canal_id} onValueChange={(v) => upd("canal_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o canal" /></SelectTrigger>
                <SelectContent>
                  {canaisSuportados.length > 0 ? canaisSuportados.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  )) : canais.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nome do grupo *</Label>
              <Input value={form.nome} onChange={(e) => upd("nome", e.target.value)} placeholder="Ex: Clientes VIP" />
            </div>
            <div className="space-y-1">
              <Label>JID do grupo</Label>
              <Input value={form.identificador} onChange={(e) => upd("identificador", e.target.value)} placeholder="120363xxxxxxx@g.us" className="font-mono text-xs" />
              <p className="text-[11px] text-muted-foreground">Identificador interno do grupo no WhatsApp (opcional).</p>
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={(e) => upd("descricao", e.target.value)} placeholder="Descrição do grupo..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando…" : editing ? "Salvar" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
