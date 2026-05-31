import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Inbox, Building2, Users, Plug, Package, GitBranch, Target, FileText, Settings, ShoppingCart, Megaphone, Upload, CalendarDays, Bot, UsersRound, HandCoins, Cable, BookOpen, GraduationCap, Sun, Moon,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
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
  { title: "Agendamentos", url: "/account/agendamentos", icon: CalendarDays, perm: "view_crm" },
  { title: "Chatbot & Fluxos", url: "/account/chatbot", icon: Bot, perm: "manage_crm" },
  { title: "Grupos WhatsApp", url: "/account/grupos-whatsapp", icon: UsersRound, perm: "manage_connections" },
  { title: "Afiliados", url: "/account/afiliados", icon: HandCoins, perm: "manage_crm" },
  { title: "Integrações", url: "/account/integracoes", icon: Cable, perm: "manage_crm" },
  { title: "Base de Conhecimento", url: "/account/base-conhecimento", icon: BookOpen, perm: "view_crm" },
  { title: "Comunidade", url: "/account/comunidade", icon: GraduationCap, perm: "view_crm" },
  { title: "Acesso e segurança", url: "/account/usuarios", icon: Users, perm: "manage_users" },
  { title: "Configurações", url: "/account/configuracoes", icon: Settings, perm: "view_dashboard" },
];


function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  };
  return { dark, toggle };
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { activeConta, modoSistema } = useActiveAccount();
  const [usageConversas, setUsageConversas] = useState<number | null>(null);
  const [usageCanais, setUsageCanais] = useState<number | null>(null);
  const { dark, toggle } = useTheme();

  // Re-render quando o role efetivo mudar (RoleSync dispara este evento)
  const [, setRoleTick] = useState(0);
  useEffect(() => {
    const h = () => setRoleTick((n) => n + 1);
    window.addEventListener("active-role-changed", h);
    return () => window.removeEventListener("active-role-changed", h);
  }, []);

  // Contador de uso — atualiza ao mudar conta ativa
  useEffect(() => {
    if (!activeConta?.id) { setUsageConversas(null); setUsageCanais(null); return; }
    const id = activeConta.id;
    Promise.all([
      supabase.from("conversas").select("*", { count: "exact", head: true }).eq("empresa_id", id).neq("status", "fechada"),
      supabase.from("canais_conectados").select("*", { count: "exact", head: true }).eq("empresa_id", id).eq("ativo", true),
    ]).then(([c, k]) => {
      setUsageConversas(c.count ?? 0);
      setUsageCanais(k.count ?? 0);
    });
  }, [activeConta?.id]);

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

      <SidebarFooter className="border-t px-3 py-2">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={dark ? "Modo claro" : "Modo escuro"}
          className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {!collapsed && <span>{dark ? "Modo claro" : "Modo escuro"}</span>}
        </button>

        {!collapsed && activeConta && (usageConversas !== null || usageCanais !== null) && (
          <div className="space-y-1 text-[11px] text-muted-foreground mt-1">
            <p className="font-medium text-foreground/70 uppercase tracking-wide text-[10px]">Uso atual</p>
            {usageConversas !== null && (
              <div className="flex items-center justify-between">
                <span>Conversas abertas</span>
                <span className="font-semibold text-foreground">{usageConversas}</span>
              </div>
            )}
            {usageCanais !== null && (
              <div className="flex items-center justify-between">
                <span>Canais ativos</span>
                <span className="font-semibold text-foreground">{usageCanais}</span>
              </div>
            )}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
