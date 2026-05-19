using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using LeadChatHub.Core.Enums;

namespace LeadChatHub.Core.Entities;

[Table("empresas")]
public class Empresa
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    public string Nome { get; set; } = "";
    public string? Documento { get; set; }
    public string? Site { get; set; }
    public string? Telefone { get; set; }
    public string? Email { get; set; }
    public bool Ativo { get; set; } = true;
    [Column("tipo_conta")][JsonPropertyName("tipo_conta")] public string TipoConta { get; set; } = "filha";
    [Column("conta_gerente_id")][JsonPropertyName("conta_gerente_id")] public Guid? ContaGerenteId { get; set; }
    [Column("codigo_publico")][JsonPropertyName("codigo_publico")] public string? CodigoPublico { get; set; }
    [Column("created_at")][JsonPropertyName("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("ContaGerenteId")] public Empresa? ContaGerente { get; set; }
    public ICollection<Empresa> ContasFilhas { get; set; } = new List<Empresa>();
    public ICollection<Usuario> Usuarios { get; set; } = new List<Usuario>();
    public ICollection<UsuarioConta> UsuariosContas { get; set; } = new List<UsuarioConta>();
}

[Table("usuarios")]
public class Usuario
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    public string Nome { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Telefone { get; set; }
    public string Role { get; set; } = "atendente";
    [Column("password_hash")] public string? PasswordHash { get; set; }
    public bool Ativo { get; set; } = true;
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("EmpresaId")] public Empresa? Empresa { get; set; }
    public ICollection<UsuarioConta> UsuariosContas { get; set; } = new List<UsuarioConta>();
}

[Table("usuarios_contas")]
public class UsuarioConta
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("usuario_id")] public Guid UsuarioId { get; set; }
    [Column("conta_id")] public Guid ContaId { get; set; }
    public string Role { get; set; } = "atendente";
    public bool Ativo { get; set; } = true;
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("UsuarioId")] public Usuario? Usuario { get; set; }
    [ForeignKey("ContaId")] public Empresa? Conta { get; set; }
}

[Table("canais_conectados")]
public class CanalConectado
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    public string Tipo { get; set; } = "whatsapp";
    public string Nome { get; set; } = "";
    public string? Identificador { get; set; }
    [Column("nome_exibicao")] public string? NomeExibicao { get; set; }
    public string? Provider { get; set; }
    [Column("configuracoes")] public string Configuracoes { get; set; } = "{}";
    public bool Ativo { get; set; } = true;
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("EmpresaId")] public Empresa? Empresa { get; set; }
}

[Table("canal_contas")]
public class CanalConta
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("canal_conectado_id")] public Guid CanalConectadoId { get; set; }
    [Column("conta_filha_id")] public Guid ContaFilhaId { get; set; }
    public bool Ativo { get; set; } = true;
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("CanalConectadoId")] public CanalConectado? CanalConectado { get; set; }
    [ForeignKey("ContaFilhaId")] public Empresa? ContaFilha { get; set; }
}

[Table("leads")]
public class Lead
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    public string Nome { get; set; } = "";
    public string? Telefone { get; set; }
    public string? Email { get; set; }
    [Column("avatar_url")] public string? AvatarUrl { get; set; }
    public string Status { get; set; } = "novo";
    public string? Origem { get; set; }
    public string[]? Tags { get; set; }
    public string? Notas { get; set; }
    [Column("valor_estimado")] public decimal? ValorEstimado { get; set; }
    [Column("convertido_em")] public DateTime? ConvertidoEm { get; set; }
    public int Score { get; set; } = 0;
    public string? Gclid { get; set; }
    public string? Fbclid { get; set; }
    public string? Ttclid { get; set; }
    [Column("utm_source")] public string? UtmSource { get; set; }
    [Column("utm_medium")] public string? UtmMedium { get; set; }
    [Column("utm_campaign")] public string? UtmCampaign { get; set; }
    [Column("utm_content")] public string? UtmContent { get; set; }
    [Column("utm_term")] public string? UtmTerm { get; set; }
    [Column("page_url")] public string? PageUrl { get; set; }
    public bool Convertido { get; set; } = false;
    [Column("valor_conversao")] public decimal? ValorConversao { get; set; }
    [Column("data_conversao")] public DateTime? DataConversao { get; set; }
    [Column("nome_conversao")] public string? NomeConversao { get; set; }
    [Column("tipo_pessoa")] public string? TipoPessoa { get; set; }
    public string? Cpf { get; set; }
    [Column("data_nascimento")] public DateTime? DataNascimento { get; set; }
    [Column("razao_social")] public string? RazaoSocial { get; set; }
    [Column("nome_fantasia")] public string? NomeFantasia { get; set; }
    public string? Cnpj { get; set; }
    [Column("inscricao_estadual")] public string? InscricaoEstadual { get; set; }
    public string? Cep { get; set; }
    public string? Rua { get; set; }
    public string? Numero { get; set; }
    public string? Bairro { get; set; }
    public string? Cidade { get; set; }
    public string? Estado { get; set; }
    [Column("complemento")] public string? Complemento { get; set; }
    [Column("telefone2")] public string? Telefone2 { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("EmpresaId")] public Empresa? Empresa { get; set; }
    public ICollection<Conversa> Conversas { get; set; } = new List<Conversa>();
}

