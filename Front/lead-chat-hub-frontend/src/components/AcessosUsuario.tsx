import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export type AcessoRole =
  | "super_admin"
  | "admin_gerente"
  | "gestor_gerente"
  | "admin_filha"
  | "gestor_filha"
  | "atendente"
  | "leitura";

export const ACESSO_ROLE_LABEL: Record<AcessoRole, string> = {
  super_admin: "Super Admin",
  admin_gerente: "Admin Gerente",
  gestor_gerente: "Gestor Gerente",
  admin_filha: "Admin Filha",
  gestor_filha: "Gestor Filha",
  atendente: "Atendente",
  leitura: "Leitura",
};

interface Conta {
  id: string;
  nome: string;
  tipo_conta: "gerente" | "filha";
}

interface Acesso {
  id: string;
  usuario_id: string;
  conta_id: string;
  role: AcessoRole;
  ativo: boolean;
  conta?: Conta;
}

interface Props {
  usuarioId: string;
}

export function AcessosUsuario({ usuarioId }: Props) {
  const [contas, setContas] = useState<Conta[]>([]);
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [novoConta, setNovoConta] = useState<string>("");
  const [novoRole, setNovoRole] = useState<AcessoRole>("atendente");

  const load = async () => {
    const [c, a] = await Promise.all([
      supabase.from("empresas").select("id, nome, tipo_conta").order("nome"),
      supabase.from("usuarios_contas").select("*").eq("usuario_id", usuarioId),
    ]);
    if (c.error) toast.error(c.error.message);
    if (a.error) toast.error(a.error.message);
    const contasData: any[] = (c.data as any) || [];
    const contasMap: Record<string, { id: string; nome: string; tipo_conta: string }> = {};
    for (const x of contasData) contasMap[x.id] = x;
    const acessosRaw: any[] = (a.data as any) || [];
    const acessosEnrichidos = acessosRaw.map((ac) => ({
      ...ac,
      conta: contasMap[ac.conta_id] ?? null,
    }));
    setContas(contasData);
    setAcessos(acessosEnrichidos);
  };

  useEffect(() => { load(); }, [usuarioId]);

  const adicionar = async () => {
    if (!novoConta) { toast.error("Selecione uma conta"); return; }
    if (acessos.some((x) => x.conta_id === novoConta)) {
      toast.error("Usuário já tem acesso a esta conta");
      return;
    }
    const { error } = await supabase.from("usuarios_contas").insert({
      usuario_id: usuarioId,
      conta_id: novoConta,
      role: novoRole,
      ativo: true,
    });
    if (error) { toast.error(error.message); return; }
    setNovoConta("");
    load();
  };

  const updateRole = async (id: string, role: AcessoRole) => {
    const { error } = await supabase.from("usuarios_contas").update({ role }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const toggle = async (a: Acesso) => {
    const { error } = await supabase.from("usuarios_contas").update({ ativo: !a.ativo }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("usuarios_contas").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="text-sm font-medium">Acessos</div>

      <div className="flex gap-2">
        <Select value={novoConta} onValueChange={setNovoConta}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
          <SelectContent>
            {contas.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome} {c.tipo_conta === "gerente" && <span className="text-xs text-muted-foreground">(gerente)</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={novoRole} onValueChange={(v) => setNovoRole(v as AcessoRole)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(ACESSO_ROLE_LABEL) as AcessoRole[]).map((r) => (
              <SelectItem key={r} value={r}>{ACESSO_ROLE_LABEL[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" onClick={adicionar}><Plus className="h-4 w-4" /></Button>
      </div>

      {acessos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum acesso cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {acessos.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-md border p-2">
              <div className="flex-1">
                <div className="text-sm font-medium">{a.conta?.nome ?? "—"}</div>
                <Badge variant="outline" className="mt-1 text-[10px]">
                  {a.conta?.tipo_conta === "gerente" ? "Gerente" : "Filha"}
                </Badge>
              </div>
              <Select value={a.role} onValueChange={(v) => updateRole(a.id, v as AcessoRole)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ACESSO_ROLE_LABEL) as AcessoRole[]).map((r) => (
                    <SelectItem key={r} value={r}>{ACESSO_ROLE_LABEL[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Switch checked={a.ativo} onCheckedChange={() => toggle(a)} />
              <Button type="button" size="icon" variant="ghost" onClick={() => remover(a.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
