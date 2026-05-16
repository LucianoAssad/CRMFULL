import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Detecta se o usuário logado tem role "super_admin" em qualquer
 * vínculo ativo em usuarios_contas.
 *
 * No MVP, super_admin é um papel global da plataforma e é gerenciado
 * manualmente no banco — não pelas telas de Acesso e segurança.
 */
export function useIsSuperAdmin(): { isSuperAdmin: boolean; loading: boolean } {
  const { usuarioId } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!usuarioId) {
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("usuarios_contas")
      .select("id")
      .eq("usuario_id", usuarioId)
      .eq("ativo", true)
      .eq("role", "super_admin")
      .limit(1)
      .then(({ data }) => {
        if (cancelled) return;
        setIsSuperAdmin((data ?? []).length > 0);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [usuarioId]);

  return { isSuperAdmin, loading };
}

export async function checkIsSuperAdmin(usuarioId: string | null): Promise<boolean> {
  if (!usuarioId) return false;
  const { data } = await supabase
    .from("usuarios_contas")
    .select("id")
    .eq("usuario_id", usuarioId)
    .eq("ativo", true)
    .eq("role", "super_admin")
    .limit(1);
  return (data ?? []).length > 0;
}
