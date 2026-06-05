using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace LeadChatHub.Application.Services;

public class EmailService
{
    private readonly HttpClient _http;
    private readonly string? _apiKey;
    private readonly string _fromEmail;
    private readonly string _fromName;
    private readonly string _appUrl;
    private readonly ILogger<EmailService> _logger;

    public EmailService(HttpClient http, IConfiguration config, ILogger<EmailService> logger)
    {
        _http = http;
        _apiKey = config["Resend:ApiKey"] ?? Environment.GetEnvironmentVariable("RESEND_API_KEY");
        _fromEmail = config["Resend:FromEmail"] ?? Environment.GetEnvironmentVariable("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
        _fromName = config["Resend:FromName"] ?? "Krescer SMKT";
        _appUrl = config["AppUrl"] ?? Environment.GetEnvironmentVariable("APP_URL") ?? "https://diplomatic-reprieve-production-d59c.up.railway.app";
        _logger = logger;
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_apiKey);

    public async Task<bool> SendWelcomeEmailAsync(string toEmail, string toName, string senhaTemporaria)
    {
        if (!IsConfigured)
        {
            _logger.LogWarning("Resend API Key não configurada — e-mail de boas-vindas não enviado.");
            return false;
        }

        var html = $"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"/></head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #166534; margin: 0;">Krescer SMKT</h1>
                <p style="color: #6b7280; margin: 4px 0 0;">Plataforma de CRM</p>
              </div>

              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <h2 style="margin: 0 0 16px; font-size: 18px;">Olá, {toName}! 👋</h2>
                <p style="margin: 0 0 16px;">Seu acesso ao <strong>Krescer SMKT</strong> foi criado. Use as credenciais abaixo para entrar na plataforma:</p>

                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px 6px 0 0;">
                      <span style="font-size: 12px; color: #6b7280; display: block;">E-mail</span>
                      <strong style="font-size: 15px;">{toEmail}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px;">
                      <span style="font-size: 12px; color: #6b7280; display: block;">Senha temporária</span>
                      <strong style="font-size: 15px; font-family: monospace; letter-spacing: 2px;">{senhaTemporaria}</strong>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center; margin-bottom: 24px;">
                <a href="{_appUrl}/login"
                   style="display: inline-block; background: #166534; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px;">
                  Acessar a plataforma
                </a>
              </div>

              <p style="font-size: 13px; color: #6b7280; text-align: center;">
                Por segurança, recomendamos trocar a senha no primeiro acesso.<br/>
                Se não reconhece este cadastro, ignore este e-mail.
              </p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;"/>
              <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                Krescer SMKT — Plataforma de CRM e Atendimento
              </p>
            </body>
            </html>
            """;

        var payload = new
        {
            from = $"{_fromName} <{_fromEmail}>",
            to = new[] { toEmail },
            subject = "Seu acesso ao Krescer SMKT",
            html
        };

        try
        {
            _http.DefaultRequestHeaders.Clear();
            _http.DefaultRequestHeaders.Add("Authorization", $"Bearer {_apiKey}");

            var response = await _http.PostAsJsonAsync("https://api.resend.com/emails", payload);
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("E-mail de boas-vindas enviado para {Email}", toEmail);
                return true;
            }

            var body = await response.Content.ReadAsStringAsync();
            _logger.LogError("Resend retornou {Status}: {Body}", response.StatusCode, body);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao enviar e-mail via Resend");
            return false;
        }
    }
}
