import { supabase } from "@/integrations/supabase/client";
import type { EmpresaPerfilComercial, Lead, Orcamento, OrcamentoItem } from "@/lib/crm-types";

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function formatarOrcamentoParaMensagem(
  orcamento: Orcamento,
  itens: OrcamentoItem[],
  lead: Lead | null,
  perfil: EmpresaPerfilComercial | null,
): string {
  const saudacao = lead?.nome ? `Olá, ${lead.nome}!` : "Olá!";
  const linhas: string[] = [];
  linhas.push(`${saudacao} Segue o orçamento solicitado:`);
  linhas.push("");
  linhas.push(`Orçamento #${orcamento.numero}`);
  linhas.push("");
  linhas.push("Serviços:");
  itens.forEach((it, i) => {
    const desc = it.descricao || it.servico || it.categoria || "Item";
    const qtd = Number(it.quantidade ?? 0);
    const un = it.unidade || "un";
    const total = Number(it.valor_total ?? (qtd * Number(it.valor_unitario ?? 0) - Number(it.desconto ?? 0)));
    linhas.push(`${i + 1}. ${desc} — ${qtd} ${un} — ${fmtBRL(total)}`);
  });
  linhas.push("");

  const subtotal = Number(orcamento.subtotal ?? 0);
  const desconto = Number(orcamento.desconto_total ?? 0);
  const total = Number(orcamento.valor_total ?? 0);

  if (subtotal !== total) {
    linhas.push(`Subtotal: ${fmtBRL(subtotal)}`);
    if (desconto > 0) linhas.push(`Desconto: ${fmtBRL(desconto)}`);
  }
  linhas.push(`Total: ${fmtBRL(total)}`);
  linhas.push("");

  linhas.push(`Condição de pagamento: ${orcamento.condicoes_pagamento?.trim() || "a combinar"}`);
  if (orcamento.validade_em) {
    linhas.push(`Validade: ${new Date(orcamento.validade_em).toLocaleDateString("pt-BR")}`);
  } else {
    linhas.push("Validade: a combinar");
  }

  const obs = orcamento.observacoes_cliente?.trim() || orcamento.termos?.trim();
  if (obs) {
    linhas.push("");
    linhas.push("Observações:");
    linhas.push(obs);
  }

  const assinatura = perfil?.nome_unidade || perfil?.nome_fantasia || perfil?.razao_social;
  if (assinatura) {
    linhas.push("");
    linhas.push(assinatura);
  }
  return linhas.join("\n");
}

/**
 * Envia o orçamento como mensagem de texto na conversa vinculada.
 * Não chama Edge Function. Apenas registra mensagem outbound e atualiza
 * o status do orçamento.
 */
export async function enviarOrcamentoNoChat(orcamentoId: string): Promise<{ reenviado: boolean }> {
  const { data: orc, error: e1 } = await supabase
    .from("orcamentos").select("*").eq("id", orcamentoId).maybeSingle();
  if (e1) throw e1;
  const orcamento = orc as any as Orcamento | null;
  if (!orcamento) throw new Error("Orçamento não encontrado");
  if (!orcamento.conversa_id) throw new Error("Este orçamento não está vinculado a uma conversa");

  const { data: its } = await supabase
    .from("orcamento_itens").select("*").eq("orcamento_id", orcamentoId).order("ordem");
  const itens = ((its as any[]) ?? []) as OrcamentoItem[];

  let lead: Lead | null = null;
  if (orcamento.lead_id) {
    const { data } = await supabase.from("leads").select("*").eq("id", orcamento.lead_id).maybeSingle();
    lead = (data as any) ?? null;
  }

  const { data: perfilData } = await supabase
    .from("empresa_perfil_comercial").select("*")
    .eq("empresa_id", orcamento.empresa_id).maybeSingle();
  const perfil = (perfilData as any) ?? null;

  const texto = formatarOrcamentoParaMensagem(orcamento, itens, lead, perfil);
  if (!texto.trim()) throw new Error("Não foi possível gerar o texto do orçamento");

  const reenviado = orcamento.status === "enviado" || orcamento.status === "reenviado";

  const { error: mErr } = await supabase.from("mensagens").insert({
    conversa_id: orcamento.conversa_id,
    direcao: "outbound",
    conteudo: texto,
    autor: "Atendente",
    lida: true,
    tipo: "texto",
    metadata: { origem: "orcamento", orcamento_id: orcamentoId, numero: orcamento.numero },
  } as any);
  if (mErr) throw mErr;

  const novoStatus = reenviado ? "reenviado" : "enviado";
  const { error: uErr } = await supabase.from("orcamentos")
    .update({
      status: novoStatus,
      enviado_em: new Date().toISOString(),
      mensagem_chat: texto,
    })
    .eq("id", orcamentoId);
  if (uErr) {
    // fallback caso 'reenviado' não seja aceito pela constraint
    if (reenviado) {
      const { error: uErr2 } = await supabase.from("orcamentos")
        .update({ status: "enviado", enviado_em: new Date().toISOString(), mensagem_chat: texto })
        .eq("id", orcamentoId);
      if (uErr2) throw uErr2;
      return { reenviado: true };
    }
    throw uErr;
  }
  return { reenviado };
}
