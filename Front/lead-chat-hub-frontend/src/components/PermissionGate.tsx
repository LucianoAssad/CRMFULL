import { ReactNode } from "react";
import { ShieldOff } from "lucide-react";
import { hasPermission, type PermissionAction } from "@/lib/permissions";

interface Props {
  action: PermissionAction;
  contaId?: string | null;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({ action, contaId, fallback, children }: Props) {
  if (hasPermission(action, contaId)) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  return null;
}

export function PermissionRoute({ action, contaId, children }: Props) {
  if (hasPermission(action, contaId)) return <>{children}</>;
  return (
    <div className="m-6 rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm">
      <div className="flex items-start gap-2 text-destructive">
        <ShieldOff className="mt-0.5 h-4 w-4" />
        <p className="font-medium">Você não tem permissão para acessar esta área.</p>
      </div>
    </div>
  );
}
