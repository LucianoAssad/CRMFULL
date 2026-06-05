namespace LeadChatHub.Core.DTOs;

public record LoginRequest(string Email, string Password);
public record LoginResponse(string AccessToken, string RefreshToken, DateTime ExpiresAt, UsuarioDto Usuario);
public record RefreshRequest(string RefreshToken);
public record RegisterRequest(string Nome, string Email, string Password, string? Telefone, Guid EmpresaId);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

// Cadastro público completo (cria empresa + usuário admin)
public record SignupRequest(
    string EmpresaNome,
    string TipoConta,       // "filha" | "gerente"
    string? EmpresaEmail,
    string? EmpresaTelefone,
    string AdminNome,
    string AdminEmail,
    string AdminSenha
);
public record SignupResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    string EmpresaId,
    string UsuarioId,
    string TipoConta
);

public record UsuarioDto(
    Guid Id, Guid EmpresaId, string Nome, string Email, string? Telefone,
    string Role, bool Ativo, DateTime CreatedAt, bool PrimeiroAcesso = false
);
