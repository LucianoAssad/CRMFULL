import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.VITE_API_URL || "https://daring-balance-production-fc0c.up.railway.app/api";

export interface SignupInput {
  empresa_nome: string;
  tipo_conta: "gerente" | "filha";
  empresa_email?: string;
  empresa_telefone?: string;
  admin_nome: string;
  admin_email: string;
  admin_senha: string;
}

export interface SignupResult {
  empresa_id: string;
  usuario_id: string;
  tipo_conta: "gerente" | "filha";
}

export async function criarContaCompleta(input: SignupInput): Promise<SignupResult> {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      empresaNome: input.empresa_nome,
      tipoConta: input.tipo_conta,
      empresaEmail: input.empresa_email ?? null,
      empresaTelefone: input.empresa_telefone ?? null,
      adminNome: input.admin_nome,
      adminEmail: input.admin_email,
      adminSenha: input.admin_senha,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any)?.error ?? `Erro ${res.status} ao criar conta`);
  }

  const data = await res.json();

  // Armazena tokens para autenticação imediata
  try {
    localStorage.setItem("access_token", data.accessToken);
    localStorage.setItem("refresh_token", data.refreshToken);
    window.dispatchEvent(new Event("auth:session-changed"));
  } catch {}

  return {
    empresa_id: data.empresaId,
    usuario_id: data.usuarioId,
    tipo_conta: data.tipoConta as "gerente" | "filha",
  };
}
