import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, Building2, MessageCircle, LogOut, LayoutDashboard, ShieldCheck, Globe } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function Home() {
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeContaId, setActiveContaId] = useState<string | null>(null);
  const [activeContaTipo, setActiveContaTipo] = useState<"gerente" | "filha" | null>(null);

  useEffect(() => {
    try {
      const id = localStorage.getItem("active_conta_id");
      setActiveContaId(id);
      if (!id) { setActiveContaTipo(null); return; }
      supabase.from("empresas").select("tipo_conta").eq("id", id).maybeSingle()
        .then(({ data }) => setActiveContaTipo((data?.tipo_conta as any) ?? null));
    } catch { /* ignore */ }
  }, [session?.user?.id]);

  const handleLogout = async () => {
    await signOut();
    setActiveContaId(null);
    setActiveContaTipo(null);
    navigate("/", { replace: true });
  };

  const dashboardPath = activeContaTipo === "gerente" ? "/manager/dashboard" : "/account/dashboard";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-gradient-to-br from-background to-muted p-6">
      <header className="text-center">
        <h1 className="text-5xl font-bold tracking-tight">Krescer SMKT</h1>
        {!loading && (
          session ? (
            <p className="mt-3 text-muted-foreground">
              Você está conectado como <span className="font-medium text-foreground">{session.user.email}</span>
            </p>
          ) : (
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Plataforma de atendimento, CRM, vendas e campanhas para equipes comerciais.
            </p>
          )
        )}
      </header>

      {!loading && session && activeContaId && (
        <Button asChild size="lg" variant="secondary">
          <Link to={dashboardPath}>
            <LayoutDashboard className="mr-2 h-5 w-5" />
            Acessar painel atual
          </Link>
        </Button>
      )}

      {!loading && (
        <div className="grid w-full max-w-4xl gap-6 sm:grid-cols-2">
          {session ? (
            <Card className="flex flex-col">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <CardTitle>Continuar no Krescer SMKT</CardTitle>
                <CardDescription>
                  Escolha uma conta gerente ou conta filha para acessar o painel de gestão.
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild className="w-full">
                  <Link to="/selecionar-conta">
                    <Building2 className="mr-2 h-4 w-4" />
                    Selecionar conta
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex flex-col">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <CardTitle>Entrar no SaaS</CardTitle>
                <CardDescription>
                  Acesse o painel para gerenciar contas, atendimentos, leads, vendas, campanhas e conversões.
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild className="w-full">
                  <Link to="/login">
                    <LogIn className="mr-2 h-4 w-4" />
                    Entrar no SaaS
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="flex flex-col border-dashed">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Globe className="h-5 w-5" />
              </div>
              <CardTitle>Testar Webchat</CardTitle>
              <CardDescription>
                {session
                  ? "Abra o canal público de webchat para simular uma nova conversa."
                  : "Simule a entrada de um lead pelo chat do site."}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild variant="outline" className="w-full">
                <Link to="/webchat">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Abrir Webchat
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && session && (
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      )}
    </main>
  );
}
