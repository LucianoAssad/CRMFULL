import { useEffect, useState } from "react";
import { UserCircle2, Flag, CircleDot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  CONVERSA_STATUS_LABEL, PRIORIDADE_LABEL,
  type Conversa, type ConversaPrioridade, type ConversaStatus,
} from "@/lib/crm-types";

interface Props {
  conversa: Conversa;
  onChanged?: (patch: Partial<Conversa>) => void;
}

export function ConversaControles({ conversa, onChanged }: Props) {
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);
  const [responsavel, setResponsavel] = useState<string>(conversa.responsavel_id ?? "none");
  const [prioridade, setPrioridade] = useState<ConversaPrioridade>(
    (conversa.prioridade as ConversaPrioridade) ?? "normal"
  );
  const [status, setStatus] = useState<ConversaStatus>(conversa.status);

  useEffect(() => {
    setResponsavel(conversa.responsavel_id ?? "none");
    setPrioridade((conversa.prioridade as ConversaPrioridade) ?? "normal");
    setStatus(conversa.status);
  }, [conversa.id]);

  useEffect(() => {
    if (!conversa.empresa_id) return;
    supabase.from("usuarios")
      .select("id,nome")
      .eq("empresa_id", conversa.empresa_id)
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => setUsuarios((data as any[]) || []));
  }, [conversa.empresa_id]);

  const update = async (patch: Partial<Conversa>) => {
    const { error } = await supabase.from("conversas").update(patch as any).eq("id", conversa.id);
    if (error) { toast.error(error.message); return false; }
    onChanged?.(patch);
    return true;
  };

  const onResponsavel = async (v: string) => {
    setResponsavel(v);
    const ok = await update({ responsavel_id: v === "none" ? null : v });
    if (ok) toast.success(v === "none" ? "Responsável removido" : "Responsável atualizado");
  };
  const onPrioridade = async (v: string) => {
    setPrioridade(v as ConversaPrioridade);
    const ok = await update({ prioridade: v as ConversaPrioridade });
    if (ok) toast.success("Prioridade atualizada");
  };
  const onStatus = async (v: string) => {
    setStatus(v as ConversaStatus);
    const ok = await update({ status: v as ConversaStatus });
    if (ok) toast.success("Status atualizado");
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Atendimento
      </h3>
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-[11px] flex items-center gap-1"><UserCircle2 className="h-3 w-3" /> Responsável</Label>
          <Select value={responsavel} onValueChange={onResponsavel}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem responsável</SelectItem>
              {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] flex items-center gap-1"><CircleDot className="h-3 w-3" /> Status</Label>
          <Select value={status} onValueChange={onStatus}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CONVERSA_STATUS_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] flex items-center gap-1"><Flag className="h-3 w-3" /> Prioridade</Label>
          <Select value={prioridade} onValueChange={onPrioridade}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORIDADE_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