[Table("conversas")]
public class Conversa
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    [Column("lead_id")] public Guid LeadId { get; set; }
    [Column("canal_id")] public Guid? CanalId { get; set; }
    public string Status { get; set; } = "aberta";
    [Column("ultima_mensagem")] public string? UltimaMensagem { get; set; }
    [Column("ultima_mensagem_em")] public DateTime? UltimaMensagemEm { get; set; } = DateTime.UtcNow;
    [Column("nao_lidas")] public int NaoLidas { get; set; } = 0;
    [Column("conta_filha_pendente")] public bool ContaFilhaPendente { get; set; } = false;
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("EmpresaId")] public Empresa? Empresa { get; set; }
    [ForeignKey("LeadId")] public Lead? Lead { get; set; }
    [ForeignKey("CanalId")] public CanalConectado? Canal { get; set; }
    public ICollection<Mensagem> Mensagens { get; set; } = new List<Mensagem>();
}

[Table("mensagens")]
public class Mensagem
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("conversa_id")] public Guid ConversaId { get; set; }
    public string Direcao { get; set; } = "inbound";
    public string Conteudo { get; set; } = "";
    public string? Autor { get; set; }
    public bool Lida { get; set; } = false;
    public string Tipo { get; set; } = "texto";
    public string Metadata { get; set; } = "{}";
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("ConversaId")] public Conversa? Conversa { get; set; }
}

[Table("conversoes_offline")]
public class ConversaoOffline
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    [Column("lead_id")] public Guid LeadId { get; set; }
    public decimal Valor { get; set; } = 0;
    public string? Descricao { get; set; }
    [Column("convertido_em")] public DateTime ConvertidoEm { get; set; } = DateTime.UtcNow;
    [Column("conversa_id")] public Guid? ConversaId { get; set; }
    public string? Plataforma { get; set; }
    [Column("nome_conversao")] public string? NomeConversao { get; set; }
    [Column("data_conversao")] public DateTime? DataConversao { get; set; }
    public string? Gclid { get; set; }
    public string? Fbclid { get; set; }
    public string? Ttclid { get; set; }
    public string? Email { get; set; }
    public string? Telefone { get; set; }
    [Column("status_envio")] public string StatusEnvio { get; set; } = "pendente";
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("EmpresaId")] public Empresa? Empresa { get; set; }
    [ForeignKey("LeadId")] public Lead? Lead { get; set; }
}

[Table("produtos_servicos")]
public class ProdutoServico
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    public string Nome { get; set; } = "";
    public string? Descricao { get; set; }
    public string Tipo { get; set; } = "produto";
    [Column("valor_padrao")] public decimal ValorPadrao { get; set; } = 0;
    public bool Ativo { get; set; } = true;
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("EmpresaId")] public Empresa? Empresa { get; set; }
}

[Table("vendas")]
public class Venda
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    [Column("lead_id")] public Guid LeadId { get; set; }
    [Column("conversa_id")] public Guid? ConversaId { get; set; }
    [Column("valor_total")] public decimal ValorTotal { get; set; } = 0;
    public string Status { get; set; } = "fechada";
    [Column("data_venda")] public DateTime DataVenda { get; set; } = DateTime.UtcNow;
    public string? Observacoes { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("EmpresaId")] public Empresa? Empresa { get; set; }
    [ForeignKey("LeadId")] public Lead? Lead { get; set; }
    public ICollection<ItemVenda> Itens { get; set; } = new List<ItemVenda>();
}

