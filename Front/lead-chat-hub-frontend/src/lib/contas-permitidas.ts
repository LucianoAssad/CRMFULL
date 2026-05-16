import type { ContaResumo } from "@/contexts/ActiveAccountContext";

/**
 * Retorna o conjunto de IDs de contas que o usuário pode ENXERGAR a partir
 * da conta ativa, respeitando a hierarquia MCC.
 *
 * - Conta filha ativa  -> [activeContaId]
 * - Conta gerente ativa -> [activeContaId, ...descendentes diretos e indiretos]
 *
 * Esta é a fonte da verdade para escopo de leitura. Todas as telas devem
 * filtrar `empresa_id` por este conjunto antes de consultar o backend.
 */
export function getContasPermitidas(
  activeContaId: string | null,
  contas: ContaResumo[],
): string[] {
  if (!activeContaId) return [];
  const ativa = contas.find((c) => c.id === activeContaId);
  if (!ativa) return [];
  if (ativa.tipo_conta === "filha") return [ativa.id];

  // gerente: BFS por descendentes
  const childrenMap: Record<string, ContaResumo[]> = {};
  for (const c of contas) {
    if (c.conta_gerente_id) (childrenMap[c.conta_gerente_id] ||= []).push(c);
  }
  const out: string[] = [ativa.id];
  const stack: string[] = [ativa.id];
  const seen = new Set<string>([ativa.id]);
  while (stack.length) {
    const cur = stack.pop()!;
    for (const child of childrenMap[cur] || []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      out.push(child.id);
      stack.push(child.id);
    }
  }
  return out;
}
