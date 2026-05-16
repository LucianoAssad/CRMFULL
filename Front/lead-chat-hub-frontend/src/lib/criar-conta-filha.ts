import { supabase } from "@/integrations/supabase/client";

export interface CriarContaFilhaInput {
  nome: string;
  email?: string;
  telefone?: string;
  conta_gerente_id: string;
  usuario_id?: string | null; // para vincular acesso ao usuário atual
}

const ETAPAS_PADRAO = [
  { nome: "Novo", ordem: 1, cor: "#3b82f6" },
  { nome: "Em atendimento", ordem: 2, cor: "#f59e0b" },
  { nome: "Orçamento enviado", ordem: 3, cor: "#8b5cf6" },
  { nome: "Negociação", ordem: 4, cor: "#06b6d4" },
  { nome: "Ganho", ordem: 5, cor: "#10b981" },
  { nome: "Perdido", ordem: 6, cor: "#ef4444" },
];

export async function criarContaFilha(input: CriarContaFilhaInput): Promise<{ empresa_id: string }> {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Informe o nome da conta filha.");
  if (!input.conta_gerente_id) throw new Error("Conta gerente ativa não identificada.");

  // 1) Empresa filha vinculada
  const { data: empresa, error: empErr } = await supabase
    .from("empresas")
    .insert({
      nome,
      tipo_conta: "filha",
      conta_gerente_id: input.conta_gerente_id,
      tipo_vinculo_gerente: "propriedade",
      email: input.email?.trim() || null,
      telefone: input.telefone?.trim() || null,
      ativo: true,
    })
    .select("id")
    .single();
  if (empErr) throw new Error(`Empresa: ${empErr.message}`);

  // 2) Vínculo em contas_vinculos (gerente -> filha)
  await supabase.from("contas_vinculos" as any).insert({
    conta_gerente_id: input.conta_gerente_id,
    conta_alvo_id: empresa.id,
    tipo_vinculo: "propriedade",
    status: "ativo",
    principal: true,
    origem: "manager_contas",
  });

  // 3) Perfil comercial inicial
  await supabase.from("empresa_perfil_comercial").insert({
    empresa_id: empresa.id,
    nome_unidade: nome,
    nome_fantasia: nome,
    telefone: input.telefone?.trim() || null,
    whatsapp: input.telefone?.trim() || null,
    email: input.email?.trim() || null,
    validade_orcamento_padrao_dias: 7,
    formas_pagamento_padrao: ["Pix", "Cartão de crédito", "Cartão de débito", "Dinheiro"],
    parcelamento_padrao: "Até 3x",
    termos_orcamento_padrao: "Valores sujeitos à avaliação técnica.",
    observacao_orcamento_padrao: "Orçamento válido conforme prazo informado.",
    ativo: true,
  });

  // 4) Pipeline padrão + etapas
  const { data: pipeline } = await supabase
    .from("pipelines")
    .insert({ empresa_id: empresa.id, nome: "Pipeline Padrão", ativo: true })
    .select("id")
    .single();
  if (pipeline) {
    await supabase.from("pipeline_etapas").insert(
      ETAPAS_PADRAO.map((e) => ({ ...e, pipeline_id: pipeline.id })),
    );
  }

  // 5) Vincular usuário atual como admin_filha (para conseguir acessar)
  if (input.usuario_id) {
    await supabase.from("usuarios_contas").insert({
      usuario_id: input.usuario_id,
      conta_id: empresa.id,
      role: "admin_filha",
      ativo: true,
    });
  }

  return { empresa_id: empresa.id };
}
