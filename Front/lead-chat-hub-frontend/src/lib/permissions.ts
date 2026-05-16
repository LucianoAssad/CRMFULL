// Camada de permissões por role e contexto.
// Sem autenticação real ainda: o role efetivo vem de localStorage("active_role")
// e por padrão é "super_admin" para não quebrar telas existentes.

export type Role =
  | "super_admin"
  | "admin_gerente"
  | "gestor_gerente"
  | "admin_filha"
  | "gestor_filha"
  | "atendente"
  | "leitura";

export type PermissionAction =
  | "view_dashboard"
  | "manage_accounts"
  | "manage_accounts_destructive" // editar/desvincular/transferir/excluir contas
  | "manage_users"
  | "view_crm"
  | "manage_crm"
  | "send_message"
  | "manage_products"
  | "manage_pipeline"
  | "manage_connections"
  | "manage_templates"
  | "manage_conversions"
  | "view_reports"
  | "manage_sales"
  | "manage_campaigns"
  | "manage_imports";

const ROLE_PERMISSIONS: Record<Role, PermissionAction[]> = {
  super_admin: [
    "view_dashboard","manage_accounts","manage_accounts_destructive","manage_users",
    "view_crm","manage_crm","send_message","manage_products","manage_pipeline",
    "manage_connections","manage_templates","manage_conversions","view_reports","manage_sales","manage_campaigns","manage_imports",
  ],
  admin_gerente: [
    "view_dashboard","manage_accounts","manage_accounts_destructive","manage_users",
    "manage_templates","manage_conversions","view_reports","manage_campaigns",
    "view_crm","manage_crm","send_message","manage_products","manage_pipeline",
    "manage_connections","manage_sales","manage_imports",
  ],
  gestor_gerente: [
    "view_dashboard","view_reports","manage_conversions","manage_campaigns",
    "view_crm","manage_crm","send_message","manage_products","manage_pipeline","manage_sales","manage_imports",
  ],
  admin_filha: [
    "view_dashboard","manage_users","view_crm","manage_crm","send_message",
    "manage_products","manage_pipeline","manage_connections","manage_templates",
    "manage_conversions","view_reports","manage_sales","manage_campaigns","manage_imports",
  ],
  gestor_filha: [
    "view_dashboard","view_crm","manage_crm","send_message","manage_products",
    "manage_pipeline","manage_templates","manage_conversions","view_reports","manage_sales","manage_campaigns","manage_imports",
  ],
  atendente: [
    "view_dashboard","view_crm","manage_crm","send_message","manage_sales",
  ],
  leitura: [
    "view_dashboard","view_crm","view_reports","manage_conversions",
  ],
};

const STORAGE_KEY = "active_role";

export function getActiveRole(): Role {
  try {
    const r = localStorage.getItem(STORAGE_KEY) as Role | null;
    if (r && r in ROLE_PERMISSIONS) return r;
  } catch { /* ignore */ }
  // Sem role definido: fallback restritivo (somente leitura).
  return "leitura";
}

export function setActiveRole(role: Role) {
  try { localStorage.setItem(STORAGE_KEY, role); } catch { /* ignore */ }
}

export function hasPermission(action: PermissionAction, _contaId?: string | null): boolean {
  const role = getActiveRole();
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(action);
}

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  admin_gerente: "Admin Gerente",
  gestor_gerente: "Gestor Gerente",
  admin_filha: "Admin Filha",
  gestor_filha: "Gestor Filha",
  atendente: "Atendente",
  leitura: "Leitura",
};

export const ALL_ROLES: Role[] = [
  "super_admin","admin_gerente","gestor_gerente","admin_filha","gestor_filha","atendente","leitura",
];
