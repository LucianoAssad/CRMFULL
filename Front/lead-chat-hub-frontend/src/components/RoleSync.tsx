import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { setActiveRole, type Role } from "@/lib/permissions";
import { fetchAccessibleAccounts } from "@/lib/accessible-accounts";

const VALID: Role[] = [
  "super_admin","admin_gerente","gestor_gerente","admin_filha","gestor_filha","atendente","leitura",
];

/**
 * Mantém localStorage("active_role") sincronizado com o role real
 * do usuário autenticado na conta ativa (usuarios_contas.role).
 * hasPermission() é síncrono e lê desse storage.
 */
export function RoleSync() {
  const { usuarioId } = useAuth();
  const { activeContaId } = useActiveAccount();

  useEffect(() => {
    let cancelled = false;
    const syncRole = async () => {
      if (!usuarioId || !activeContaId) {
        // sem sessão/conta: limpa role efetivo
        try { localStorage.removeItem("active_role"); } catch {}
        return;
      }
      const acessiveis = await fetchAccessibleAccounts(usuarioId);
      if (cancelled) return;
      const match = acessiveis.find((c) => c.id === activeContaId);
      const role = (match?.role as Role) ?? "leitura";
      const safe = VALID.includes(role) ? role : "leitura";
      setActiveRole(safe);
      // dispara um pequeno evento para componentes que cachearam permissões
      window.dispatchEvent(new Event("active-role-changed"));
    };
    syncRole();
    window.addEventListener("usuarios-contas-changed", syncRole);
    return () => {
      cancelled = true;
      window.removeEventListener("usuarios-contas-changed", syncRole);
    };
  }, [usuarioId, activeContaId]);

  return null;
}
