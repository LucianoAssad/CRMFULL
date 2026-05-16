import { supabase } from "@/integrations/supabase/client";
import { onlyDigits } from "@/lib/codigo-publico";

export type TipoConta = "gerente" | "filha";
export type StatusSolic = "pendente" | "aprovado" | "recusado" | "cancelado" | "expirado";

export const LIMITE_GERENTES_FILHA = 5;
export const LIMITE_GERENTES_GERENTE = 1;

interface EmpresaRef {
  id: string;
  nome: string;
  tipo_conta: TipoConta;
  codigo_publico: string | null;
  conta_gerente_id: string | null;
  ativo: boolean;
}

/**
 * Verifica se `parentId` aparece em alguma cadeia de gerentes (hierarquia
 * principal via empresas.conta_gerente_id + vínculos adicionais ativos em
 * contas_vinculos) acima de `childId`. Limita a 50 visitas para evitar loops.
 */
export async function contaEhDescendente(childId: string, parentId: string): Promise<boolean> {
  if (!childId || !parentId) return false;
  const visitados = new Set<string>();
  const fila: Array<{ id: string; hops: number }> = [{ id: childId, hops: 0 }];
  while (fila.length > 0 && visitados.size < 50) {
    const { id, hops } = fila.shift()!;
    if (visitados.has(id)) continue;
    visitados.add(id);
    if (id === parentId && hops > 0) return true;

    // Pai principal via empresas.conta_gerente_id
    const { data: emp } = await supabase
      .from("empresas").select("conta_gerente_id").eq("id", id).maybeSingle();
    const principal = (emp as any)?.conta_gerente_id as string | null | undefined;
    if (principal && !visitados.has(principal)) fila.push({ id: principal, hops: hops + 1 });

    // Gerentes adicionais ativos via contas_vinculos
    const { data: vincs } = await supabase
      .from("contas_vinculos" as any)
      .select("conta_gerente_id")
      .eq("conta_alvo_id", id)
      .eq("status", "ativo");
    for (const v of (vincs as any[]) ?? []) {
      const g = v?.conta_gerente_id as string | null;
      if (g && !visitados.has(g)) fila.push({ id: g, hops: hops + 1 });
    }
  }
  return false;
}

export async function buscarContaPorCodigoOuId(input: string): Promise<EmpresaRef | null> {
  const raw = input.trim();
  if (!raw) return null;
  const digits = onlyDigits(raw);

  // tenta UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
  if (isUuid) {
    const { data } = await supabase
      .from("empresas")
      .select("id, nome, tipo_conta, codigo_publico, conta_gerente_id, ativo")
      .eq("id", raw).maybeSingle();
    if (data) return data as any;
  }
  if (digits.length === 10) {
    const { data } = await supabase
      .from("empresas")
      .select("id, nome, tipo_conta, codigo_publico, conta_gerente_id, ativo")
      .eq("codigo_publico", digits).maybeSingle();
    if (data) return data as any;
  }
  return null;
}

export interface EnviarPedidoInput {
  conta_solicitante_id: string;        // a Conta Gerente que envia
  conta_solicitante_tipo: TipoConta;
  destino_input: string;               // ID/código público
  mensagem?: string | null;
  usuario_id?: string | null;
}

export interface EnviarPedidoResult {
  ok: boolean;
  error?: string;
  destino?: EmpresaRef;
}

