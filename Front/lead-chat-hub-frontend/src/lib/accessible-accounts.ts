import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/permissions";

export interface AccessibleAccount {
  id: string;
  nome: string;
  tipo_conta: "gerente" | "filha";
  conta_gerente_id: string | null;
  codigo_publico: string | null;
  ativo: boolean;
  role: Role;
  source: "direct" | "inherited";
  via_conta_id?: string | null;
  via_conta_nome?: string | null;
}

interface EmpresaRow {
  id: string;
  nome: string;
  tipo_conta: "gerente" | "filha";
  conta_gerente_id: string | null;
  codigo_publico: string | null;
  ativo: boolean;
}

/**
 * Retorna a lista efetiva de contas acessíveis pelo usuário, considerando:
 * - Vínculos diretos em usuarios_contas (ativos)
 * - Herança: se o vínculo direto é em uma Conta Gerente, inclui todos os
 *   descendentes (filhas e sub-gerentes) com o mesmo role.
 *
 * Não inclui ancestrais sem vínculo direto.
 */
export async function fetchAccessibleAccounts(usuarioId: string): Promise<AccessibleAccount[]> {
  const [vinculosRes, empresasRes, contasVincRes] = await Promise.all([
    supabase
      .from("usuarios_contas")
      .select("conta_id, role, ativo")
      .eq("usuario_id", usuarioId)
      .eq("ativo", true),
    supabase
      .from("empresas")
      .select("id, nome, tipo_conta, conta_gerente_id, codigo_publico, ativo")
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("contas_vinculos" as any)
      .select("conta_gerente_id, conta_alvo_id, status")
      .eq("status", "ativo"),
  ]);

  const empresas = (empresasRes.data ?? []) as EmpresaRow[];
  const vinculos = (vinculosRes.data ?? []) as { conta_id: string; role: Role }[];

  // Super Admin: acesso global a todas as contas (independente de usuarios_contas).
  const isSuperAdmin = vinculos.some((v) => v.role === "super_admin");
  if (isSuperAdmin) {
    return empresas
      .map<AccessibleAccount>((e) => ({
        ...e,
        role: "super_admin",
        source: "direct",
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }
  const vincAdic = ((contasVincRes.data ?? []) as any[]) as { conta_gerente_id: string; conta_alvo_id: string }[];

  const byId: Record<string, EmpresaRow> = {};
  const childrenMap: Record<string, EmpresaRow[]> = {};
  for (const e of empresas) {
    byId[e.id] = e;
    if (e.conta_gerente_id) (childrenMap[e.conta_gerente_id] ||= []).push(e);
  }
  // vínculos adicionais agem como "filhos virtuais" para herança de acesso
  for (const v of vincAdic) {
    const alvo = byId[v.conta_alvo_id];
    if (alvo) (childrenMap[v.conta_gerente_id] ||= []).push(alvo);
  }

  const result: Record<string, AccessibleAccount> = {};

  for (const v of vinculos) {
    const conta = byId[v.conta_id];
    if (!conta) continue;
    // direto sempre prevalece
    result[conta.id] = {
      ...conta,
      role: v.role,
      source: "direct",
    };
    // se gerente, herda para descendentes
    if (conta.tipo_conta === "gerente") {
      const stack = [conta.id];
      const seen = new Set<string>([conta.id]);
      while (stack.length) {
        const cur = stack.pop()!;
        for (const child of childrenMap[cur] || []) {
          if (seen.has(child.id)) continue;
          seen.add(child.id);
          stack.push(child.id);
          if (!result[child.id] || result[child.id].source !== "direct") {
            result[child.id] = {
              ...child,
              role: v.role,
              source: "inherited",
              via_conta_id: conta.id,
              via_conta_nome: conta.nome,
            };
          }
        }
      }
    }
  }

  return Object.values(result).sort((a, b) => a.nome.localeCompare(b.nome));
}
