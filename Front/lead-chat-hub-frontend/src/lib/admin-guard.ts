import { supabase } from "@/integrations/supabase/client";

const ADMIN_ROLES = ["super_admin", "admin_gerente", "admin_filha"] as const;
const INHERITED_ADMIN_ROLES = ["super_admin", "admin_gerente"] as const;
type AdminRole = (typeof ADMIN_ROLES)[number];

interface UsuarioResolvido {
  usuarioId: string | null;
  authUserId: string | null;
  authEmail: string | null;
  source: "hint" | "email" | "auth_id" | "not_found";
  error?: any;
}

export interface AdminEfetivoResult {
  isAdmin: boolean;
  role: AdminRole | null;
  usuarioIdUsado: string | null;
  authUserId: string | null;
  authEmail: string | null;
  source: UsuarioResolvido["source"];
  viaContaId?: string | null;
  error?: any;
}

export interface GarantirAdminDiretoResult {
  ok: boolean;
  usuarioIdUsado: string | null;
  authUserId: string | null;
  authEmail: string | null;
  role: AdminRole;
  action: "already_active" | "reactivated" | "created" | "not_found" | "error";
  confirmed: boolean;
  directRows: any[];
  error?: any;
}

async function resolverUsuarioAplicacao(usuarioIdHint: string): Promise<UsuarioResolvido> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const authUserId = authData.user?.id ?? null;
  const authEmail = authData.user?.email ?? null;

  if (usuarioIdHint) {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id")
      .eq("id", usuarioIdHint)
      .maybeSingle();
    if (error) return { usuarioId: null, authUserId, authEmail, source: "not_found", error };
    if (data?.id) return { usuarioId: data.id, authUserId, authEmail, source: "hint" };
  }

  if (authEmail) {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id")
      .ilike("email", authEmail)
      .maybeSingle();
    if (error) return { usuarioId: null, authUserId, authEmail, source: "not_found", error };
    if (data?.id) return { usuarioId: data.id, authUserId, authEmail, source: "email" };
  }

  if (authUserId) {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id")
      .eq("id", authUserId)
      .maybeSingle();
    if (error) return { usuarioId: null, authUserId, authEmail, source: "not_found", error };
    if (data?.id) return { usuarioId: data.id, authUserId, authEmail, source: "auth_id" };
  }

  return { usuarioId: null, authUserId, authEmail, source: "not_found", error: authError ?? undefined };
}

/**
 * Verifica se uma conta possui pelo menos um usuário administrador direto
 * vinculado em usuarios_contas (ativo).
 */
export async function contaTemAdminDireto(contaId: string): Promise<boolean> {
  if (!contaId) return false;
  const { data, error } = await supabase
    .from("usuarios_contas")
    .select("id, role, ativo")
    .eq("conta_id", contaId)
    .eq("ativo", true)
    .in("role", ["admin_filha", "admin_gerente", "super_admin"]);
  if (error) return false;
  const rows = (data ?? []) as any[];
  return rows.length > 0;
}

/**
 * Retorna true se o usuário tem role administrativo efetivo na conta — direto
 * em usuarios_contas, ou herdado por uma Conta Gerente ancestral (hierarquia
 * principal de empresas.conta_gerente_id ou contas_vinculos ativos).
 */
