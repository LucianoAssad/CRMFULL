namespace LeadChatHub.Core.DTOs;

public record LoginRequest(string Email, string Password);
public record LoginResponse(string AccessToken, string RefreshToken, DateTime ExpiresAt, UsuarioDto Usuario);
public record RefreshRequest(string RefreshToken);
public record RegisterRequest(string Nome, string Email, string Password, string? Telefone, Guid EmpresaId);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public record UsuarioDto(
    Guid Id, Guid EmpresaId, string Nome, string Email, string? Telefone,
    string Role, bool Ativo, DateTime CreatedAt
);
