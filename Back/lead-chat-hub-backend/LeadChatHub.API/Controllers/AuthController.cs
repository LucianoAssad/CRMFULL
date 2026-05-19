using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using LeadChatHub.Application.Services;
using LeadChatHub.Core.DTOs;

namespace LeadChatHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AuthService _auth;

    public AuthController(AuthService auth) => _auth = auth;

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var result = await _auth.LoginAsync(req);
        if (result == null) return Unauthorized(new { error = "Credenciais inválidas" });
        return Ok(result);
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest req)
    {
        var result = await _auth.RefreshAsync(req.RefreshToken);
        if (result == null) return Unauthorized(new { error = "Token inválido ou expirado" });
        return Ok(result);
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        var result = await _auth.RegisterAsync(req);
        if (result == null) return Conflict(new { error = "Usuário já existe" });
        return Created("", result);
    }

    [HttpPost("signup")]
    public async Task<IActionResult> Signup([FromBody] SignupRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.EmpresaNome)) return BadRequest(new { error = "Nome da empresa obrigatório" });
        if (string.IsNullOrWhiteSpace(req.AdminNome)) return BadRequest(new { error = "Nome do administrador obrigatório" });
        if (string.IsNullOrWhiteSpace(req.AdminEmail)) return BadRequest(new { error = "E-mail obrigatório" });
        if (string.IsNullOrWhiteSpace(req.AdminSenha) || req.AdminSenha.Length < 6)
            return BadRequest(new { error = "Senha deve ter ao menos 6 caracteres" });

        var result = await _auth.SignupAsync(req);
        if (result == null) return Conflict(new { error = "E-mail já cadastrado" });
        return Created("", result);
    }

    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var ok = await _auth.ChangePasswordAsync(userId, req);
        if (!ok) return BadRequest(new { error = "Senha atual incorreta" });
        return Ok(new { message = "Senha alterada com sucesso" });
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        await _auth.RevokeRefreshTokensAsync(userId);
        return Ok(new { message = "Logout realizado" });
    }

    [Authorize]
    [HttpGet("me")]
    public IActionResult Me()
    {
        return Ok(new
        {
            id = User.FindFirstValue(ClaimTypes.NameIdentifier),
            email = User.FindFirstValue(ClaimTypes.Email),
            nome = User.FindFirstValue(ClaimTypes.Name),
            empresa_id = User.FindFirstValue("empresa_id"),
            role = User.FindFirstValue(ClaimTypes.Role)
        });
    }
}
