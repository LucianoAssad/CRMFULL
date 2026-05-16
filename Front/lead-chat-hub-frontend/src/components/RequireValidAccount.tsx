import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { setActiveRole, type Role } from "@/lib/permissions";
import { fetchAccessibleAccounts } from "@/lib/accessible-accounts";
import { toast } from "sonner";

const VALID_ROLES: Role[] = [
  "super_admin","admin_gerente","gestor_gerente","admin_filha","gestor_filha","atendente","leitura",
];

type State = "checking" | "ok" | "no_account" | "no_link";

/**
 * Valida que o usuário autenticado possui acesso (direto ou herdado via
 * Conta Gerente) à conta ativa, e sincroniza o role efetivo.
 */
export function RequireValidAccount({ children }: { children: React.ReactNode }) {
  const { usuarioId, loading: authLoading } = useAuth();
  const { activeContaId } = useActiveAccount();
  const location = useLocation();
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (authLoading) return;
      if (!usuarioId) { setState("checking"); return; }
      if (!activeContaId) { setState("no_account"); return; }

      const acessiveis = await fetchAccessibleAccounts(usuarioId);
      if (cancelled) return;
      const match = acessiveis.find((c) => c.id === activeContaId);

      if (!match) {
        try {
          localStorage.removeItem("active_conta_id");
          localStorage.removeItem("active_role");
        } catch {}
        toast.error("Você não tem acesso a esta conta.");
        setState("no_link");
        return;
      }

      const realRole = (VALID_ROLES.includes(match.role) ? match.role : "leitura") as Role;
      let stored: string | null = null;
      try { stored = localStorage.getItem("active_role"); } catch {}
      if (stored !== realRole) {
        setActiveRole(realRole);
        window.dispatchEvent(new Event("active-role-changed"));
      }
      setState("ok");
    })();
    return () => { cancelled = true; };
  }, [usuarioId, activeContaId, authLoading, location.pathname]);

  if (state === "no_account" || state === "no_link") {
    return <Navigate to="/selecionar-conta" replace />;
  }
  if (state !== "ok") {
    return <div className="p-6 text-sm text-muted-foreground">Validando acesso…</div>;
  }
  return <>{children}</>;
}
