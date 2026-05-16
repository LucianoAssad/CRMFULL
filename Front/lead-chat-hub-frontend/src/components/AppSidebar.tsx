import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Inbox, Building2, Users, Plug, Package, GitBranch, Target, FileText, Settings, ShoppingCart, Megaphone, Upload,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { formatCodigoPublico } from "@/lib/codigo-publico";

import { hasPermission, type PermissionAction } from "@/lib/permissions";

type Item = { title: string; url: string; icon: any; perm: PermissionAction };

const managerItems: Item[] = [
  { title: "Dashboard Geral", url: "/manager/dashboard", icon: LayoutDashboard, perm: "view_dashboard" },
  { title: "Contas", url: "/manager/contas", icon: Building2, perm: "manage_accounts" },
  { title: "Acesso e segurança", url: "/manager/usuarios", icon: Users, perm: "manage_users" },
  { title: "Campanhas", url: "/manager/campanhas", icon: Megaphone, perm: "manage_campaigns" },
  { title: "Templates", url: "/manager/templates", icon: FileText, perm: "manage_templates" },
  { title: "Importações", url: "/manager/importacoes", icon: Upload, perm: "manage_accounts" },
  { title: "Conversões", url: "/manager/conversoes", icon: Target, perm: "manage_conversions" },
  { title: "Configurações", url: "/manager/configuracoes", icon: Settings, perm: "view_dashboard" },
];

const accountItems: Item[] = [
  { title: "Dashboard", url: "/account/dashboard", icon: LayoutDashboard, perm: "view_dashboard" },
  { title: "Atendimento", url: "/account/atendimento", icon: Inbox, perm: "view_crm" },
  { title: "Leads/Clientes", url: "/account/leads", icon: Users, perm: "view_crm" },
  { title: "Conexões", url: "/account/conexoes", icon: Plug, perm: "manage_connections" },
  { title: "Produtos", url: "/account/produtos", icon: Package, perm: "manage_products" },
  { title: "Pipeline", url: "/account/pipeline", icon: GitBranch, perm: "manage_pipeline" },
  { title: "Vendas", url: "/account/vendas", icon: ShoppingCart, perm: "manage_sales" },
  { title: "Conversões", url: "/account/conversoes", icon: Target, perm: "manage_conversions" },
  { title: "Templates", url: "/account/templates", icon: FileText, perm: "manage_templates" },
  { title: "Campanhas", url: "/account/campanhas", icon: Megaphone, perm: "manage_campaigns" },
  { title: "Importações", url: "/account/importacoes", icon: Upload, perm: "manage_imports" },
  { title: "Acesso e segurança", url: "/account/usuarios", icon: Users, perm: "manage_users" },
  { title: "Configurações", url: "/account/configuracoes", icon: Settings, perm: "view_dashboard" },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { activeConta, modoSistema } = useActiveAccount();

  // Re-render quando o role efetivo mudar (RoleSync dispara este evento)
  const [, setRoleTick] = useState(0);
  useEffect(() => {
    const h = () => setRoleTick((n) => n + 1);
    window.addEventListener("active-role-changed", h);
    return () => window.removeEventListener("active-role-changed", h);
  }, []);

  // Fonte da verdade: modo da conta ativa (não a rota atual)
  const baseItems = modoSistema === "manager" ? managerItems : accountItems;
  const isFilha = activeConta?.tipo_conta === "filha";
  const items = baseItems.filter((it) => {
    // Atendimento só aparece em Conta Filha (modo account), sem depender de permissão granular
    if (it.url === "/account/atendimento") {
      return modoSistema === "account" && isFilha;
    }
    // Contas: sempre visível em modo manager (essencial para gerenciar filhas).
    if (it.url === "/manager/contas") {
      return modoSistema === "manager";
    }
    if (!hasPermission(it.perm)) return false;
    return true;
  });

  const groupLabel = modoSistema === "manager" ? "Manager" : "Account";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url || pathname.startsWith(item.url + "/")}>
                    <NavLink to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
