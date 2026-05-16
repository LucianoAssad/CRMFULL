import type { AccessibleAccount } from "@/lib/accessible-accounts";

interface MinAccount {
  id: string;
  nome: string;
  tipo_conta: "gerente" | "filha";
  conta_gerente_id: string | null;
  codigo_publico: string | null;
}

/** Retorna o caminho raiz → conta ativa (apenas seguindo conta_gerente_id). */
export function buildAccountPath<T extends MinAccount>(
  activeContaId: string | null,
  contas: T[],
): T[] {
  if (!activeContaId) return [];
  const byId = new Map<string, T>();
  contas.forEach((c) => byId.set(c.id, c));
  const path: T[] = [];
  let cur = byId.get(activeContaId) ?? null;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = cur.conta_gerente_id ? byId.get(cur.conta_gerente_id) ?? null : null;
  }
  return path;
}

/** Retorna a conta raiz (Conta Gerente mais alta) ou a própria conta ativa. */
export function getRootAccount<T extends MinAccount>(
  activeContaId: string | null,
  contas: T[],
): T | null {
  const path = buildAccountPath(activeContaId, contas);
  return path[0] ?? null;
}

const RECENTS_KEY = "recent_conta_ids";
const RECENTS_LIMIT = 6;

export function getRecentAccounts(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function setRecentAccount(accountId: string): void {
  if (!accountId) return;
  try {
    const cur = getRecentAccounts().filter((id) => id !== accountId);
    cur.unshift(accountId);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(cur.slice(0, RECENTS_LIMIT)));
  } catch {
    /* ignore */
  }
}

/** Tipo do dropdown: monta árvore das contas acessíveis usando conta_gerente_id. */
export interface HierTreeNode<T extends MinAccount = AccessibleAccount> {
  conta: T;
  children: HierTreeNode<T>[];
}

export function buildAccessibleForest<T extends MinAccount>(list: T[]): HierTreeNode<T>[] {
  const ids = new Set(list.map((c) => c.id));
  const byId = new Map<string, HierTreeNode<T>>();
  list.forEach((c) => byId.set(c.id, { conta: c, children: [] }));
  const roots: HierTreeNode<T>[] = [];
  for (const node of byId.values()) {
    const pid = node.conta.conta_gerente_id;
    if (pid && ids.has(pid)) {
      byId.get(pid)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: HierTreeNode<T>[]) => {
    nodes.sort((a, b) => {
      if (a.conta.tipo_conta !== b.conta.tipo_conta) {
        return a.conta.tipo_conta === "gerente" ? -1 : 1;
      }
      return a.conta.nome.localeCompare(b.conta.nome);
    });
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}
