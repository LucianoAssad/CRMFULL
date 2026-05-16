import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";

interface Props {
  required: "manager" | "account";
  children: ReactNode;
}

export function ModeGuard({ required, children }: Props) {
  const { activeConta, modoSistema } = useActiveAccount();

  if (!activeConta) {
    return (
      <div className="m-6 rounded-md border bg-card p-6 text-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
          <div>
            <p className="font-medium">Selecione uma conta para continuar</p>
            <p className="text-muted-foreground">
              Use o seletor no topo para escolher uma {required === "manager" ? "conta gerente" : "conta filha"}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (modoSistema !== required) {
    return (
      <div className="m-6 rounded-md border border-amber-500/40 bg-amber-50 p-6 text-sm dark:bg-amber-950/20">
        <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div>
            <p className="font-medium">Acesso bloqueado</p>
            <p>
              {required === "manager"
                ? "Esta é uma rota de conta gerente. Selecione uma conta gerente para acessar."
                : "Esta é uma rota operacional. Selecione uma conta filha para acessar."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function ModeRedirect() {
  const { activeConta, modoSistema } = useActiveAccount();
  if (!activeConta) return <Navigate to="/account/dashboard" replace />;
  return <Navigate to={modoSistema === "manager" ? "/manager/dashboard" : "/account/dashboard"} replace />;
}
