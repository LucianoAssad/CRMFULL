import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Package, Plug, Users, ArrowRight } from "lucide-react";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";

export default function Onboarding() {
  const navigate = useNavigate();
  const { activeConta } = useActiveAccount();

  const concluidos = [
    "Empresa criada",
    "Usuário administrador criado",
    "Pipeline padrão criado",
    "Perfil comercial inicial criado",
  ];

  const pendentes = [
    {
      icon: Package,
      titulo: "Produtos",
      texto: "Cadastre os produtos usados nos orçamentos.",
      cta: "Cadastrar produtos",
      to: "/account/produtos",
    },
    {
      icon: Plug,
      titulo: "Canal de atendimento",
      texto: "Conecte WhatsApp, Webchat ou outro canal.",
      cta: "Conectar canal",
      to: "/account/conexoes",
    },
    {
      icon: Users,
      titulo: "Equipe",
      texto: "Convide atendentes, gestores e vendedores.",
      cta: "Convidar equipe",
      to: "/account/usuarios",
    },
  ];

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Bem-vindo ao Krescer SMKT</h1>
        <p className="text-sm text-muted-foreground">
          {activeConta?.nome ? `Conta: ${activeConta.nome}. ` : ""}
          Sua conta foi criada. Complete os próximos passos para começar a operar.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Concluídos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {concluidos.map((c) => (
            <div key={c} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" /> {c}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos passos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendentes.map(({ icon: Icon, titulo, texto, cta, to }) => (
            <div key={titulo} className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div className="flex items-start gap-3">
                <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="h-4 w-4" /> {titulo}
                  </p>
                  <p className="text-xs text-muted-foreground">{texto}</p>
                </div>
              </div>
              <Button size="sm" asChild>
                <Link to={to}>{cta}</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => navigate("/account/dashboard")}>
          Fazer isso depois
        </Button>
        <Button onClick={() => navigate("/account/atendimento")}>
          Ir para Atendimento <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </main>
  );
}
