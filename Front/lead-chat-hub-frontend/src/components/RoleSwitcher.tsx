import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ALL_ROLES, ROLE_LABEL, getActiveRole, setActiveRole, type Role } from "@/lib/permissions";

export function RoleSwitcher() {
  const [role, setRole] = useState<Role>(getActiveRole());
  const change = (r: Role) => {
    setActiveRole(r);
    setRole(r);
    // recarrega para aplicar guards/menus
    window.location.reload();
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span className="text-xs">Role: <span className="font-medium">{ROLE_LABEL[role]}</span></span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Simular role</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ALL_ROLES.map((r) => (
          <DropdownMenuItem key={r} onClick={() => change(r)}>
            {ROLE_LABEL[r]} {role === r && <span className="ml-auto text-[10px] text-muted-foreground">ativo</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
