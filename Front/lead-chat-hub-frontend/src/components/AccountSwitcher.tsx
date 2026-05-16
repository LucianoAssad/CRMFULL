import { useEffect, useMemo, useState, useCallback } from "react";
import { Building2, Check, ChevronDown, ChevronRight, Copy, Search, Slash } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatCodigoPublico } from "@/lib/codigo-publico";
import { fetchAccessibleAccounts, type AccessibleAccount } from "@/lib/accessible-accounts";
import {
  buildAccountPath,
  getRecentAccounts,
  setRecentAccount,
} from "@/lib/account-hierarchy";
import { cn } from "@/lib/utils";

/** Ordena: gerentes primeiro (alfabético), depois filhas (alfabético). */
function sortLevel(list: AccessibleAccount[]): AccessibleAccount[] {
  return [...list].sort((a, b) => {
    if (a.tipo_conta !== b.tipo_conta) return a.tipo_conta === "gerente" ? -1 : 1;
    return a.nome.localeCompare(b.nome);
  });
}

/**
 * Hook compartilhado para selecionar uma conta preservando rota quando compatível.
 */
export function useSelectAccount() {
  const { setActiveContaId } = useActiveAccount();
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (c: { id: string; tipo_conta: "gerente" | "filha"; role?: string }) => {
      setActiveContaId(c.id);
      if (c.role) {
        try { localStorage.setItem("active_role", c.role); } catch {}
      }
      const modo = c.tipo_conta === "gerente" ? "manager" : "account";
      try { localStorage.setItem("modo_sistema", modo); } catch {}
      setRecentAccount(c.id);
      try {
        window.dispatchEvent(new CustomEvent("active-conta-changed", {
          detail: { conta_id: c.id, tipo_conta: c.tipo_conta, timestamp: Date.now() },
        }));
      } catch {}
      const path = location.pathname;
      const isManagerRoute = path.startsWith("/manager");
      const isAccountRoute = path.startsWith("/account");
      if (modo === "manager" && isManagerRoute) return;
      if (modo === "account" && isAccountRoute) return;
      navigate(modo === "manager" ? "/manager/dashboard" : "/account/dashboard", { replace: true });
    },
    [setActiveContaId, navigate, location.pathname],
  );
}

