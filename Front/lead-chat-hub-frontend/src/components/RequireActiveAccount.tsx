import { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";

export function RequireActiveAccount({ children }: { children: ReactNode }) {
  const { activeConta, loading } = useActiveAccount();
  if (loading) return null;
  if (!activeConta) {
    return (
      <div className="m-6 rounded-md border bg-card p-6 text-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
          <div>
            <p className="font-medium">Selecione uma conta para continuar</p>
            <p className="text-muted-foreground">
              Use o seletor de contas no topo para escolher uma conta ativa.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
