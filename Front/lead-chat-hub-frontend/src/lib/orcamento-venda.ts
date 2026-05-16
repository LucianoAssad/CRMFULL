import { supabase } from "@/integrations/supabase/client";

export async function converterOrcamentoEmVenda(orcamentoId: string): Promise<{ vendaId: string; jaConvertido: boolean }> {
  const { data: orc, error: eO } = await supabase
    .from("orcamentos").select("*").eq("id", orcamentoId).maybeSingle();
  if (eO) throw eO;
  if (!orc) throw new Error("Orçamento não encontrado");

  if ((orc as any).convertido_venda_id) {
    return { vendaId: (orc as any).convertido_venda_id, jaConvertido: true };
  }
  if ((orc as any).status === "convertido_em_venda") {
    throw new Error("Orçamento já está marcado como convertido");
  }

  const dataIso = new Date().toISOString();

  const { data: itens, error: eI } = await supabase
    .from("orcamento_itens").select("*").eq("orcamento_id", orcamentoId).order("ordem");
  if (eI) throw eI;
  const itensList = (itens as any[]) ?? [];
  if (itensList.length === 0) {
    throw new Error("Orçamento não possui itens.");
  }
  if (itensList.some((it) => !it.produto_id)) {
    throw new Error("Este orçamento possui item sem produto cadastrado. Corrija os itens antes de converter em venda.");
  }

  const operadorNome = ((orc as any).operador_nome ?? "").toString().trim();
  const obs = `Venda gerada a partir do orçamento #${(orc as any).numero}`
    + (operadorNome ? `. Operador: ${operadorNome}.` : "");

  const { data: venda, error: eV } = await supabase
    .from("vendas")
    .insert({
      empresa_id: (orc as any).empresa_id,
      lead_id: (orc as any).lead_id,
      conversa_id: (orc as any).conversa_id,
      oportunidade_id: (orc as any).oportunidade_id,
      valor_total: Number((orc as any).valor_total ?? 0),
      data_venda: dataIso,
      status: "fechada",
      observacoes: obs,
    } as any)
    .select("id")
    .single();
  if (eV) throw eV;
  const vendaId = (venda as any).id as string;

  const payload = itensList
    .map((it) => ({
      venda_id: vendaId,
      produto_servico_id: it.produto_id,
      nome_produto: it.descricao ?? it.servico ?? null,
      quantidade: Number(it.quantidade ?? 1),
      valor_unitario: Number(it.valor_unitario ?? 0),
      valor_total: Number(it.valor_total ?? 0),
    }));
  if (payload.length > 0) {
    const { error: eIns } = await supabase.from("itens_venda").insert(payload);
    if (eIns) throw eIns;
  }

  const { error: eU } = await supabase
    .from("orcamentos")
    .update({
      status: "convertido_em_venda",
      convertido_venda_id: vendaId,
      updated_at: dataIso,
    } as any)
    .eq("id", orcamentoId);
  if (eU) throw eU;

  // Atualizar lead como convertido (reaproveitando padrão de VendaDialog, sem disparar conversões externas)
  if ((orc as any).lead_id) {
    await supabase.from("leads").update({
      status: "convertido",
      convertido: true,
      convertido_em: dataIso,
      data_conversao: dataIso,
      valor_conversao: Number((orc as any).valor_total ?? 0),
    } as any).eq("id", (orc as any).lead_id);
  }

  // Atualizar oportunidade como ganha, se houver
  if ((orc as any).oportunidade_id) {
    await supabase.from("oportunidades").update({
      status: "ganha",
      ganha_em: dataIso,
    } as any).eq("id", (orc as any).oportunidade_id);
  }

  return { vendaId, jaConvertido: false };
}

export const STATUS_CONVERTIVEIS = new Set([
  "rascunho", "enviado", "reenviado", "em_negociacao", "aprovado",
]);

export function podeConverter(orc: { status: string; convertido_venda_id?: string | null }): boolean {
  if (orc.convertido_venda_id) return false;
  return STATUS_CONVERTIVEIS.has(orc.status);
}