[Table("itens_venda")]
public class ItemVenda
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("venda_id")] public Guid VendaId { get; set; }
    [Column("produto_servico_id")] public Guid ProdutoServicoId { get; set; }
    [Column("nome_produto")] public string? NomeProduto { get; set; }
    public decimal Quantidade { get; set; } = 1;
    [Column("valor_unitario")] public decimal ValorUnitario { get; set; } = 0;
    [Column("valor_total")] public decimal ValorTotal { get; set; } = 0;
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("VendaId")] public Venda? Venda { get; set; }
    [ForeignKey("ProdutoServicoId")] public ProdutoServico? ProdutoServico { get; set; }
}

[Table("pipelines")]
public class Pipeline
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    public string Nome { get; set; } = "";
    public bool Ativo { get; set; } = true;
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("EmpresaId")] public Empresa? Empresa { get; set; }
    public ICollection<PipelineEtapa> Etapas { get; set; } = new List<PipelineEtapa>();
}

[Table("pipeline_etapas")]
public class PipelineEtapa
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("pipeline_id")] public Guid PipelineId { get; set; }
    public string Nome { get; set; } = "";
    public int Ordem { get; set; } = 0;
    public string Cor { get; set; } = "#3b82f6";
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("PipelineId")] public Pipeline? Pipeline { get; set; }
}

[Table("whatsapp_templates")]
public class WhatsappTemplate
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    public string Nome { get; set; } = "";
    [Column("nome_externo")] public string NomeExterno { get; set; } = "";
    public string Idioma { get; set; } = "pt_BR";
    public string Categoria { get; set; } = "UTILITY";
    public string Corpo { get; set; } = "";
    public string Variaveis { get; set; } = "[]";
    public string Status { get; set; } = "draft";
    public bool Ativo { get; set; } = true;
    public string Provider { get; set; } = "cloud_api";
    [Column("external_id")] public string? ExternalId { get; set; }
    [Column("botao_cta")] public string? BotaoCta { get; set; }
    public string Escopo { get; set; } = "conta";
    [Column("conta_gerente_id")] public Guid? ContaGerenteId { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("EmpresaId")] public Empresa? Empresa { get; set; }
}

[Table("campanhas")]
public class Campanha
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    [Column("criada_por_conta_id")] public Guid? CriadaPorContaId { get; set; }
    [Column("conta_gerente_id")] public Guid? ContaGerenteId { get; set; }
    public string Escopo { get; set; } = "conta";
    public string Nome { get; set; } = "";
    public string? Descricao { get; set; }
    public string Canal { get; set; } = "whatsapp_oficial";
    public string Status { get; set; } = "rascunho";
    [Column("template_id")] public Guid? TemplateId { get; set; }
    public string? Assunto { get; set; }
    public string? Mensagem { get; set; }
    public string Variaveis { get; set; } = "[]";
    public string Filtros { get; set; } = "{}";
    [Column("agendada_para")] public DateTime? AgendadaPara { get; set; }
    [Column("iniciada_em")] public DateTime? IniciadaEm { get; set; }
    [Column("finalizada_em")] public DateTime? FinalizadaEm { get; set; }
    [Column("total_destinatarios")] public int TotalDestinatarios { get; set; } = 0;
    [Column("total_enviados")] public int TotalEnviados { get; set; } = 0;
    [Column("total_falhas")] public int TotalFalhas { get; set; } = 0;
    [Column("total_optout")] public int TotalOptout { get; set; } = 0;
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("EmpresaId")] public Empresa? Empresa { get; set; }
}

[Table("campanha_contas")]
public class CampanhaConta
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("campanha_id")] public Guid CampanhaId { get; set; }
    [Column("conta_id")] public Guid ContaId { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("campanha_destinatarios")]
