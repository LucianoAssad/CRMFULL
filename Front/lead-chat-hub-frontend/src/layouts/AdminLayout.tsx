import { Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ActiveAccountProvider, useActiveAccount } from "@/contexts/ActiveAccountContext";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { RoleSync } from "@/components/RoleSync";
import { RequireValidAccount } from "@/components/RequireValidAccount";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Building2, LogOut, Repeat, Shield, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getRootAccount } from "@/lib/account-hierarchy";
import { formatCodigoPublico } from "@/lib/codigo-publico";
import { useIsSuperAdmin } from "@/lib/super-admin";

function HeaderInner() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const { contas, activeContaId } = useActiveAccount();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const root = getRootAccount(activeContaId, contas);
  const { isSuperAdmin } = useIsSuperAdmin();

  const onLogout = async () => {
    await signOut();
    try {
      localStorage.removeItem("active_conta_id");
      localStorage.removeItem("active_role");
      localStorage.removeItem("modo_sistema");
      localStorage.removeItem("recent_conta_ids");
    } catch {}
    navigate("/login", { replace: true });
  };

  return (
    <header className="flex h-12 items-center gap-2 border-b bg-card px-3">
      <SidebarTrigger />
      <span className="text-sm font-semibold whitespace-nowrap">Krescer SMKT</span>
      <span className="mx-1 text-muted-foreground/60">/</span>
      <div className="min-w-0 flex-1">
        <AccountSwitcher open={switcherOpen} onOpenChange={setSwitcherOpen} />
      </div>
      <div className="ml-auto flex items-center gap-2">
        {isSuperAdmin && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="hidden sm:flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs font-medium text-primary">
                  <Shield className="h-3.5 w-3.5" />
                  <span>Super Admin</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">
                Acesso global da plataforma
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {root && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="hidden md:flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="max-w-[160px] truncate font-medium text-foreground">{root.nome}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">
                <div className="font-medium">{root.nome}</div>
                <div className="font-mono">{formatCodigoPublico(root.codigo_publico)}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
              <UserIcon className="h-4 w-4" />
              {user?.email && (
                <span className="hidden text-xs text-muted-foreground md:inline max-w-[180px] truncate">
                  {user.email}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {user?.email && (
              <>
                <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </DropdownMenuLabel>
                {isSuperAdmin && (
                  <div className="px-2 pb-1.5 -mt-1">
                    <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      <Shield className="h-3 w-3" /> Super Admin
                    </span>
                  </div>
                )}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => setSwitcherOpen(true)}>
              <Repeat className="mr-2 h-4 w-4" />
              Trocar conta
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default function AdminLayout() {
  return (
    <ActiveAccountProvider>
      <RoleSync />
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <div className="flex flex-1 flex-col">
            <HeaderInner />
            <main className="flex-1 overflow-auto">
              <RequireValidAccount>
                <Outlet />
              </RequireValidAccount>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ActiveAccountProvider>
  );
}
