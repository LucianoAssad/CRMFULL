using Microsoft.EntityFrameworkCore;
using LeadChatHub.Core.Entities;

namespace LeadChatHub.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Empresa> Empresas => Set<Empresa>();
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<UsuarioConta> UsuariosContas => Set<UsuarioConta>();
    public DbSet<CanalConectado> CanaisConectados => Set<CanalConectado>();
    public DbSet<CanalConta> CanalContas => Set<CanalConta>();
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<Conversa> Conversas => Set<Conversa>();
    public DbSet<Mensagem> Mensagens => Set<Mensagem>();
    public DbSet<ConversaoOffline> ConversoesOffline => Set<ConversaoOffline>();
    public DbSet<ProdutoServico> ProdutosServicos => Set<ProdutoServico>();
    public DbSet<Venda> Vendas => Set<Venda>();
    public DbSet<ItemVenda> ItensVenda => Set<ItemVenda>();
    public DbSet<Pipeline> Pipelines => Set<Pipeline>();
    public DbSet<PipelineEtapa> PipelineEtapas => Set<PipelineEtapa>();
    public DbSet<WhatsappTemplate> WhatsappTemplates => Set<WhatsappTemplate>();
    public DbSet<Campanha> Campanhas => Set<Campanha>();
    public DbSet<CampanhaConta> CampanhaContas => Set<CampanhaConta>();
    public DbSet<CampanhaDestinatario> CampanhaDestinatarios => Set<CampanhaDestinatario>();
    public DbSet<CampanhaLog> CampanhaLogs => Set<CampanhaLog>();
    public DbSet<OptOut> OptOuts => Set<OptOut>();
    public DbSet<EventoConversa> EventosConversa => Set<EventoConversa>();
    public DbSet<Orcamento> Orcamentos => Set<Orcamento>();
    public DbSet<OrcamentoItem> OrcamentoItens => Set<OrcamentoItem>();
    public DbSet<NotaInterna> NotasInternas => Set<NotaInterna>();
    public DbSet<RespostaRapida> RespostasRapidas => Set<RespostaRapida>();
    public DbSet<LeadIdentidade> LeadIdentidades => Set<LeadIdentidade>();
    public DbSet<Oportunidade> Oportunidades => Set<Oportunidade>();
    public DbSet<Arquivo> Arquivos => Set<Arquivo>();
    public DbSet<WebhookConfig> WebhooksConfig => Set<WebhookConfig>();
    public DbSet<Importacao> Importacoes => Set<Importacao>();
    public DbSet<PerfilComercial> PerfisComerciais => Set<PerfilComercial>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<SolicitacaoVinculoConta> SolicitacoesVinculoConta => Set<SolicitacaoVinculoConta>();
    public DbSet<ContaVinculo> ContasVinculos => Set<ContaVinculo>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<ConversaNota> ConversaNotas => Set<ConversaNota>();
    public DbSet<ConversaoDestino> ConversaoDestinos => Set<ConversaoDestino>();
    public DbSet<ExportacaoConversao> ExportacoesConversoes => Set<ExportacaoConversao>();
    public DbSet<ConfiguracaoConversao> ConfiguracoesConversao => Set<ConfiguracaoConversao>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Empresa self-referencing
        modelBuilder.Entity<Empresa>()
            .HasOne(e => e.ContaGerente)
            .WithMany(e => e.ContasFilhas)
            .HasForeignKey(e => e.ContaGerenteId)
            .OnDelete(DeleteBehavior.SetNull);

        // UsuarioConta unique
        modelBuilder.Entity<UsuarioConta>()
            .HasIndex(uc => new { uc.UsuarioId, uc.ContaId }).IsUnique();

        // CanalConta unique
        modelBuilder.Entity<CanalConta>()
            .HasIndex(cc => new { cc.CanalConectadoId, cc.ContaFilhaId }).IsUnique();

        // CampanhaConta unique
        modelBuilder.Entity<CampanhaConta>()
            .HasIndex(cc => new { cc.CampanhaId, cc.ContaId }).IsUnique();

        // LeadIdentidade unique
        modelBuilder.Entity<LeadIdentidade>()
            .HasIndex(li => new { li.LeadId, li.Canal, li.Identificador }).IsUnique();

        // WhatsappTemplate unique
        modelBuilder.Entity<WhatsappTemplate>()
            .HasIndex(wt => new { wt.EmpresaId, wt.NomeExterno, wt.Idioma }).IsUnique();

        // Usuario unique per empresa
        modelBuilder.Entity<Usuario>()
            .HasIndex(u => new { u.EmpresaId, u.Email }).IsUnique();

        // PerfilComercial unique per empresa
        modelBuilder.Entity<PerfilComercial>()
            .HasIndex(p => p.EmpresaId).IsUnique();

        // Configure all DateTime as UTC
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime) || property.ClrType == typeof(DateTime?))
                {
                    property.SetColumnType("timestamptz");
                }
            }
        }
    }

    public override int SaveChanges()
    {
        UpdateTimestamps();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        UpdateTimestamps();
        return base.SaveChangesAsync(ct);
    }

    private void UpdateTimestamps()
    {
        var entries = ChangeTracker.Entries()
            .Where(e => e.State == EntityState.Modified);

        foreach (var entry in entries)
        {
            var prop = entry.Properties.FirstOrDefault(p => p.Metadata.Name == "UpdatedAt");
            if (prop != null) prop.CurrentValue = DateTime.UtcNow;
        }
    }
}
