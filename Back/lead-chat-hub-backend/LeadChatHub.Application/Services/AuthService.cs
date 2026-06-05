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

    public async Task<SignupResponse?> SignupAsync(SignupRequest req)
    {
        // Validar e-mail único
        var emailExiste = await _db.Usuarios.AnyAsync(u => u.Email.ToLower() == req.AdminEmail.ToLower());
        if (emailExiste) return null;

        var tipoConta = req.TipoConta == "gerente" ? "gerente" : "filha";

        // 1. Criar empresa
        var empresa = new Empresa
        {
            Nome = req.EmpresaNome.Trim(),
            TipoConta = tipoConta,
            Email = req.EmpresaEmail?.Trim() ?? null,
            Telefone = req.EmpresaTelefone?.Trim() ?? null,
            Ativo = true
        };
        _db.Empresas.Add(empresa);

        // 2. Criar usuário admin
        var roleAdmin = tipoConta == "gerente" ? "admin_gerente" : "admin_filha";
        var usuario = new Usuario
        {
            EmpresaId = empresa.Id,
            Nome = req.AdminNome.Trim(),
            Email = req.AdminEmail.Trim().ToLower(),
            Telefone = req.EmpresaTelefone?.Trim() ?? null,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.AdminSenha),
            Role = roleAdmin,
            Ativo = true
        };
        _db.Usuarios.Add(usuario);

        // 3. Vínculo usuarios_contas
        _db.UsuariosContas.Add(new UsuarioConta
        {
            UsuarioId = usuario.Id,
            ContaId = empresa.Id,
            Role = roleAdmin,
            Ativo = true
        });

        await _db.SaveChangesAsync();

        // 4. Pipeline padrão (apenas conta filha)
        if (tipoConta == "filha")
        {
            var pipeline = new Pipeline
            {
                EmpresaId = empresa.Id,
                Nome = "Pipeline Padrão",
                Ativo = true
            };
            _db.Pipelines.Add(pipeline);
            await _db.SaveChangesAsync();

            var etapas = new[] {
                new PipelineEtapa { PipelineId = pipeline.Id, Nome = "Novo", Ordem = 1, Cor = "#3b82f6" },
                new PipelineEtapa { PipelineId = pipeline.Id, Nome = "Em atendimento", Ordem = 2, Cor = "#f59e0b" },
                new PipelineEtapa { PipelineId = pipeline.Id, Nome = "Orçamento enviado", Ordem = 3, Cor = "#8b5cf6" },
                new PipelineEtapa { PipelineId = pipeline.Id, Nome = "Negociação", Ordem = 4, Cor = "#06b6d4" },
                new PipelineEtapa { PipelineId = pipeline.Id, Nome = "Ganho", Ordem = 5, Cor = "#10b981" },
                new PipelineEtapa { PipelineId = pipeline.Id, Nome = "Perdido", Ordem = 6, Cor = "#ef4444" },
            };
            _db.PipelineEtapas.AddRange(etapas);
            await _db.SaveChangesAsync();
        }

        // 5. Perfil comercial inicial
        _db.PerfisComerciais.Add(new PerfilComercial
        {
            EmpresaId = empresa.Id,
            NomeEmpresa = req.EmpresaNome,
            Telefone = req.EmpresaTelefone?.Trim() ?? null,
            Email = req.EmpresaEmail?.Trim() ?? null,
        });
        await _db.SaveChangesAsync();

        // 6. Gerar JWT
        var (accessToken, expiresAt) = GenerateJwt(usuario);
        var refreshToken = await CreateRefreshTokenAsync(usuario.Id);

        return new SignupResponse(accessToken, refreshToken, expiresAt,
            empresa.Id.ToString(), usuario.Id.ToString(), tipoConta);
    }

    public async Task<bool> ChangePasswordAsync(Guid userId, ChangePasswordRequest req)
    {
        var user = await _db.Usuarios.FindAsync(userId);
        if (user == null) return false;
        if (!BCrypt.Net.BCrypt.Verify(req.CurrentPassword, user.PasswordHash)) return false;
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        user.PrimeiroAcesso = false; // clear first-access flag
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
        u.Id, u.EmpresaId, u.Nome, u.Email, u.Telefone, u.Role, u.Ativo, u.CreatedAt, u.PrimeiroAcesso
    );
}