export async function usuarioEhAdminEfetivo(
  usuarioId: string,
  contaId: string,
): Promise<AdminEfetivoResult> {
  const usuario = await resolverUsuarioAplicacao(usuarioId);
  const base = {
    usuarioIdUsado: usuario.usuarioId,
    authUserId: usuario.authUserId,
    authEmail: usuario.authEmail,
    source: usuario.source,
    error: usuario.error,
  };
  if (!usuario.usuarioId || !contaId) return { isAdmin: false, role: null, ...base };

  // 1) Vínculo direto
  const { data: direct, error: directError } = await supabase
    .from("usuarios_contas")
    .select("role")
    .eq("usuario_id", usuario.usuarioId)
    .eq("conta_id", contaId)
    .eq("ativo", true)
    .in("role", ADMIN_ROLES as any);
  if (directError) return { isAdmin: false, role: null, ...base, error: directError };
  const directRow = (direct ?? [])[0] as any;
  if (directRow) return { isAdmin: true, role: directRow.role, ...base, viaContaId: contaId };

  // 2) Super admin em qualquer conta
  const { data: anySuper, error: superError } = await supabase
    .from("usuarios_contas")
    .select("id")
    .eq("usuario_id", usuario.usuarioId)
    .eq("ativo", true)
    .eq("role", "super_admin")
    .limit(1);
  if (superError) return { isAdmin: false, role: null, ...base, error: superError };
  if ((anySuper ?? []).length > 0) return { isAdmin: true, role: "super_admin", ...base, viaContaId: null };

  // 3) Herança via ancestrais: monta conjunto de ancestrais (hierarquia + contas_vinculos)
  const ancestors = new Set<string>();
  const visit = async (id: string) => {
    if (ancestors.has(id)) return;
    ancestors.add(id);
    const [{ data: emp }, { data: vincs }] = await Promise.all([
      supabase.from("empresas").select("conta_gerente_id").eq("id", id).maybeSingle(),
      supabase
        .from("contas_vinculos" as any)
        .select("conta_gerente_id")
        .eq("conta_alvo_id", id)
        .eq("status", "ativo"),
    ]);
    const parents: string[] = [];
    const pai = (emp as any)?.conta_gerente_id;
    if (pai) parents.push(pai);
    for (const v of (vincs ?? []) as any[]) if (v.conta_gerente_id) parents.push(v.conta_gerente_id);
    for (const p of parents) await visit(p);
  };
  await visit(contaId);
  ancestors.delete(contaId);
  if (ancestors.size === 0) return { isAdmin: false, role: null, ...base };

  const { data: heritedRows, error: inheritedError } = await supabase
    .from("usuarios_contas")
    .select("role, conta_id")
    .eq("usuario_id", usuario.usuarioId)
    .eq("ativo", true)
    .in("role", INHERITED_ADMIN_ROLES as any)
    .in("conta_id", Array.from(ancestors));
  if (inheritedError) return { isAdmin: false, role: null, ...base, error: inheritedError };
  const hr = (heritedRows ?? [])[0] as any;
  if (hr) return { isAdmin: true, role: hr.role, ...base, viaContaId: hr.conta_id };

  return { isAdmin: false, role: null, ...base };
}

/**
 * Garante que o usuário tenha vínculo direto ativo na conta como administrador.
 * - Se já existir vínculo direto admin: nada a fazer.
 * - Se existir vínculo direto inativo ou de outro role: atualiza para admin e ativa.
 * - Se não existir: cria.
 *
 * Role atribuído conforme tipo da conta:
 * - filha => admin_filha
 * - gerente => admin_gerente
 */
export async function garantirAdminDireto(
  usuarioId: string,
  contaId: string,
  tipoConta: "gerente" | "filha",
): Promise<GarantirAdminDiretoResult> {
  const role: AdminRole = tipoConta === "gerente" ? "admin_gerente" : "admin_filha";
  const usuario = await resolverUsuarioAplicacao(usuarioId);
  const base = {
    usuarioIdUsado: usuario.usuarioId,
    authUserId: usuario.authUserId,
    authEmail: usuario.authEmail,
    role,
  };
  if (!usuario.usuarioId || !contaId) {
    return { ok: false, ...base, action: "not_found", confirmed: false, directRows: [], error: usuario.error };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("usuarios_contas")
    .select("id, role, ativo")
    .eq("usuario_id", usuario.usuarioId)
    .eq("conta_id", contaId)
    .order("ativo", { ascending: false })
    .limit(10);
  if (existingError) {
    return { ok: false, ...base, action: "error", confirmed: false, directRows: [], error: existingError };
  }

  let action: GarantirAdminDiretoResult["action"] = "created";
  const rowsExistentes = ((existingRows ?? []) as any[]);
  const adminAtivo = rowsExistentes.find((r) => r.ativo && ADMIN_ROLES.includes(r.role));
  const cur = adminAtivo ?? rowsExistentes[0];
  if (cur) {
    if (adminAtivo) action = "already_active";
    else {
      const { error } = await supabase
        .from("usuarios_contas")
        .update({ ativo: true, role })
        .eq("id", cur.id);
      if (error) return { ok: false, ...base, action: "error", confirmed: false, directRows: [], error };
      action = "reactivated";
    }
  } else {
    const { error } = await supabase.from("usuarios_contas").insert({
      usuario_id: usuario.usuarioId,
      conta_id: contaId,
      role,
      ativo: true,
    });
    if (error) return { ok: false, ...base, action: "error", confirmed: false, directRows: [], error };
  }

  const { data: directRows, error: confirmError } = await supabase
    .from("usuarios_contas")
    .select("id, usuario_id, conta_id, role, ativo")
    .eq("usuario_id", usuario.usuarioId)
    .eq("conta_id", contaId)
    .eq("ativo", true)
    .in("role", ADMIN_ROLES as any);
  if (confirmError) return { ok: false, ...base, action: "error", confirmed: false, directRows: [], error: confirmError };
  const rows = (directRows ?? []) as any[];
  return { ok: rows.length > 0, ...base, action, confirmed: rows.length > 0, directRows: rows };
}
