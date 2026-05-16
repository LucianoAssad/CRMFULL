/**
 * Type definitions for the Lead Chat Hub database schema.
 * These types mirror the PostgreSQL tables and are used throughout the frontend.
 * Maintained for compatibility with existing code that references Database types.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Simplified - no longer tied to Supabase internal types
export type Database = {
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
    };
  };
};

// === Entity types for direct use ===

export interface Empresa {
  id: string;
  nome: string;
  documento?: string;
  site?: string;
  telefone?: string;
  email?: string;
  ativo: boolean;
  tipo_conta: "gerente" | "filha";
  conta_gerente_id?: string;
  codigo_publico?: string;
  created_at: string;
}

export interface Usuario {
  id: string;
  empresa_id: string;
  nome: string;
  email: string;
  telefone?: string;
  role: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface UsuarioConta {
  id: string;
  usuario_id: string;
  conta_id: string;
  role: string;
  ativo: boolean;
  created_at: string;
}

export interface Lead {
  id: string;
  empresa_id: string;
  nome: string;
  telefone?: string;
  email?: string;
  avatar_url?: string;
  status: string;
  origem?: string;
  tags?: string[];
  notas?: string;
  valor_estimado?: number;
  convertido_em?: string;
  score: number;
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  page_url?: string;
  convertido: boolean;
  valor_conversao?: number;
  data_conversao?: string;
  nome_conversao?: string;
  tipo_pessoa?: string;
  cpf?: string;
  data_nascimento?: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  inscricao_estadual?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  created_at: string;
  updated_at: string;
}

export interface Conversa {
  id: string;
  empresa_id: string;
  lead_id: string;
  canal_id?: string;
  status: string;
  ultima_mensagem?: string;
  ultima_mensagem_em?: string;
  nao_lidas: number;
  conta_filha_pendente: boolean;
  created_at: string;
  updated_at: string;
  lead?: Lead;
}

export interface Mensagem {
  id: string;
  conversa_id: string;
  direcao: string;
  conteudo: string;
  autor?: string;
  lida: boolean;
  tipo: string;
  metadata: any;
  created_at: string;
}

export interface CanalConectado {
  id: string;
  empresa_id: string;
  tipo: string;
  nome: string;
  identificador?: string;
  nome_exibicao?: string;
  provider?: string;
  configuracoes: any;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Venda {
  id: string;
  empresa_id: string;
  lead_id: string;
  conversa_id?: string;
  valor_total: number;
  status: string;
  data_venda: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProdutoServico {
  id: string;
  empresa_id: string;
  nome: string;
  descricao?: string;
  tipo: string;
  valor_padrao: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsappTemplate {
  id: string;
  empresa_id: string;
  nome: string;
  nome_externo: string;
  idioma: string;
  categoria: string;
  corpo: string;
  variaveis: any;
  status: string;
  ativo: boolean;
  provider: string;
  external_id?: string;
  botao_cta?: any;
  escopo: string;
  conta_gerente_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Campanha {
  id: string;
  empresa_id: string;
  nome: string;
  descricao?: string;
  canal: string;
  status: string;
  template_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Pipeline {
  id: string;
  empresa_id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineEtapa {
  id: string;
  pipeline_id: string;
  nome: string;
  ordem: number;
  cor: string;
  created_at: string;
  updated_at: string;
}

export interface Orcamento {
  id: string;
  empresa_id: string;
  lead_id: string;
  conversa_id?: string;
  numero?: string;
  valor_total: number;
  status: string;
  validade_dias?: number;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}
