import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCodigoPublico } from "@/lib/codigo-publico";
import { fetchAccessibleAccounts, type AccessibleAccount } from "@/lib/accessible-accounts";
import { ROLE_LABEL } from "@/lib/permissions";

export default function SelecionarConta() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [contas, setContas] = useState<AccessibleAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user?.email) { setLoading(false); return; }
      const { data: usuario } = await supabase.from("usuarios").select("id").eq("email", user.email).maybeSingle();
      if (!usuario) { setLoading(false); return; }
      const lista = await fetchAccessibleAccounts(usuario.id);
      setContas(lista);
      setLoading(false);
    })();
  }, [user?.email]);

  const escolher = (c: AccessibleAccount) => {
    localStorage.setItem("active_conta_id", c.id);
    localStorage.setItem("active_role", c.role);
    const modo = c.tipo_conta === "gerente" ? "manager" : "account";
    try { localStorage.setItem("modo_sistema", modo); } catch {}
    navigate(modo === "manager" ? "/manager/dashboard" : "/account/dashboard", { replace: true });
  };

  const gerentes = contas.filter((c) => c.tipo_conta === "gerente");
  const filhas = contas.filter((c) => c.tipo_conta === "filha");

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Selecione uma conta</h1>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate("/login", { replace: true }); }}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!loading && contas.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma conta vinculada.</p>
        )}

        {gerentes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Contas Gerente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {gerentes.map((c) => (
                <ItemRow key={c.id} conta={c} onSelect={() => escolher(c)} />
              ))}
            </CardContent>
          </Card>
        )}

        {filhas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Contas Filha</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {filhas.map((c) => (
                <ItemRow key={c.id} conta={c} onSelect={() => escolher(c)} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

function ItemRow({ conta, onSelect }: { conta: AccessibleAccount; onSelect: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-3">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{conta.nome}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {formatCodigoPublico(conta.codigo_publico)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              {ROLE_LABEL[conta.role] ?? conta.role}
            </Badge>
          </div>
        </div>
      </div>
      <Button size="sm" onClick={onSelect}>Acessar</Button>
    </div>
  );
}