/** Valida e cria a solicitação pendente. */
export async function enviarPedidoVinculo(input: EnviarPedidoInput): Promise<EnviarPedidoResult> {
  if (input.conta_solicitante_tipo !== "gerente") {
    return { ok: false, error: "Apenas Conta Gerente pode enviar pedido de vínculo." };
  }
  const destino = await buscarContaPorCodigoOuId(input.destino_input);
  if (!destino) return { ok: false, error: "Conta destino não encontrada." };
  if (!destino.ativo) return { ok: false, error: "Conta destino está inativa." };
  if (destino.id === input.conta_solicitante_id) {
    return { ok: false, error: "Não é possível vincular à própria conta." };
  }

  // Ciclo: solicitante (que ficará acima) não pode ser descendente do destino.
  if (await contaEhDescendente(input.conta_solicitante_id, destino.id)) {
    return { ok: false, error: "Este vínculo criaria um ciclo na hierarquia e não pode ser aprovado." };
  }

  // Duplicado pendente
  const { data: dupPend } = await supabase
    .from("solicitacoes_vinculo_conta")
    .select("id")
    .eq("conta_solicitante_id", input.conta_solicitante_id)
    .eq("conta_alvo_id", destino.id)
    .eq("tipo_solicitacao", "vinculo")
    .eq("status", "pendente")
    .maybeSingle();
  if (dupPend) return { ok: false, error: "Já existe um pedido pendente para esta conta." };

  // Vínculo ativo duplicado
  const { data: dupAtivo } = await supabase
    .from("contas_vinculos" as any)
    .select("id")
    .eq("conta_gerente_id", input.conta_solicitante_id)
    .eq("conta_alvo_id", destino.id)
    .eq("status", "ativo")
    .maybeSingle();
  if (dupAtivo) return { ok: false, error: "Já existe um vínculo ativo entre estas contas." };

  // Limites preventivos (validação real ocorre na aprovação)
  if (destino.tipo_conta === "gerente") {
    const { count } = await supabase
      .from("contas_vinculos" as any)
      .select("id", { count: "exact", head: true })
      .eq("conta_alvo_id", destino.id)
      .eq("status", "ativo");
    if ((count ?? 0) >= LIMITE_GERENTES_GERENTE) {
      return { ok: false, error: "Uma conta gerente só pode ter uma conta gerente direta acima." };
    }
  } else {
    const { count } = await supabase
      .from("contas_vinculos" as any)
      .select("id", { count: "exact", head: true })
      .eq("conta_alvo_id", destino.id)
      .eq("status", "ativo");
    if ((count ?? 0) >= LIMITE_GERENTES_FILHA) {
      return { ok: false, error: "Esta conta já atingiu o limite de contas gerente diretas." };
    }
  }

  const { error } = await supabase.from("solicitacoes_vinculo_conta").insert({
    conta_solicitante_id: input.conta_solicitante_id,
    conta_alvo_id: destino.id,
    tipo_solicitacao: "vinculo",
    tipo_vinculo_solicitado: "gerenciamento",
    mensagem: input.mensagem?.trim() || null,
    created_by: input.usuario_id ?? null,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, destino };
}

/** Conta vínculos ativos de gerentes diretos sobre `contaAlvoId`. */
export async function contarGerentesDiretosAtivos(contaAlvoId: string): Promise<number> {
  const { count } = await supabase
    .from("contas_vinculos" as any)
    .select("id", { count: "exact", head: true })
    .eq("conta_alvo_id", contaAlvoId)
    .eq("status", "ativo");
  return count ?? 0;
}

export interface AprovarPedidoInput {
  solicitacao_id: string;
  conta_solicitante_id: string;
  conta_alvo_id: string;
  tipo_vinculo_solicitado?: "gerenciamento" | "propriedade" | null;
  usuario_id?: string | null;
}

/**
 * Aplica as mesmas validações do envio na hora de aprovar:
 * ciclo, duplicidade ativa e limites por tipo de conta alvo.
 * Cria/atualiza contas_vinculos. Define principal=true só se ainda não houver
 * principal ativo, e nesse caso atualiza empresas.conta_gerente_id e
 * tipo_vinculo_gerente.
 */
export async function aprovarPedidoVinculo(input: AprovarPedidoInput): Promise<{ ok: boolean; error?: string; principal?: boolean }> {
  const { solicitacao_id, conta_solicitante_id, conta_alvo_id } = input;
  const tipo = (input.tipo_vinculo_solicitado ?? "gerenciamento") as "gerenciamento" | "propriedade";

  // Busca alvo
  const { data: alvo } = await supabase
    .from("empresas")
    .select("id, tipo_conta, ativo")
    .eq("id", conta_alvo_id).maybeSingle();
  if (!alvo) return { ok: false, error: "Conta alvo não encontrada." };
  if (!(alvo as any).ativo) return { ok: false, error: "Conta alvo está inativa." };

  // Ciclo (considera principal + adicionais)
  if (await contaEhDescendente(conta_solicitante_id, conta_alvo_id)) {
    return { ok: false, error: "Aprovar criaria ciclo na hierarquia." };
  }

  // Duplicado ativo
  const { data: dupAtivo } = await supabase
    .from("contas_vinculos" as any)
    .select("id")
    .eq("conta_gerente_id", conta_solicitante_id)
    .eq("conta_alvo_id", conta_alvo_id)
    .eq("status", "ativo")
    .maybeSingle();
  if (dupAtivo) return { ok: false, error: "Já existe um vínculo ativo entre estas contas." };

  // Limite
  const ativos = await contarGerentesDiretosAtivos(conta_alvo_id);
  const alvoTipo = (alvo as any).tipo_conta as TipoConta;
  if (alvoTipo === "gerente" && ativos >= LIMITE_GERENTES_GERENTE) {
    return { ok: false, error: "Conta gerente já possui o gerente direto permitido." };
  }
  if (alvoTipo === "filha" && ativos >= LIMITE_GERENTES_FILHA) {
    return { ok: false, error: "Conta filha atingiu o limite de gerentes diretos." };
  }

  // principal só se ainda não houver
  const { data: jaPrincipal } = await supabase
    .from("contas_vinculos" as any)
    .select("id")
    .eq("conta_alvo_id", conta_alvo_id)
    .eq("status", "ativo")
    .eq("principal", true)
    .maybeSingle();
  const definirPrincipal = !jaPrincipal;

  // upsert vínculo (pode existir como removido)
  const { data: existente } = await supabase
    .from("contas_vinculos" as any)
    .select("id")
    .eq("conta_gerente_id", conta_solicitante_id)
    .eq("conta_alvo_id", conta_alvo_id)
    .maybeSingle();

  if (existente) {
    const { error } = await supabase.from("contas_vinculos" as any).update({
      status: "ativo", tipo_vinculo: tipo, principal: definirPrincipal, solicitacao_id,
    }).eq("id", (existente as any).id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("contas_vinculos" as any).insert({
      conta_gerente_id: conta_solicitante_id,
      conta_alvo_id,
      tipo_vinculo: tipo,
      status: "ativo",
      principal: definirPrincipal,
      origem: "solicitacao_vinculo",
      solicitacao_id,
      created_by: input.usuario_id ?? null,
    });
    if (error) return { ok: false, error: error.message };
  }

  if (definirPrincipal) {
    const { error } = await supabase.from("empresas").update({
      conta_gerente_id: conta_solicitante_id,
      tipo_vinculo_gerente: tipo,
    }).eq("id", conta_alvo_id);
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true, principal: definirPrincipal };
}
