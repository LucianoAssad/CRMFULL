namespace LeadChatHub.Core.DTOs;

public record WhatsAppSendRequest(
    Guid ConversaId,
    string? Conteudo,
    WhatsAppTemplateRequest? Template
);

public record WhatsAppTemplateRequest(
    string NomeExterno,
    string Idioma,
    string[]? Variaveis,
    Guid? TemplateId
);

public record WhatsAppSendResponse(bool Ok, string? WaMessageId, string? Error, string Mode = "real");
