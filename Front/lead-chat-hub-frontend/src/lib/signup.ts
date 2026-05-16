import { supabase } from "@/integrations/supabase/client";

export interface SignupInput {
  empresa_nome: string;
  tipo_conta: "gerente" | "filha";
  empresa_email?: string;
  empresa_telefone?: string;
  admin_nome: string;
  admin_email: string;
  admin_senha: string;
}

export interface SignupResult {
  empresa_id: string;
  usuario_id: string;
  tipo_conta: "gerente" | "filha";
}

const ETAPAS_PADRAO = [
  { nome: "Novo", ordem: 1, cor: "#3b82f6" },
  { nome: "Em atendimento", ordem: 2, cor: "#f59e0b" },
  { nome: "Orçamento enviado", ordem: 3, cor: "#8b5cf6" },
  { nome: "Negociação", ordem: 4, cor: "#06b6d4" },
  { nome: "Ganho", ordem: 5, cor: "#10b981" },
  { nome: "Perdido", ordem: 6, cor: "#ef4444" },
];

export async function criarContaCompleta(input: SignupInput): Promise<SignupResult> {
  const redirectUrl = `${window.location.origin}/account/onboarding`;

  // 1) Auth signup
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: input.admin_email,
    password: input.admin_senha,
    options: {
      emailRedirectTo: redirectUrl,
      data: { nome: input.admin_nome },
    },
  });
  if (authErr) throw new Error(authErr.message);
  if (!authData.user) throw new Error("Falha ao criar usuário.");

  // 2) Empresa
  const { data: empresa, error: empErr } = await supabase
    .from("empresas")
    .insert({
      nome: input.empresa_nome,
      tipo_conta: input.tipo_conta,
      email: input.empresa_email || null,
      telefone: input.empresa_telefone || null,
      ativo: true,
    })
    .select("id, tipo_conta")
    .single();
  if (empErr) throw new Error(`Empresa: ${empErr.message}`);

  // 3) Usuário interno (busca/insere por email)
  let usuarioId: string;
  const { data: existing } = await supabase
    .from("usuarios")
    .select("id")
    .eq("email", input.admin_email)
    .maybeSingle();
  if (existing?.id) {
    usuarioId = existing.id;
  } else {
    const { data: usuario, error: uErr } = await supabase
      .from("usuarios")
      .insert({
        nome: input.admin_nome,
        email: input.admin_email,
        telefone: input.empresa_telefone || null,
        empresa_id: empresa.id,
        role: "admin",
        ativo: true,
      })
      .select("id")
      .single();
    if (uErr) throw new Error(`Usuário: ${uErr.message}`);
    usuarioId = usuario.id;
  }

  // 4) Vínculo usuarios_contas como admin
  const role = input.tipo_conta === "gerente" ? "admin_gerente" : "admin_filha";
  const { error: vErr } = await supabase.from("usuarios_contas").insert({
    usuario_id: usuarioId,
    conta_id: empresa.id,
    role,
    ativo: true,
  });
  if (vErr) throw new Error(`Vínculo: ${vErr.message}`);

  // 5) Pipeline padrão (apenas para conta filha; se já existir, pula)
  if (input.tipo_conta === "filha") {
    const { data: pipeExistente } = await supabase
      .from("pipelines")
      .select("id")
      .eq("empresa_id", empresa.id)
      .limit(1)
      .maybeSingle();

    if (!pipeExistente) {
      const { data: pipeline, error: pErr } = await supabase
        .from("pipelines")
        .insert({ empresa_id: empresa.id, nome: "Pipeline Padrão", ativo: true })
        .select("id")
        .single();
      if (!pErr && pipeline) {
        await supabase.from("pipeline_etapas").insert(
          ETAPAS_PADRAO.map((e) => ({ ...e, pipeline_id: pipeline.id })),
        );
      }
    }
  }

  // 6) Perfil comercial inicial (para qualquer tipo de conta)
  const { data: perfilExistente } = await supabase
    .from("empresa_perfil_comercial")
    .select("id")
    .eq("empresa_id", empresa.id)
    .maybeSingle();
  if (!perfilExistente) {
    await supabase.from("empresa_perfil_comercial").insert({
      empresa_id: empresa.id,
      nome_unidade: input.empresa_nome,
      nome_fantasia: input.empresa_nome,
      telefone: input.empresa_telefone || null,
      whatsapp: input.empresa_telefone || null,
      email: input.empresa_email || null,
      validade_orcamento_padrao_dias: 7,
      formas_pagamento_padrao: ["Pix", "Cartão de crédito", "Cartão de débito", "Dinheiro"],
      parcelamento_padrao: "Até 3x",
      termos_orcamento_padrao: "Valores sujeitos à avaliação técnica.",
      observacao_orcamento_padrao: "Orçamento válido conforme prazo informado.",
      ativo: true,
    });
  }

  // 7) Garantir sessão (caso confirm email esteja off, signUp já cria sessão)
  if (!authData.session) {
    await supabase.auth.signInWithPassword({
      email: input.admin_email,
      password: input.admin_senha,
    });
  }

  return { empresa_id: empresa.id, usuario_id: usuarioId, tipo_conta: input.tipo_conta };
}
