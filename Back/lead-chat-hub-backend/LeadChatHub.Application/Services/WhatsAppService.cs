using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using LeadChatHub.Core.DTOs;
using LeadChatHub.Core.Entities;
using LeadChatHub.Infrastructure.Data;

namespace LeadChatHub.Application.Services;

public class WhatsAppService
{
    private readonly AppDbContext _db;
    private readonly HttpClient _http;
    private readonly LeadScoringService _scoring;

    public WhatsAppService(AppDbContext db, IHttpClientFactory httpFactory, LeadScoringService scoring)
    {
        _db = db;
        _http = httpFactory.CreateClient();
        _scoring = scoring;
    }

    // =========== WEBHOOK (receive) ===========
    public async Task<bool> HandleWebhookVerification(string? mode, string? token, string? challenge, Action<string> respond)
    {
        if (mode != "subscribe" || string.IsNullOrEmpty(token)) return false;
        var canais = await _db.CanaisConectados
            .Where(c => c.Tipo == "whatsapp" && c.Ativo)
            .ToListAsync();

        foreach (var canal in canais)
        {
            try
            {
                var cfg = JsonDocument.Parse(canal.Configuracoes);
                if (cfg.RootElement.TryGetProperty("webhook_verify_token", out var vt) && vt.GetString() == token)
                {
                    respond(challenge ?? "");
                    return true;
                }
            }
            catch { }
        }
        return false;
    }

    public async Task ProcessWebhookEventAsync(JsonElement body)
    {
        var entries = body.GetProperty("entry").EnumerateArray();
        foreach (var entry in entries)
        {
            foreach (var change in entry.GetProperty("changes").EnumerateArray())
            {
                var value = change.GetProperty("value");
                if (!value.TryGetProperty("metadata", out var meta)) continue;
                if (!meta.TryGetProperty("phone_number_id", out var pnId)) continue;
                var phoneNumberId = pnId.GetString();
                if (string.IsNullOrEmpty(phoneNumberId)) continue;

                var canal = await FindCanalByPhoneNumberId(phoneNumberId);
                if (canal == null) continue;

                if (value.TryGetProperty("messages", out var msgs))
                {
                    foreach (var msg in msgs.EnumerateArray())
                    {
                        await ProcessIncomingMessage(canal, value, msg);
                    }
                }
            }
        }
    }

    private async Task<CanalConectado?> FindCanalByPhoneNumberId(string phoneNumberId)
    {
        var canais = await _db.CanaisConectados
            .Where(c => c.Tipo == "whatsapp" && c.Ativo)
            .ToListAsync();

        return canais.FirstOrDefault(c =>
        {
            try
            {
                var cfg = JsonDocument.Parse(c.Configuracoes);
                return cfg.RootElement.TryGetProperty("phone_number_id", out var p) && p.GetString() == phoneNumberId;
            }
            catch { return false; }
        });
    }

    private async Task ProcessIncomingMessage(CanalConectado canal, JsonElement value, JsonElement msg)
    {
        var from = msg.GetProperty("from").GetString() ?? "";
        var tel = $"+{from}";
        var msgType = msg.TryGetProperty("type", out var t) ? t.GetString() : "text";

        string conteudo = "";
        if (msg.TryGetProperty("text", out var text) && text.TryGetProperty("body", out var tb))
            conteudo = tb.GetString() ?? "";
        else if (msg.TryGetProperty("button", out var btn) && btn.TryGetProperty("text", out var bt))
            conteudo = bt.GetString() ?? "";
        else
            conteudo = $"[{msgType}]";

        var profileName = tel;
        if (value.TryGetProperty("contacts", out var contacts))
        {
            var first = contacts.EnumerateArray().FirstOrDefault();
            if (first.TryGetProperty("profile", out var profile) && profile.TryGetProperty("name", out var name))
                profileName = name.GetString() ?? tel;
        }

        // Find or create lead
        var lead = await _db.Leads
            .FirstOrDefaultAsync(l => l.EmpresaId == canal.EmpresaId && (l.Telefone == tel || l.Telefone == from));

        if (lead == null)
        {
            lead = new Lead
            {
                EmpresaId = canal.EmpresaId,
                Nome = profileName,
                Telefone = tel,
                Origem = "whatsapp"
            };
            _db.Leads.Add(lead);
            await _db.SaveChangesAsync();
        }

        // Find or create conversa
        var conversa = await _db.Conversas
            .Where(c => c.LeadId == lead.Id && c.CanalId == canal.Id && c.Status != "fechada")
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync();

        if (conversa == null)
        {
            conversa = new Conversa
            {
                EmpresaId = canal.EmpresaId,
                LeadId = lead.Id,
                CanalId = canal.Id,
                Status = "aberta"
            };
            _db.Conversas.Add(conversa);
            await _db.SaveChangesAsync();
        }

        // Insert message
        var mensagem = new Mensagem
        {
            ConversaId = conversa.Id,
            Direcao = "inbound",
            Conteudo = conteudo,
            Autor = profileName
        };
        _db.Mensagens.Add(mensagem);

        // Update conversa
        conversa.UltimaMensagem = conteudo;
        conversa.UltimaMensagemEm = DateTime.UtcNow;
        conversa.NaoLidas += 1;
        conversa.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        // Recalculate score
        await _scoring.RecalcularScoreAsync(lead.Id);
    }

