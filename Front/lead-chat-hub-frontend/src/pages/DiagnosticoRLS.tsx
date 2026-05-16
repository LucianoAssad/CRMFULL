import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Usuario { id: string; nome: string; email: string }
interface Empresa { id: string; nome: string; codigo_publico: string | null; tipo_conta: string }

interface Diag {
  usuario_id: string;
  usuario_email: string | null;
  conta_id: string;
  tipo_conta: string | null;
  conta_gerente_id: string | null;
  caminho: Array<{ id: string; nome: string; codigo_publico: string | null; tipo_conta: string }>;
  app_user_id: string | null;
  role_on_conta: string | null;
  has_direct_access: boolean;
  has_conta: boolean;
  is_admin_for_conta: boolean;
  can_manage_users: boolean;
  can_manage_accounts: boolean;
  erro?: string;
}

function YesNo({ v }: { v: boolean }) {
  return v
    ? <Badge className="bg-success/15 text-success border-success/30">Permitido</Badge>
    : <Badge className="bg-destructive/15 text-destructive border-destructive/30">Bloqueado</Badge>;
}

export default function DiagnosticoRLS() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [contas, setContas] = useState<Empresa[]>([]);
  const [usuarioId, setUsuarioId] = useState<string>("");
  const [contaId, setContaId] = useState<string>("");
  const [diag, setDiag] = useState<Diag | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [u, e] = await Promise.all([
        supabase.from("usuarios").select("id, nome, email").eq("ativo", true).order("nome"),
        supabase.from("empresas").select("id, nome, codigo_publico, tipo_conta").eq("ativo", true).order("nome"),
      ]);
      setUsuarios(u.data || []);
      setContas(e.data || []);
    })();
  }, []);

  const rodar = async () => {
    if (!usuarioId || !contaId) return;
    setLoading(true);
    setDiag(null);
    const { data, error } = await supabase.rpc("diagnostico_rls", {
      _usuario_id: usuarioId,
      _conta_id: contaId,
    } as any);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setDiag(data as unknown as Diag);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Diagnóstico de RLS</h1>
        <p className="text-sm text-muted-foreground">
          Ferramenta técnica temporária. Simula as funções de acesso para qualquer usuário em qualquer conta. Não altera dados.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Parâmetros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <Label>Usuário</Label>
            <Select value={usuarioId} onValueChange={setUsuarioId}>
              <SelectTrigger><SelectValue placeholder="Selecione um usuário" /></SelectTrigger>
              <SelectContent>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nome} — {u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Conta</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger><SelectValue placeholder="Selecione uma conta" /></SelectTrigger>
              <SelectContent>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    [{c.tipo_conta}] {c.nome}{c.codigo_publico ? ` · ${c.codigo_publico}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Button onClick={rodar} disabled={!usuarioId || !contaId || loading}>
              {loading ? "Calculando..." : "Rodar diagnóstico"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {diag && !diag.erro && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Resultado</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Usuário:</span> <strong>{diag.usuario_email}</strong></div>
              <div><span className="text-muted-foreground">app_user_id():</span> <code>{diag.app_user_id || "—"}</code></div>
              <div><span className="text-muted-foreground">Tipo da conta:</span> <strong>{diag.tipo_conta}</strong></div>
              <div><span className="text-muted-foreground">conta_gerente_id:</span> <code>{diag.conta_gerente_id || "—"}</code></div>
              <div className="md:col-span-2">
                <span className="text-muted-foreground">Role direto na conta:</span>{" "}
                {diag.role_on_conta
                  ? <Badge variant="secondary">{diag.role_on_conta}</Badge>
                  : <span className="text-muted-foreground">nenhum</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-md border p-3">
                <span>user_has_direct_access</span><YesNo v={diag.has_direct_access} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <span>user_has_conta</span><YesNo v={diag.has_conta} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <span>user_is_admin_for_conta</span><YesNo v={diag.is_admin_for_conta} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <span>user_can_manage_users</span><YesNo v={diag.can_manage_users} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3 md:col-span-2">
                <span>user_can_manage_accounts</span><YesNo v={diag.can_manage_accounts} />
              </div>
            </div>

            <div className="rounded-md border-2 p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Resultado final</div>
                <div className="text-sm text-muted-foreground">
                  Acesso efetivo do usuário à conta (user_has_conta)
                </div>
              </div>
              <YesNo v={diag.has_conta} />
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-2">Caminho hierárquico (folha → raiz):</div>
              <div className="flex flex-wrap gap-2">
                {(diag.caminho || []).map((c, i, arr) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <Badge variant="outline">
                      [{c.tipo_conta}] {c.nome}{c.codigo_publico ? ` · ${c.codigo_publico}` : ""}
                    </Badge>
                    {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
                  </div>
                ))}
                {(!diag.caminho || diag.caminho.length === 0) && (
                  <span className="text-sm text-muted-foreground">Conta não encontrada.</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {diag?.erro && (
        <Card><CardContent className="p-4 text-destructive">{diag.erro}</CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Cenários recomendados para teste</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Use a hierarquia Doutor Sofá. Selecione o usuário no topo, depois clique em uma conta abaixo para diagnosticar.
          </p>

          {[
            {
              titulo: "Admin Brasil (admin_gerente em Doutor Sofá Brasil)",
              casos: [
                ["Doutor Sofá Brasil", "Permitido"],
                ["Doutor Sofá Rio de Janeiro", "Permitido"],
                ["Barra", "Permitido"],
                ["Ipanema", "Permitido"],
                ["RJ Zona Norte", "Permitido"],
              ] as const,
            },
            {
              titulo: "Admin RJ (admin_gerente em Doutor Sofá Rio de Janeiro)",
              casos: [
                ["Doutor Sofá Rio de Janeiro", "Permitido"],
                ["Barra", "Permitido"],
                ["Ipanema", "Permitido"],
                ["Doutor Sofá Brasil", "Bloqueado"],
              ] as const,
            },
            {
              titulo: "Atendente Barra (atendente em Barra)",
              casos: [
                ["Barra", "Permitido"],
                ["Ipanema", "Bloqueado"],
                ["Doutor Sofá Rio de Janeiro", "Bloqueado"],
                ["Doutor Sofá Brasil", "Bloqueado"],
              ] as const,
            },
          ].map((g) => (
            <div key={g.titulo} className="rounded-md border p-3">
              <div className="font-medium mb-2">{g.titulo}</div>
              <ul className="space-y-1">
                {g.casos.map(([conta, esperado]) => {
                  const c = contas.find((x) => x.nome === conta);
                  return (
                    <li key={conta} className="flex items-center justify-between gap-2">
                      <button
                        className="text-left underline-offset-2 hover:underline disabled:opacity-50 disabled:no-underline"
                        disabled={!c || !usuarioId}
                        onClick={() => { if (c) { setContaId(c.id); setTimeout(rodar, 0); } }}
                      >
                        {conta} {c ? "" : <span className="text-muted-foreground">(não encontrada)</span>}
                      </button>
                      <Badge variant="outline" className={
                        esperado === "Permitido"
                          ? "border-success/40 text-success"
                          : "border-destructive/40 text-destructive"
                      }>
                        esperado: {esperado}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
