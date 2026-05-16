export type LeadStatus = "novo" | "em_atendimento" | "qualificado" | "perdido" | "convertido";
export type ConversaStatus = "aberta" | "pendente" | "fechada";
export type MensagemDirecao = "inbound" | "outbound";
export type CanalTipo = string;

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  novo: "Novo",
  em_atendimento: "Em atendimento",
  qualificado: "Qualificado",
  perdido: "Perdido",
  convertido: "Convertido",
};

export const LEAD_STATUS_COLOR: Record<LeadStatus, string> = {
  novo: "bg-info/15 text-info border-info/30",
  em_atendimento: "bg-warning/15 text-warning border-warning/30",
  qualificado: "bg-primary/15 text-primary border-primary/30",
  perdido: "bg-destructive/15 text-destructive border-destructive/30",
  convertido: "bg-success/15 text-success border-success/30",
};

export function scoreTier(score: number): "quente" | "morno" | "frio" {
  if (score >= 50) return "quente";
  if (score >= 20) return "morno";
  return "frio";
}

export const SCORE_TIER_META: Record<"quente" | "morno" | "frio", { label: string; emoji: string; className: string }> = {
  quente: { label: "Quente", emoji: "🔴", className: "bg-destructive/15 text-destructive border-destructive/30" },
  morno: { label: "Morno", emoji: "🟡", className: "bg-warning/15 text-warning border-warning/30" },
  frio: { label: "Frio", emoji: "⚪", className: "bg-muted text-muted-foreground border-border" },
};

// Mapeamento visual operacional para os status existentes no banco.
// Não altera o banco — apenas exibe rótulos de central de atendimento.
export const CONVERSA_STATUS_LABEL: Record<ConversaStatus, string> = {
  aberta: "Aberta",
  pendente: "Aguardando atendente",
  fechada: "Resolvida",
};

export const CONVERSA_STATUS_COLOR: Record<ConversaStatus, string> = {
  aberta: "bg-info/15 text-info border-info/30",
  pendente: "bg-warning/15 text-warning border-warning/30",
  fechada: "bg-success/15 text-success border-success/30",
};

export type ConversaPrioridade = "baixa" | "normal" | "alta" | "urgente";

export const PRIORIDADE_LABEL: Record<ConversaPrioridade, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

export const PRIORIDADE_COLOR: Record<ConversaPrioridade, string> = {
  baixa: "bg-muted text-muted-foreground border-border",
  normal: "bg-info/10 text-info border-info/30",
  alta: "bg-warning/15 text-warning border-warning/30",
  urgente: "bg-destructive/15 text-destructive border-destructive/30",
};

export interface Canal {
  id: string;
  empresa_id: string;
  tipo: string;
  nome: string;
  identificador: string | null;
  ativo: boolean;
  provider?: string | null;
  configuracoes?: Record<string, any> | null;
}

export interface Lead {
  id: string;
  empresa_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  avatar_url: string | null;
  status: LeadStatus;
  origem: string | null;
  tags: string[] | null;
  notas: string | null;
  valor_estimado: number | null;
  convertido_em: string | null;
  created_at: string;
  gclid?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  page_url?: string | null;
  score?: number | null;
  tipo_pessoa?: "fisica" | "juridica" | null;
  cpf?: string | null;
  data_nascimento?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  inscricao_estadual?: string | null;
  cep?: string | null;
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

export interface Conversa {
  id: string;
  empresa_id: string;
  lead_id: string;
  canal_id: string | null;
  status: ConversaStatus;
  prioridade?: ConversaPrioridade;
  responsavel_id?: string | null;
  ultima_mensagem: string | null;
  ultima_mensagem_em: string | null;
  nao_lidas: number;
  conta_filha_pendente?: boolean;
  lead?: Lead;
  canal?: Canal | null;
  responsavel?: { id: string; nome: string } | null;
}

export interface Mensagem {
  id: string;
  conversa_id: string;
  direcao: MensagemDirecao;
  conteudo: string;
  autor: string | null;
  lida: boolean;
  created_at: string;
}

export interface ConversaNota {
  id: string;
  empresa_id: string;
  conversa_id: string;
  usuario_id: string | null;
  conteudo: string;
  created_at: string;
  usuario?: { id: string; nome: string } | null;
}

export type OrcamentoStatus =
  | "rascunho"
  | "pdf_gerado"
  | "enviado"
  | "reenviado"
  | "em_negociacao"
  | "aprovado"
  | "recusado"
  | "expirado"
  | "convertido_em_venda";

export interface EmpresaPerfilComercial {
  id: string;
  empresa_id: string;
  logo_url: string | null;
  nome_unidade: string | null;
  nome_fantasia: string | null;
  razao_social: string | null;
  cnpj: string | null;
  whatsapp: string | null;
  telefone: string | null;
  email: string | null;
  site: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  endereco_cep: string | null;
  cor_primaria: string | null;
  termos_orcamento_padrao: string | null;
  observacao_orcamento_padrao: string | null;
  validade_orcamento_padrao_dias: number;
  formas_pagamento_padrao: string[] | Record<string, any>[];
  parcelamento_padrao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Orcamento {
  id: string;
  empresa_id: string;
  lead_id: string | null;
  conversa_id: string | null;
  oportunidade_id: string | null;
  canal_id: string | null;
  operador_id: string | null;
  operador_nome?: string | null;
  vendedor_id: string | null;
  numero: number;
  titulo: string | null;
  status: OrcamentoStatus;
  moeda: string;
  subtotal: number;
  desconto_total: number;
  taxas_total: number;
  valor_total: number;
  validade_em: string | null;
  condicoes_pagamento: string | null;
  termos: string | null;
  observacoes_cliente: string | null;
  observacoes_internas: string | null;
  mensagem_chat: string | null;
  pdf_url: string | null;
  pdf_gerado_em: string | null;
  enviado_em: string | null;
  convertido_venda_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrcamentoItem {
  id: string;
  orcamento_id: string;
  empresa_id: string;
  produto_id?: string | null;
  categoria: string | null;
  descricao: string;
  servico: string | null;
  quantidade: number;
  unidade: string;
  medida: string | null;
  material: string | null;
  nivel_sujeira: string | null;
  valor_unitario: number;
  desconto: number;
  valor_total: number;
  observacao_tecnica: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface OrcamentoAnexo {
  id: string;
  orcamento_id: string;
  item_id: string | null;
  empresa_id: string;
  tipo: string;
  arquivo_url: string;
  nome_arquivo: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  legenda: string | null;
  exibir_no_pdf: boolean;
  ordem: number;
  uploaded_by: string | null;
  created_at: string;
}
