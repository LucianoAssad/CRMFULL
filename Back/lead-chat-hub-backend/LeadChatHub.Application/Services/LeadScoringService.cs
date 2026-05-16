using Microsoft.EntityFrameworkCore;
using LeadChatHub.Infrastructure.Data;

namespace LeadChatHub.Application.Services;

public class LeadScoringService
{
    private readonly AppDbContext _db;

    public LeadScoringService(AppDbContext db) => _db = db;

    public async Task<int> RecalcularScoreAsync(Guid leadId)
    {
        var lead = await _db.Leads.FindAsync(leadId);
        if (lead == null) return 0;

        int score = 0;
        bool hasGclid = !string.IsNullOrEmpty(lead.Gclid);

        // Get messages for this lead
        var messages = await _db.Mensagens
            .Join(_db.Conversas, m => m.ConversaId, c => c.Id, (m, c) => new { m, c })
            .Where(x => x.c.LeadId == leadId)
            .Select(x => new { x.m.Direcao, x.m.Conteudo, x.m.CreatedAt })
            .ToListAsync();

        var inbound = messages.Where(m => m.Direcao == "entrada" || m.Direcao == "inbound").ToList();
        var outbound = messages.Where(m => m.Direcao == "saida" || m.Direcao == "outbound").ToList();

        if (inbound.Count > 1) score += 20;
        if (hasGclid) score += 40;

        // Check intent keywords
        var intentPattern = new[] { "preço", "preco", "valor", "orçamento", "orcamento", "quero", "comprar", "contratar" };
        bool hasIntent = inbound.Any(m => intentPattern.Any(k => m.Conteudo.ToLower().Contains(k)));
        if (hasIntent) score += 30;

        // Quick response bonus
        if (inbound.Any())
        {
            var firstInbound = inbound.Min(m => m.CreatedAt);
            var firstOutboundAfter = outbound
                .Where(m => m.CreatedAt > firstInbound)
                .Select(m => m.CreatedAt)
                .DefaultIfEmpty(DateTime.MaxValue)
                .Min();

            if (firstOutboundAfter != DateTime.MaxValue)
            {
                var responseSeconds = (firstOutboundAfter - firstInbound).TotalSeconds;
                if (responseSeconds <= 300) score += 10;
            }
        }

        // Idle penalties
        if (inbound.Any())
        {
            var lastInbound = inbound.Max(m => m.CreatedAt);
            var hoursSince = (DateTime.UtcNow - lastInbound).TotalHours;
            if (hoursSince > 48) score -= 30;
            else if (hoursSince > 24) score -= 20;
        }

        lead.Score = score;
        await _db.SaveChangesAsync();
        return score;
    }
}
