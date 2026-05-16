using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using LeadChatHub.Core.DTOs;
using LeadChatHub.Core.Entities;
using LeadChatHub.Infrastructure.Data;

namespace LeadChatHub.Application.Services;

public class AuthService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AuthService(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public async Task<LoginResponse?> LoginAsync(LoginRequest req)
    {
        var user = await _db.Usuarios
            .FirstOrDefaultAsync(u => u.Email.ToLower() == req.Email.ToLower() && u.Ativo);
        if (user == null) return null;
        if (string.IsNullOrEmpty(user.PasswordHash)) return null;
        if (!BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash)) return null;

        var (accessToken, expiresAt) = GenerateJwt(user);
        var refreshToken = await CreateRefreshTokenAsync(user.Id);

        return new LoginResponse(accessToken, refreshToken, expiresAt, MapUser(user));
    }

    public async Task<LoginResponse?> RefreshAsync(string refreshTokenStr)
    {
        var rt = await _db.RefreshTokens
            .Include(r => r.Usuario)
            .FirstOrDefaultAsync(r => r.Token == refreshTokenStr && r.ExpiresAt > DateTime.UtcNow);
        if (rt?.Usuario == null || !rt.Usuario.Ativo) return null;

        _db.RefreshTokens.Remove(rt);
        await _db.SaveChangesAsync();

        var (accessToken, expiresAt) = GenerateJwt(rt.Usuario);
        var newRefresh = await CreateRefreshTokenAsync(rt.Usuario.Id);

        return new LoginResponse(accessToken, newRefresh, expiresAt, MapUser(rt.Usuario));
    }

    public async Task<UsuarioDto?> RegisterAsync(RegisterRequest req)
    {
        var exists = await _db.Usuarios.AnyAsync(u => u.Email.ToLower() == req.Email.ToLower() && u.EmpresaId == req.EmpresaId);
        if (exists) return null;

        var user = new Usuario
        {
            EmpresaId = req.EmpresaId,
            Nome = req.Nome,
            Email = req.Email,
            Telefone = req.Telefone,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role = "atendente"
        };
        _db.Usuarios.Add(user);

        // Also add to usuarios_contas
        _db.UsuariosContas.Add(new UsuarioConta
        {
            UsuarioId = user.Id,
            ContaId = req.EmpresaId,
            Role = "atendente"
        });

        await _db.SaveChangesAsync();
        return MapUser(user);
    }

    public async Task<bool> ChangePasswordAsync(Guid userId, ChangePasswordRequest req)
    {
        var user = await _db.Usuarios.FindAsync(userId);
        if (user == null) return false;
        if (!BCrypt.Net.BCrypt.Verify(req.CurrentPassword, user.PasswordHash)) return false;
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task RevokeRefreshTokensAsync(Guid userId)
    {
        var tokens = await _db.RefreshTokens.Where(t => t.UsuarioId == userId).ToListAsync();
        _db.RefreshTokens.RemoveRange(tokens);
        await _db.SaveChangesAsync();
    }

    private (string token, DateTime expiresAt) GenerateJwt(Usuario user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            _config["Jwt:Key"] ?? "SuperSecretKeyForLeadChatHub2024!Min32Chars"));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresAt = DateTime.UtcNow.AddHours(
            int.TryParse(_config["Jwt:ExpirationHours"], out var h) ? h : 24);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, user.Nome),
            new("empresa_id", user.EmpresaId.ToString()),
            new(ClaimTypes.Role, user.Role)
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? "LeadChatHub",
            audience: _config["Jwt:Audience"] ?? "LeadChatHub",
            claims: claims,
            expires: expiresAt,
            signingCredentials: creds
        );

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }

    private async Task<string> CreateRefreshTokenAsync(Guid userId)
    {
        var token = Convert.ToBase64String(Guid.NewGuid().ToByteArray()) +
                    Convert.ToBase64String(Guid.NewGuid().ToByteArray());
        var rt = new RefreshToken
        {
            UsuarioId = userId,
            Token = token,
            ExpiresAt = DateTime.UtcNow.AddDays(30)
        };
        _db.RefreshTokens.Add(rt);
        await _db.SaveChangesAsync();
        return token;
    }

    private static UsuarioDto MapUser(Usuario u) => new(
        u.Id, u.EmpresaId, u.Nome, u.Email, u.Telefone, u.Role, u.Ativo, u.CreatedAt
    );
}
