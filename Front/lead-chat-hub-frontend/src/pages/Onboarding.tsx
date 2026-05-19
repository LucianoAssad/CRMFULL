import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Package, Plug, Users, ArrowRight, Loader2 } from "lucide-react";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { supabase } from "@/integrations/supabase/client";

interface Step {
  key: string;
  icon: React.ElementType;
  titulo: string;
  texto: string;
  cta: string;
  to: string;
  concluido: boolean;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { activeConta } = useActiveAccount();
  const empresaId = activeConta?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [temProdutos, setTemProdutos] = useState(false);
  const [temCanal, setTemCanal] = useState(false);
  const [temEquipe, setTemEquipe] = useState(false);

  useEffect(() => {
    if (!empresaId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const [p, c, u] = await Promise.all([
        supabase.from("produtos_servicos").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("ativo", true),
        supabase.from("canais_conectados").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("ativo", true),
        supabase.from("usuarios_contas").select("id", { count: "exact", head: true }).eq("conta_id", empresaId).eq("ativo", true),
      ]);
      setTemProdutos((p.count ?? 0) > 0);
      setTemCanal((c.count ?? 0) > 0);
      setTemEquipe((u.count ?? 0) > 1); // > 1 porque o próprio admin já conta
      setLoading(false);
    })();
  }, [empresaId]);

  const concluidos = [
    "Empresa criada",
    "Usuário administrador criado",
    "Vínculo de acesso configurado",
    "Pipeline padrão criado",
    "Perfil comercial inicial criado",
  ];

  const steps: Step[] = [
    {
      key: "produtos",
      icon: Package,
      titulo: "Produtos e serviços",
      texto: "Cadastre os produtos usados em orçamentos e oportunidades.",
      cta: "Cadastrar produtos",
      to: "/account/produtos",
      concluido: temProdutos,
    },
    {
      key: "canal",
      icon: Plug,
      titulo: "Canal de atendimento",
      texto: "Conecte WhatsApp, Webchat ou outro canal.",
      cta: "Conectar canal",
      to: "/account/conexoes",
      concluido: temCanal,
    },
    {
      key: "equipe",
      icon: Users,
      titulo: "Equipe",
      texto: "Convide atendentes, gestores e vendedores.",
      cta: "Convidar equipe",
      to: "/account/usuarios",
      concluido: temEquipe,
    },
  ];

  const totalConcluidos = steps.filter((s) => s.concluido).length;
  const progresso = Math.round(((totalConcluidos + concluidos.length) / (steps.length + concluidos.length)) * 100);
  const tudoConcluido = totalConcluidos === steps.length;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {tudoConcluido ? "🎉 Conta configurada!" : "Bem-vindo ao Krescer SMKT"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {activeConta?.nome ? `Conta: ${activeConta.nome}. ` : ""}
          {tudoConcluido
            ? "Todos os passos foram concluídos. Sua conta está pronta para operar."
            : "Complete os próximos passos para começar a operar."}
        </p>
      </header>

      {/* Barra de progresso */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso de configuração</span>
            <span className="font-semibold">{progresso}%</span>
          </div>
          <Progress value={progresso} className="h-2" />
        </CardContent>
      </Card>

      {/* Itens concluídos automaticamente */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Concluído automaticamente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {concluidos.map((c) => (
            <div key={c} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              <span>{c}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Próximos passos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Próximos passos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando...
            </div>
          ) : (
            steps.map(({ key, icon: Icon, titulo, texto, cta, to, concluido }) => (
              <div
                key={key}
                className={`flex items-center justify-between gap-4 rounded-md border p-3 transition-colors ${
                  concluido ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  {concluido ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="h-4 w-4" /> {titulo}
                      {concluido && <span className="text-[10px] text-green-600 font-normal">✓ concluído</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{texto}</p>
                  </div>
                </div>
                <Button size="sm" variant={concluido ? "outline" : "default"} asChild>
                  <Link to={to}>{concluido ? "Ver" : cta}</Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => navigate("/account/dashboard")}>
          {tudoConcluido ? "Ir ao Dashboard" : "Fazer isso depois"}
        </Button>
        <Button onClick={() => navigate("/account/atendimento")}>
          Ir para Atendimento <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </main>
  );
}
