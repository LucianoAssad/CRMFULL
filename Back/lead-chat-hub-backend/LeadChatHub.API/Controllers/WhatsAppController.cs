using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using LeadChatHub.Application.Services;
using LeadChatHub.Core.DTOs;

namespace LeadChatHub.API.Controllers;

[ApiController]
[Route("api/whatsapp")]
public class WhatsAppController : ControllerBase
{
    private readonly WhatsAppService _wa;

    public WhatsAppController(WhatsAppService wa) => _wa = wa;

    /// <summary>
    /// WhatsApp webhook verification (GET)
    /// </summary>
    [HttpGet("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> WebhookVerify(
        [FromQuery(Name = "hub.mode")] string? mode,
        [FromQuery(Name = "hub.verify_token")] string? token,
        [FromQuery(Name = "hub.challenge")] string? challenge)
    {
        string? response = null;
        var ok = await _wa.HandleWebhookVerification(mode, token, challenge, r => response = r);
        if (ok && response != null) return Ok(response);
        return Forbid();
    }

    /// <summary>
    /// WhatsApp webhook events (POST) - receives messages/statuses from Meta
    /// </summary>
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> WebhookEvent()
    {
        using var doc = await JsonDocument.ParseAsync(Request.Body);
        await _wa.ProcessWebhookEventAsync(doc.RootElement);
        return Ok(new { ok = true });
    }

    /// <summary>
    /// Send message or template via WhatsApp
    /// </summary>
    [HttpPost("send")]
    [Authorize]
    public async Task<IActionResult> Send([FromBody] WhatsAppSendRequest req)
    {
        var result = await _wa.SendMessageAsync(req);
        if (!result.Ok) return BadRequest(result);
        return Ok(result);
    }
}
