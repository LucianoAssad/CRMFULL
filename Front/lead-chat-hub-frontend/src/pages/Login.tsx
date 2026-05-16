import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchAccessibleAccounts } from "@/lib/accessible-accounts";
import { toast } from "sonner";

export default function Login() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) routeAfterLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function routeAfterLogin() {
    const email = session?.user?.email;
    if (!email) return;
    const { data: usuario } = await supabase.from("usuarios").select("id").eq("email", email).maybeSingle();
    if (!usuario?.id) {
      toast.error("Usuário autenticado, mas sem cadastro vinculado.");
      return;
    }
    const acessiveis = await fetchAccessibleAccounts(usuario.id);
    if (acessiveis.length === 0) {
      toast.error("Nenhuma conta vinculada a este usuário.");
      return;
    }
    if (acessiveis.length === 1) {
      const c = acessiveis[0];
      const modo = c.tipo_conta === "gerente" ? "manager" : "account";
      localStorage.setItem("active_conta_id", c.id);
      localStorage.setItem("active_role", c.role);
      try { localStorage.setItem("modo_sistema", modo); } catch {}
      navigate(modo === "manager" ? "/manager/dashboard" : "/account/dashboard", { replace: true });
    } else {
      navigate("/selecionar-conta", { replace: true });
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) toast.error(error);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-6">
      <div className="grid w-full max-w-4xl gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">Entrar na sua conta</CardTitle>
            <p className="text-sm text-muted-foreground">Krescer SMKT</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Entrando..." : "Entrar"}
              </Button>
              <div className="flex items-center justify-between pt-2 text-sm">
                <a href="/recuperar-senha" className="text-muted-foreground underline-offset-4 hover:underline">
                  Esqueci minha senha
                </a>
                <a href="/cadastro" className="font-medium text-primary underline-offset-4 hover:underline">
                  Criar conta
                </a>
              </div>
              <p className="pt-1 text-center text-[11px] text-muted-foreground">Acesso seguro</p>
            </form>
          </CardContent>
        </Card>
        <Card className="hidden h-fit lg:block">
          <CardHeader>
            <CardTitle className="text-base">Krescer SMKT</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Atendimento Omnichannel</p>
            <p>• Orçamentos e Vendas</p>
            <p>• Gestão por conta</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
