import { useEffect, useState, useCallback } from "react";
import { StickyNote, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ConversaNota } from "@/lib/crm-types";

interface Props {
  empresaId: string;
  conversaId: string;
}

export function NotasInternas({ empresaId, conversaId }: Props) {
  const { usuarioId } = useAuth();
  const [notas, setNotas] = useState<ConversaNota[]>([]);
  const [usuariosMap, setUsuariosMap] = useState<Record<string, string>>({});
  const [conteudo, setConteudo] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!conversaId || !empresaId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("conversa_notas" as any)
      .select("*")
      .eq("conversa_id", conversaId)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const list = ((data as any[]) || []) as ConversaNota[];
    setNotas(list);
    const ids = Array.from(new Set(list.map((n) => n.usuario_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: us } = await supabase.from("usuarios").select("id,nome").in("id", ids);
      const m: Record<string, string> = {};
      ((us as any[]) || []).forEach((u) => { m[u.id] = u.nome; });
      setUsuariosMap(m);
    }
  }, [conversaId, empresaId]);

  useEffect(() => { load(); }, [load]);

  const adicionar = async () => {
    if (!conteudo.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("conversa_notas" as any).insert({
      empresa_id: empresaId,
      conversa_id: conversaId,
      usuario_id: usuarioId,
      conteudo: conteudo.trim(),
    });
    setAdding(false);
    if (error) { toast.error(error.message); return; }
    setConteudo("");
    toast.success("Nota interna adicionada");
    await load();
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("conversa_notas" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setNotas((arr) => arr.filter((n) => n.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Notas internas {notas.length > 0 && <span className="text-muted-foreground/70">({notas.length})</span>}
        </h3>
      </div>

      <div className="space-y-1.5">
        <Textarea
          rows={2}
          placeholder="Anotação visível só para a equipe..."
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          className="resize-none border-warning/40 bg-warning/5 text-xs"
        />
        <Button
          size="sm" variant="secondary" className="w-full"
          onClick={adicionar} disabled={!conteudo.trim() || adding}
        >
          <Plus className="mr-1 h-3 w-3" /> {adding ? "Adicionando..." : "Adicionar nota"}
        </Button>
      </div>

      {loading && <p className="text-[11px] text-muted-foreground">Carregando...</p>}
      {!loading && notas.length === 0 && (
        <p className="text-[11px] text-muted-foreground">Sem notas internas nesta conversa.</p>
      )}

      <ul className="space-y-1.5">
        {notas.map((n) => (
          <li key={n.id} className="rounded-md border border-warning/30 bg-warning/5 p-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="font-medium">{n.usuario_id ? (usuariosMap[n.usuario_id] || "Atendente") : "Sistema"}</span>
                  <span>·</span>
                  <span>{formatDistanceToNowStrict(new Date(n.created_at), { locale: ptBR, addSuffix: true })}</span>
                </div>
                <p className="whitespace-pre-wrap break-words">{n.conteudo}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => remover(n.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