interface AccountSwitcherProps {
  /** Permite controle externo do estado aberto (ex.: "Trocar conta" no menu de usuário). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AccountSwitcher({ open, onOpenChange }: AccountSwitcherProps = {}) {
  const { contas, activeContaId } = useActiveAccount();
  const { usuarioId } = useAuth();
  const selectAccount = useSelectAccount();
  const [acessiveis, setAcessiveis] = useState<AccessibleAccount[]>([]);
  const [query, setQuery] = useState("");
  const [contextContaId, setContextContaId] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? !!open : internalOpen;
  const setIsOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  useEffect(() => {
    if (!usuarioId) { setAcessiveis([]); return; }
    let cancelled = false;
    const reloadAccessible = () => {
      fetchAccessibleAccounts(usuarioId).then((lista) => {
        if (!cancelled) setAcessiveis(lista);
      });
    };
    reloadAccessible();
    window.addEventListener("active-conta-changed", reloadAccessible);
    window.addEventListener("usuarios-contas-changed", reloadAccessible);
    return () => {
      cancelled = true;
      window.removeEventListener("active-conta-changed", reloadAccessible);
      window.removeEventListener("usuarios-contas-changed", reloadAccessible);
    };
  }, [usuarioId]);

  // Indexes
  const byId = useMemo(() => {
    const m = new Map<string, AccessibleAccount>();
    acessiveis.forEach((c) => m.set(c.id, c));
    return m;
  }, [acessiveis]);

  const childrenMap = useMemo(() => {
    const m = new Map<string, AccessibleAccount[]>();
    acessiveis.forEach((c) => {
      const pid = c.conta_gerente_id;
      if (pid && byId.has(pid)) {
        if (!m.has(pid)) m.set(pid, []);
        m.get(pid)!.push(c);
      }
    });
    return m;
  }, [acessiveis, byId]);

  // Raízes (contas sem pai acessível)
  const roots = useMemo(
    () => acessiveis.filter((c) => !c.conta_gerente_id || !byId.has(c.conta_gerente_id)),
    [acessiveis, byId],
  );

  // Define contexto inicial ao abrir
  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    const ativa = activeContaId ? byId.get(activeContaId) : undefined;
    if (!ativa) {
      setContextContaId(null);
      return;
    }
    if (ativa.tipo_conta === "gerente") {
      setContextContaId(ativa.id);
    } else {
      const pid = ativa.conta_gerente_id;
      setContextContaId(pid && byId.has(pid) ? pid : ativa.id);
    }
  }, [isOpen, activeContaId, byId]);

  // Caminho interno do dropdown (raiz → contexto)
  const innerPath = useMemo(() => {
    if (!contextContaId) return [] as AccessibleAccount[];
    const out: AccessibleAccount[] = [];
    const seen = new Set<string>();
    let cur = byId.get(contextContaId) ?? null;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      out.unshift(cur);
      cur = cur.conta_gerente_id ? byId.get(cur.conta_gerente_id) ?? null : null;
    }
    return out;
  }, [contextContaId, byId]);

  // Lista do nível atual
  const levelItems = useMemo(() => {
    if (!contextContaId) return sortLevel(roots);
    return sortLevel(childrenMap.get(contextContaId) ?? []);
  }, [contextContaId, childrenMap, roots]);

  // IDs da subárvore do contexto (incluindo contexto)
  const subtreeIds = useMemo(() => {
    const ids = new Set<string>();
    const stack: string[] = contextContaId ? [contextContaId] : roots.map((r) => r.id);
    while (stack.length) {
      const id = stack.pop()!;
      if (ids.has(id)) continue;
      ids.add(id);
      (childrenMap.get(id) ?? []).forEach((c) => stack.push(c.id));
    }
    if (contextContaId) ids.delete(contextContaId);
    return ids;
  }, [contextContaId, childrenMap, roots]);

  // Resultados de busca dentro da subárvore
  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [] as AccessibleAccount[];
    const pool = acessiveis.filter((c) => subtreeIds.has(c.id));
    const m = pool.filter((c) =>
      c.nome.toLowerCase().includes(term) ||
      (c.codigo_publico ?? "").toLowerCase().includes(term) ||
      formatCodigoPublico(c.codigo_publico).toLowerCase().includes(term),
    );
    return sortLevel(m);
  }, [query, acessiveis, subtreeIds]);

  // Caminho resumido para um item nos resultados de busca
  const shortPathOf = (id: string): string => {
    const out: string[] = [];
    const seen = new Set<string>();
    let cur = byId.get(id)?.conta_gerente_id ? byId.get(byId.get(id)!.conta_gerente_id!) : null;
    while (cur && !seen.has(cur.id)) {
      if (contextContaId && cur.id === contextContaId) break;
      seen.add(cur.id);
      out.unshift(cur.nome);
      cur = cur.conta_gerente_id ? byId.get(cur.conta_gerente_id) ?? null : null;
    }
    return out.join(" / ");
  };

  // Breadcrumb do header (caminho global da conta ativa)
  const path = useMemo(() => buildAccountPath(activeContaId, contas), [activeContaId, contas]);

  // Recentes filtrados pelo contexto atual
  const recents = useMemo(() => {
    const ids = getRecentAccounts();
    return ids
      .map((id) => byId.get(id))
      .filter((c): c is AccessibleAccount =>
        !!c && c.id !== activeContaId && subtreeIds.has(c.id),
      )
      .slice(0, 5);
  }, [byId, activeContaId, subtreeIds, isOpen]);

  useEffect(() => {
    if (activeContaId) setRecentAccount(activeContaId);
  }, [activeContaId]);

  const handleSelect = (c: AccessibleAccount) => {
    selectAccount(c);
    setIsOpen(false);
    setQuery("");
  };

  const enterContext = (c: AccessibleAccount) => {
    setContextContaId(c.id);
    setQuery("");
  };

  const copy = async (e: React.MouseEvent, code: string | null | undefined) => {
    e.stopPropagation();
    if (!code) return;
    const formatted = formatCodigoPublico(code);
    await navigator.clipboard.writeText(formatted);
    toast.success(`ID copiado: ${formatted}`);
  };

  const renderRow = (c: AccessibleAccount, opts?: { showPath?: boolean }) => {
    const hasChildren = (childrenMap.get(c.id) ?? []).length > 0;
    const isActive = activeContaId === c.id;
    const sub = opts?.showPath ? shortPathOf(c.id) : "";
    return (
      <div
        key={c.id}
        className={cn(
          "group flex items-center gap-1 rounded-sm px-1.5 py-1.5 text-sm hover:bg-accent cursor-pointer",
          isActive && "bg-accent",
        )}
        onClick={() => handleSelect(c)}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{c.nome}</span>
            {isActive && <Check className="h-3 w-3 text-primary" />}
          </div>
          <span className="font-mono text-[10px] text-muted-foreground truncate">
            {formatCodigoPublico(c.codigo_publico)}
            {sub && <span className="ml-1 font-sans not-italic text-muted-foreground/70">· {sub}</span>}
          </span>
        </div>
        {c.codigo_publico && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100"
            onClick={(e) => copy(e, c.codigo_publico)}
            title="Copiar ID"
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
        {hasChildren && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); enterContext(c); }}
            className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm hover:bg-muted"
            aria-label={`Entrar em ${c.nome}`}
            title={`Entrar em ${c.nome}`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-1 min-w-0 text-sm">
          {path.length === 0 && (
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs">
                <Building2 className="h-3.5 w-3.5" />
                <span className="text-muted-foreground">Selecione uma conta</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
          )}
          {path.map((c, i) => {
            const isLast = i === path.length - 1;
            return (
              <div key={c.id} className="flex items-center gap-1 min-w-0">
                {i > 0 && <Slash className="h-3 w-3 shrink-0 text-muted-foreground/60 -rotate-12" />}
                <Tooltip>
                  <TooltipTrigger asChild>
                    {isLast ? (
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 max-w-[220px] gap-1 px-1.5 text-xs font-medium"
                        >
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{c.nome}</span>
                          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 max-w-[160px] px-1.5 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => selectAccount(c)}
                      >
                        <span className="truncate">{c.nome}</span>
                      </Button>
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[10px]">
                    <div className="font-medium">{c.nome}</div>
                    <div className="font-mono">{formatCodigoPublico(c.codigo_publico)}</div>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </TooltipProvider>

      <DropdownMenuContent align="start" className="w-[440px] p-0">
        <DropdownMenuLabel className="px-3 pt-3">Contas</DropdownMenuLabel>

        {/* Caminho interno do dropdown */}
        <div className="px-3 pb-2 pt-1">
          <div className="flex flex-wrap items-center gap-0.5 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => { setContextContaId(null); setQuery(""); }}
              className={cn(
                "rounded px-1 py-0.5 hover:bg-accent hover:text-foreground",
                !contextContaId && "text-foreground font-medium",
              )}
            >
              Todas
            </button>
            {innerPath.map((c, i) => {
              const isLast = i === innerPath.length - 1;
              return (
                <div key={c.id} className="flex items-center gap-0.5 min-w-0">
                  <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
                  <button
                    type="button"
                    onClick={() => { setContextContaId(c.id); setQuery(""); }}
                    className={cn(
                      "max-w-[140px] truncate rounded px-1 py-0.5 hover:bg-accent hover:text-foreground",
                      isLast && "text-foreground font-medium",
                    )}
                    title={c.nome}
                  >
                    {c.nome}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar neste nível e abaixo..."
              className="h-8 pl-7 text-xs"
              autoFocus
              type="search"
              name="account-search-field"
              id="account-search-field"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="search"
              aria-label="Buscar conta"
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
            />
          </div>
        </div>

        {!query && recents.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-0" />
            <div className="px-2 py-1.5">
              <div className="px-1 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Recentes</div>
              {recents.map((c) => renderRow(c))}
            </div>
          </>
        )}

        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-[360px] overflow-auto py-1 px-1">
          {query ? (
            searchResults.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                Nenhuma conta encontrada neste contexto.
              </div>
            ) : (
              searchResults.map((c) => renderRow(c, { showPath: true }))
            )
          ) : levelItems.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nenhuma conta abaixo deste nível.
            </div>
          ) : (
            levelItems.map((c) => renderRow(c))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
