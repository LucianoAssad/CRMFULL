import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Fallback para qualquer rota legada/desconhecida fora dos prefixos oficiais.
 * - Sem sessão: "/login"
 * - Sem conta ativa: "/selecionar-conta"
 * - Conta gerente: "/manager/dashboard"
 * - Conta filha:   "/account/dashboard"
 */
export function LegacyRedirect() {
  const { session, loading } = useAuth();
  const [tipo, setTipo] = useState<"gerente" | "filha" | null | undefined>(undefined);

  const activeId = (() => { try { return localStorage.getItem("active_conta_id"); } catch { return null; } })();

  useEffect(() => {
    if (!activeId) { setTipo(null); return; }
    supabase.from("empresas").select("tipo_conta").eq("id", activeId).maybeSingle()
      .then(({ data }) => setTipo((data?.tipo_conta as any) ?? null));
  }, [activeId]);

  if (loading || tipo === undefined) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (!activeId || tipo === null) return <Navigate to="/selecionar-conta" replace />;
  return <Navigate to={tipo === "gerente" ? "/manager/dashboard" : "/account/dashboard"} replace />;
}