public class CampanhaDestinatario
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("campanha_id")] public Guid CampanhaId { get; set; }
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    [Column("lead_id")] public Guid? LeadId { get; set; }
    [Column("contato_nome")] public string? ContatoNome { get; set; }
    [Column("contato_telefone")] public string? ContatoTelefone { get; set; }
    [Column("contato_email")] public string? ContatoEmail { get; set; }
    public string Status { get; set; } = "pendente";
    [Column("enviado_em")] public DateTime? EnviadoEm { get; set; }
    [Column("entregue_em")] public DateTime? EntregueEm { get; set; }
    [Column("lido_em")] public DateTime? LidoEm { get; set; }
    public string? Erro { get; set; }
    [Column("external_id")] public string? ExternalId { get; set; }
    public string Metadata { get; set; } = "{}";
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

[Table("campanha_logs")]
public class CampanhaLog
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("campanha_id")] public Guid CampanhaId { get; set; }
    [Column("destinatario_id")] public Guid? DestinatarioId { get; set; }
    public string Evento { get; set; } = "";
    public string Nivel { get; set; } = "info";
    public string? Mensagem { get; set; }
    public string Payload { get; set; } = "{}";
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("opt_outs")]
public class OptOut
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    [Column("lead_id")] public Guid? LeadId { get; set; }
    public string Canal { get; set; } = "whatsapp";
    public string? Telefone { get; set; }
    public string? Email { get; set; }
    public string? Motivo { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("eventos_conversa")]
public class EventoConversa
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("conversa_id")] public Guid ConversaId { get; set; }
    public string Tipo { get; set; } = "";
    public string Payload { get; set; } = "{}";
    [Column("usuario_id")] public Guid? UsuarioId { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("orcamentos")]
public class Orcamento
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    [Column("lead_id")] public Guid? LeadId { get; set; }
    [Column("conversa_id")] public Guid? ConversaId { get; set; }
    [Column("oportunidade_id")] public Guid? OportunidadeId { get; set; }
    [Column("operador_id")] public Guid? OperadorId { get; set; }
    [Column("operador_nome")] public string? OperadorNome { get; set; }
    [Column("vendedor_id")] public Guid? VendedorId { get; set; }
    public int Numero { get; set; } = 0;
    public string? Titulo { get; set; }
    public string Status { get; set; } = "rascunho";
    public string Moeda { get; set; } = "BRL";
    public decimal Subtotal { get; set; } = 0;
    [Column("desconto_total")] public decimal DescontoTotal { get; set; } = 0;
    [Column("taxas_total")] public decimal TaxasTotal { get; set; } = 0;
    [Column("valor_total")] public decimal ValorTotal { get; set; } = 0;
    [Column("validade_em")] public DateTime? ValidadeEm { get; set; }
    [Column("condicoes_pagamento")] public string? CondicoesPagamento { get; set; }
    public string? Termos { get; set; }
    [Column("observacoes_cliente")] public string? ObservacoesCliente { get; set; }
    [Column("observacoes_internas")] public string? ObservacoesInternas { get; set; }
    [Column("mensagem_chat")] public string? MensagemChat { get; set; }
    [Column("pdf_url")] public string? PdfUrl { get; set; }
    [Column("pdf_gerado_em")] public DateTime? PdfGeradoEm { get; set; }
    [Column("enviado_em")] public DateTime? EnviadoEm { get; set; }
    [Column("convertido_venda_id")] public Guid? ConvertidoVendaId { get; set; }
    [Column("created_by")] public Guid? CreatedBy { get; set; }
    [Column("updated_by")] public Guid? UpdatedBy { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<OrcamentoItem> Itens { get; set; } = new List<OrcamentoItem>();
}

[Table("orcamento_itens")]
public class OrcamentoItem
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("orcamento_id")] public Guid OrcamentoId { get; set; }
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    [Column("produto_id")] public Guid? ProdutoId { get; set; }
    public string? Categoria { get; set; }
    public string Descricao { get; set; } = "";
    public string? Servico { get; set; }
    public decimal Quantidade { get; set; } = 1;
    public string Unidade { get; set; } = "un";
    public string? Medida { get; set; }
    public string? Material { get; set; }
    [Column("nivel_sujeira")] public string? NivelSujeira { get; set; }
    [Column("valor_unitario")] public decimal ValorUnitario { get; set; } = 0;
    public decimal Desconto { get; set; } = 0;
    [Column("valor_total")] public decimal ValorTotal { get; set; } = 0;
    [Column("observacao_tecnica")] public string? ObservacaoTecnica { get; set; }
    public int Ordem { get; set; } = 0;
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("OrcamentoId")] public Orcamento? Orcamento { get; set; }
}

