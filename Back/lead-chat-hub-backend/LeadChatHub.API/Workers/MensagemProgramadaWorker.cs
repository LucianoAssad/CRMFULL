using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using LeadChatHub.API.Hubs;
using LeadChatHub.Core.Entities;
using LeadChatHub.Infrastructure.Data;

namespace LeadChatHub.API.Workers;

/// <summary>
/// Background worker that runs every 60 s and dispatches pending scheduled messages.
/// "Sending" = inserting an outbound Mensagem into the conversation (simulated delivery).
/// Replace the dispatch block with a real WhatsApp/channel call when integration is ready.
/// </summary>
public class MensagemProgramadaWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<ChatHub> _hub;
    private readonly ILogger<MensagemProgramadaWorker> _logger;
    private static readonly TimeSpan _interval = TimeSpan.FromSeconds(60);

    public MensagemProgramadaWorker(IServiceScopeFactory scopeFactory,
                                     IHubContext<ChatHub> hub,
                                     ILogger<MensagemProgramadaWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _hub = hub;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("MensagemProgramadaWorker iniciado.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessarPendentesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao processar mensagens programadas.");
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }

    private async Task ProcessarPendentesAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var agora = DateTime.UtcNow;

        var pendentes = await db.MensagensProgramadas
            .Where(m => m.Status == "pendente" && m.AgendadoPara <= agora)
            .Take(50) // process in batches
            .ToListAsync(ct);

        if (pendentes.Count == 0) return;

        _logger.LogInformation("Processando {Count} mensagens programadas.", pendentes.Count);

        foreach (var mp in pendentes)
        {
            try
            {
                await DespacharAsync(db, mp, ct);
                mp.Status = "enviada";
                mp.EnviadoEm = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Falha ao despachar mensagem {Id}: {Msg}", mp.Id, ex.Message);
                mp.Status = "erro";
                mp.Erro = ex.Message[..Math.Min(ex.Message.Length, 500)];
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task DespacharAsync(AppDbContext db, MensagemProgramada mp, CancellationToken ct)
    {
        // 1. Insert outbound message into the conversation (appears in chat)
        var mensagem = new Mensagem
        {
            Id = Guid.NewGuid(),
            ConversaId = mp.ConversaId,
            Direcao = "outbound",
            Conteudo = mp.Conteudo,
            Tipo = "texto",
            Lida = true,
            Metadata = "{}",
            CreatedAt = DateTime.UtcNow,
        };
        db.Mensagens.Add(mensagem);

        // 2. Update conversation's last message
        var conversa = await db.Conversas.FindAsync(new object[] { mp.ConversaId }, ct);
        if (conversa != null)
        {
            conversa.UltimaMensagem = mp.Conteudo;
            conversa.UltimaMensagemEm = mensagem.CreatedAt;
        }

        // NOTE: When real channel integration is ready, call WhatsAppService here:
        // await whatsAppService.EnviarAsync(conversa.CanalId, lead.Telefone, mp.Conteudo);

        // 3. Push real-time notification via SignalR (no page refresh needed)
        await _hub.NotifyNewMessage(mp.EmpresaId, mp.ConversaId, new
        {
            id          = mensagem.Id,
            conversaId  = mensagem.ConversaId,
            direcao     = mensagem.Direcao,
            conteudo    = mensagem.Conteudo,
            tipo        = mensagem.Tipo,
            createdAt   = mensagem.CreatedAt,
        });

        if (conversa != null)
            await _hub.NotifyConversaUpdated(mp.EmpresaId, new
            {
                id                = conversa.Id,
                ultimaMensagem    = conversa.UltimaMensagem,
                ultimaMensagemEm  = conversa.UltimaMensagemEm,
            });

        _logger.LogInformation("Mensagem programada {Id} despachada para conversa {Conv}.",
            mp.Id, mp.ConversaId);
    }
}
