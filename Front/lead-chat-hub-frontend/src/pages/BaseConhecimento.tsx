import React, { useEffect, useState, useMemo } from "react";
import { BookOpen, Plus, Search, Pencil, Trash2, Eye, Tag, RefreshCw, ChevronRight, Globe } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Artigo {
  id: string; empresa_id: string; autor_id: string | null; titulo: string;
  conteudo: string | null; categoria: string; tags: string | null; // comma-separated
  publico: boolean; ativo: boolean; visualizacoes: number; created_at: string; updated_at: string;
}

const CATEGORIAS = ["geral", "produto", "atendimento", "tecnico", "financeiro", "vendas", "politicas", "faq"];

const emptyForm = () => ({
  titulo: "", conteudo: "", categoria: "geral", tags: "", publico: false, ativo: true,
});

export default function BaseConhecimento() {
  const { activeContaId, scopedContaIds } = useActiveAccount();
  const { usuarioId } = useAuth();
  const ids = useMemo(() => activeContaId ? [activeContaId] : scopedContaIds, [activeContaId, scopedContaIds]);

  const [artigos, setArtigos]     = useState<Artigo[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [catFiltro, setCatFiltro] = useState("todos");
  const [open, setOpen]           = useState(false);
  const [viewing, setViewing]     = useState<Artigo | null>(null);
  const [editing, setEditing]     = useState<Artigo | null>(null);
  const [form, setForm]           = useState(emptyForm());
  const [saving, setSaving]       = useState(false);

  const load = async () => {
    if (ids.length === 0) { setArtigos([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("base_conhecimento").select("*").in("empresa_id", ids).eq("ativo", true).order("created_at", { ascending: false });
    setArtigos((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ids.join(",")]);

  const filtrados = useMemo(() => artigos.filter((a) => {
    const q = search.toLowerCase();
    const tagsArr = (a.tags || "").split(",").map((t: string) => t.trim());
    const matchQ = !q || a.titulo.toLowerCase().includes(q) || (a.conteudo || "").toLowerCase().includes(q) || tagsArr.some((t: string) => t.toLowerCase().includes(q));
    const matchC = catFiltro === "todos" || a.categoria === catFiltro;
    return matchQ && matchC;
  }), [artigos, search, catFiltro]);

  const save = async () => {
    if (!form.titulo.trim()) return toast.error("Título obrigatório");
    if (ids.length === 0) return;
    setSaving(true);
    const tagsStr = form.tags.split(",").map((t) => t.trim()).filter(Boolean).join(",");
    const payload: any = {
      empresa_id: ids[0], autor_id: usuarioId || null, titulo: form.titulo.trim(),
      conteudo: form.conteudo || null, categoria: form.categoria,
      tags: tagsStr || null, publico: form.publico, ativo: form.ativo,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("base_conhecimento").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("base_conhecimento").insert(payload));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Artigo atualizado" : "Artigo criado!");
    setOpen(false); load();
  };

  const openEdit = (a: Artigo) => {
    setEditing(a);
    setForm({ titulo: a.titulo, conteudo: a.conteudo || "", categoria: a.categoria, tags: (a.tags || "").replace(/,/g, ", "), publico: a.publico, ativo: a.ativo });
    setOpen(true);
  };

  const deleteArtigo = async (id: string) => {
    if (!confirm("Excluir artigo?")) return;
    await supabase.from("base_conhecimento").update({ ativo: false } as any).eq("id", id);
    toast.success("Excluído"); load();
  };

  const incView = async (a: Artigo) => {
    await supabase.from("base_conhecimento").update({ visualizacoes: (a.visualizacoes || 0) + 1 } as any).eq("id", a.id);
    setViewing(a);
  };

  const upd = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const catCount = useMemo(() => {
    const m: Record<string, number> = {};
    artigos.forEach((a) => { m[a.categoria] = (m[a.categoria] || 0) + 1; });
    return m;
  }, [artigos]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><BookOpen className="h-6 w-6" /> Base de Conhecimento</h1>
          <p className="text-sm text-muted-foreground">Documentação interna, FAQs e procedimentos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => { setEditing(null); setForm(emptyForm()); setOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Novo artigo
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar artigo..." className="pl-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["todos", ...CATEGORIAS].map((c) => (
            <button
              key={c}
              onClick={() => setCatFiltro(c)}
              className={cn(
                "rounded-full px-3 py-1 text-xs border transition-colors capitalize",
                catFiltro === c ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:border-primary/40",
              )}
            >
              {c === "todos" ? "Todos" : c}
              {c !== "todos" && catCount[c] ? ` (${catCount[c]})` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center">
          <BookOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{search ? "Nenhum artigo encontrado." : "Nenhum artigo ainda. Crie o primeiro!"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtrados.map((a) => (
            <Card key={a.id} className="group hover:border-primary/40 transition-colors cursor-pointer" onClick={() => incView(a)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm line-clamp-2 leading-snug">{a.titulo}</CardTitle>
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openEdit(a); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); deleteArtigo(a.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {a.conteudo && <p className="text-xs text-muted-foreground line-clamp-2">{a.conteudo.replace(/#|##|###|\*\*/g, "")}</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-[10px] capitalize">{a.categoria}</Badge>
                  {a.publico && <Badge variant="outline" className="text-[10px] text-primary border-primary/30"><Globe className="mr-0.5 h-2.5 w-2.5" />Público</Badge>}
                  {(a.tags || "").split(",").filter(Boolean).slice(0, 2).map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]"><Tag className="mr-0.5 h-2.5 w-2.5" />{t}</Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="h-2.5 w-2.5" />{a.visualizacoes} views</span>
                  <span>{new Date(a.updated_at).toLocaleDateString("pt-BR")}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog viewer */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.titulo}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="secondary" className="capitalize">{viewing.categoria}</Badge>
                {(viewing.tags || "").split(",").filter(Boolean).map((t) => <Badge key={t} variant="outline">{t.trim()}</Badge>)}
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                {viewing.conteudo || <span className="text-muted-foreground italic">Sem conteúdo.</span>}
              </div>
              <div className="flex justify-between items-center pt-3 border-t text-xs text-muted-foreground">
                <span>{viewing.visualizacoes} visualizações</span>
                <Button size="sm" variant="outline" onClick={() => { setViewing(null); openEdit(viewing); }}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog editor */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar artigo" : "Novo artigo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Título *</Label><Input value={form.titulo} onChange={(e) => upd("titulo", e.target.value)} placeholder="Ex: Como fazer orçamento?" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => upd("categoria", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Tags (separadas por vírgula)</Label><Input value={form.tags} onChange={(e) => upd("tags", e.target.value)} placeholder="faq, produto, atendimento" /></div>
            </div>
            <div className="space-y-1">
              <Label>Conteúdo</Label>
              <Textarea rows={12} value={form.conteudo} onChange={(e) => upd("conteudo", e.target.value)} placeholder="Escreva o conteúdo do artigo aqui. Suporte a Markdown." className="font-mono text-sm" />
              <p className="text-[11px] text-muted-foreground">Suporte a Markdown: **negrito**, # título, - lista</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.publico} onCheckedChange={(v) => upd("publico", v)} />
                <Label className="text-sm">Visível para clientes</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.ativo} onCheckedChange={(v) => upd("ativo", v)} />
                <Label className="text-sm">Ativo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : editing ? "Salvar" : "Criar artigo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