[Table("notas_internas")]
public class NotaInterna
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("conversa_id")] public Guid ConversaId { get; set; }
    [Column("usuario_id")] public Guid? UsuarioId { get; set; }
    public string Conteudo { get; set; } = "";
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("respostas_rapidas")]
public class RespostaRapida
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    public string Atalho { get; set; } = "";
    public string Conteudo { get; set; } = "";
    public bool Ativo { get; set; } = true;
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

[Table("lead_identidades")]
public class LeadIdentidade
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("lead_id")] public Guid LeadId { get; set; }
    public string Canal { get; set; } = "whatsapp";
    public string Identificador { get; set; } = "";
    [Column("nome_exibicao")] public string? NomeExibicao { get; set; }
    [Column("avatar_url")] public string? AvatarUrl { get; set; }
    public bool Verificado { get; set; } = false;
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("LeadId")] public Lead? Lead { get; set; }
}

[Table("oportunidades")]
public class Oportunidade
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    [Column("lead_id")] public Guid LeadId { get; set; }
    [Column("pipeline_id")] public Guid? PipelineId { get; set; }
    [Column("etapa_id")] public Guid? EtapaId { get; set; }
    public string Titulo { get; set; } = "";
    public decimal? Valor { get; set; } = 0;
    public string Status { get; set; } = "aberta";
    [Column("responsavel_id")] public Guid? ResponsavelId { get; set; }
    [Column("data_fechamento")] public DateTime? DataFechamento { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

[Table("arquivos")]
public class Arquivo
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    public string Nome { get; set; } = "";
    [Column("tipo_mime")] public string? TipoMime { get; set; }
    public long? Tamanho { get; set; }
    public string Url { get; set; } = "";
    [Column("entidade_tipo")] public string? EntidadeTipo { get; set; }
    [Column("entidade_id")] public Guid? EntidadeId { get; set; }
    [Column("uploaded_por")] public Guid? UploadedPor { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("webhooks_config")]
public class WebhookConfig
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    public string Url { get; set; } = "";
    public string[]? Eventos { get; set; }
    public bool Ativo { get; set; } = true;
    public string? Secret { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

[Table("importacoes")]
public class Importacao
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    public string Tipo { get; set; } = "leads";
    [Column("arquivo_nome")] public string? ArquivoNome { get; set; }
    public string Status { get; set; } = "pendente";
    [Column("total_registros")] public int TotalRegistros { get; set; } = 0;
    [Column("registros_sucesso")] public int RegistrosSucesso { get; set; } = 0;
    [Column("registros_erro")] public int RegistrosErro { get; set; } = 0;
    public string Erros { get; set; } = "[]";
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

[Table("perfil_comercial")]
public class PerfilComercial
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("empresa_id")] public Guid EmpresaId { get; set; }
    [Column("nome_empresa")] public string? NomeEmpresa { get; set; }
    public string? Descricao { get; set; }
    [Column("logo_url")] public string? LogoUrl { get; set; }
    [Column("cor_primaria")] public string? CorPrimaria { get; set; } = "#3b82f6";
    public string? Telefone { get; set; }
    public string? Email { get; set; }
    public string? Site { get; set; }
    public string? Endereco { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

[Table("refresh_tokens")]
public class RefreshToken
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("usuario_id")] public Guid UsuarioId { get; set; }
    public string Token { get; set; } = "";
    [Column("expires_at")] public DateTime ExpiresAt { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("UsuarioId")] public Usuario? Usuario { get; set; }
}

[Table("audit_logs")]
public class AuditLog
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("usuario_id")] public Guid? UsuarioId { get; set; }
    [Column("empresa_id")] public Guid? EmpresaId { get; set; }
    public string Acao { get; set; } = "";
    public string? Entidade { get; set; }
    [Column("entidade_id")] public Guid? EntidadeId { get; set; }
    [Column("dados_antes")] public string? DadosAntes { get; set; }
    [Column("dados_depois")] public string? DadosDepois { get; set; }
    public string? Ip { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
