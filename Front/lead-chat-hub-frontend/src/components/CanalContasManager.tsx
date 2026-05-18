import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";

interface Vinculo {
  id: string;
  conta_filha_id: string;
  ativo: boolean;
  conta?: { id: string; nome: string; tipo_conta: string; ativo: boolean } | null;
}

interface Props {
  canalId: string;
  /** força reload externo */
  reloadKey?: number;
  onChanged?: () => void;
}

export function CanalContasManager({ canalId, reloadKey, onChanged }: Props) {
  const { contas, scopedContaIds } = useActiveAccount();
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [novaConta, setNovaConta] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const filhasDisponiveis = contas.filter(
    (c) => c.tipo_conta === "filha" && c.ativo && scopedContaIds.includes(c.id),
  );

  const load = async () => {
    // Fetch without join — backend doesn't support nested selects; enrich via contas context
    const { data } = await supabase
      .from("canal_contas" as any)
      .select("id, conta_filha_id, ativo")
      .eq("canal_conectado_id", canalId);
    const list = ((data as any) || []).map((v: any) => ({
      ...v,
      conta: contas.find((c) => c.id === v.conta_filha_id) ?? null,
    }));
    setVinculos(list);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [canalId, reloadKey]);

  const idsVinculados = new Set(vinculos.map((v) => v.conta_filha_id));
  const opcoes = filhasDisponiveis.filter((c) => !idsVinculados.has(c.id));

  const adicionar = async () => {
    if (!novaConta) return;
    const conta = contas.find((c) => c.id === novaConta);
    if (!conta || conta.tipo_conta !== "filha") {
      toast.error("Selecione uma conta filha válida.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("canal_contas" as any)
      .insert({ canal_conectado_id: canalId, conta_filha_id: novaConta, ativo: true });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setNovaConta("");
    toast.success("Conta vinculada");
    await load();
    onChanged?.();
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("canal_contas" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Vínculo removido");
    await load();
    onChanged?.();
  };

  const toggle = async (v: Vinculo) => {
    const { error } = await supabase
      .from("canal_contas" as any)
      .update({ ativo: !v.ativo })
      .eq("id", v.id);
    if (error) { toast.error(error.message); return; }
    await load();
    onChanged?.();
  };

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Contas filhas atendidas por este canal</h4>
        <Badge variant="outline">{vinculos.filter((v) => v.ativo).length} ativas</Badge>
      </div>

      {vinculos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma conta filha vinculada.</p>
      ) : (
        <ul className="space-y-1">
          {vinculos.map((v) => (
            <li key={v.id} className="flex items-center justify-between rounded border bg-background px-2 py-1.5 text-sm">
              <span className="truncate">
                {v.conta?.nome ?? v.conta_filha_id}
                {v.conta && !v.conta.ativo && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">conta inativa</Badge>
                )}
              </span>
              <div className="flex items-center gap-2">
                <Switch checked={v.ativo} onCheckedChange={() => toggle(v)} />
                <Button size="icon" variant="ghost" onClick={() => remover(v.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Select value={novaConta} onValueChange={setNovaConta}>
          <SelectTrigger className="h-8 flex-1 text-xs">
            <SelectValue placeholder={opcoes.length ? "Adicionar conta filha..." : "Sem contas filhas disponíveis"} />
          </SelectTrigger>
          <SelectContent>
            {opcoes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={adicionar} disabled={!novaConta || busy}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </div>
    </div>
  );
}