    // =========== SEND ===========
    public async Task<WhatsAppSendResponse> SendMessageAsync(WhatsAppSendRequest req)
    {
        var conversa = await _db.Conversas.FindAsync(req.ConversaId);
        if (conversa == null || conversa.CanalId == null)
            return new WhatsAppSendResponse(false, null, "conversa/canal não encontrado");

        var canal = await _db.CanaisConectados.FindAsync(conversa.CanalId);
        if (canal == null || canal.Tipo != "whatsapp")
            return new WhatsAppSendResponse(false, null, "canal não é whatsapp");

        JsonDocument cfg;
        try { cfg = JsonDocument.Parse(canal.Configuracoes); }
        catch { return new WhatsAppSendResponse(false, null, "configuração inválida"); }

        var phoneNumberId = cfg.RootElement.TryGetProperty("phone_number_id", out var p) ? p.GetString() : null;
        var accessToken = cfg.RootElement.TryGetProperty("access_token", out var a) ? a.GetString() : null;
        if (string.IsNullOrEmpty(phoneNumberId) || string.IsNullOrEmpty(accessToken))
            return new WhatsAppSendResponse(false, null, "Canal WhatsApp ainda não está configurado para envio real.");

        var lead = await _db.Leads.FindAsync(conversa.LeadId);
        var to = Regex.Replace(lead?.Telefone ?? "", @"\D", "");
        if (string.IsNullOrEmpty(to))
            return new WhatsAppSendResponse(false, null, "lead sem telefone");

        object waPayload;
        string registroConteudo;
        string tipoMsg = "texto";
        var metadata = new Dictionary<string, object>();

        if (req.Template != null)
        {
            var tpl = await _db.WhatsappTemplates
                .FirstOrDefaultAsync(t => t.EmpresaId == conversa.EmpresaId &&
                    t.NomeExterno == req.Template.NomeExterno && t.Idioma == req.Template.Idioma);
            if (tpl == null) return new WhatsAppSendResponse(false, null, "template não encontrado");
            if (!tpl.Ativo || tpl.Status != "aprovado")
                return new WhatsAppSendResponse(false, null, "template inativo ou não aprovado");

            var required = Regex.Matches(tpl.Corpo, @"\{\{\s*\d+\s*\}\}").Count;
            var vars = req.Template.Variaveis?.Where(v => !string.IsNullOrWhiteSpace(v)).ToArray() ?? Array.Empty<string>();
            if (vars.Length < required)
                return new WhatsAppSendResponse(false, null, "variáveis obrigatórias não preenchidas");

            var components = vars.Length > 0
                ? new[] { new { type = "body", parameters = vars.Select(v => new { type = "text", text = v }).ToArray() } }
                : Array.Empty<object>();

            waPayload = new
            {
                messaging_product = "whatsapp", to,
                type = "template",
                template = new { name = req.Template.NomeExterno, language = new { code = req.Template.Idioma }, components }
            };
            registroConteudo = $"[template:{req.Template.NomeExterno}]";
            tipoMsg = "template";
            metadata["template_id"] = req.Template.TemplateId?.ToString() ?? tpl.Id.ToString();
        }
        else
        {
            waPayload = new { messaging_product = "whatsapp", to, type = "text", text = new { body = req.Conteudo } };
            registroConteudo = req.Conteudo ?? "";
        }

        var request = new HttpRequestMessage(HttpMethod.Post,
            $"https://graph.facebook.com/v20.0/{phoneNumberId}/messages");
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        request.Content = new StringContent(JsonSerializer.Serialize(waPayload), Encoding.UTF8, "application/json");

        var resp = await _http.SendAsync(request);
        var respBody = await resp.Content.ReadAsStringAsync();

        if (!resp.IsSuccessStatusCode)
            return new WhatsAppSendResponse(false, null, $"falha ao enviar: {respBody}");

        string? externalId = null;
        try
        {
            var respDoc = JsonDocument.Parse(respBody);
            externalId = respDoc.RootElement.GetProperty("messages")[0].GetProperty("id").GetString();
        }
        catch { }

        metadata["external_id"] = externalId ?? "";
        metadata["status"] = "enviada";

        _db.Mensagens.Add(new Mensagem
        {
            ConversaId = conversa.Id,
            Direcao = "outbound",
            Conteudo = registroConteudo,
            Autor = "atendente",
            Lida = true,
            Tipo = tipoMsg,
            Metadata = JsonSerializer.Serialize(metadata)
        });

        conversa.UltimaMensagem = registroConteudo;
        conversa.UltimaMensagemEm = DateTime.UtcNow;
        conversa.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        // Recalculate score
        await _scoring.RecalcularScoreAsync(conversa.LeadId);

        return new WhatsAppSendResponse(true, externalId, null);
    }
}
