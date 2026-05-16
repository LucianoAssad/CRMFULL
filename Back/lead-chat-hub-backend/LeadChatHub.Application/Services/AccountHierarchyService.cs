using Microsoft.EntityFrameworkCore;
using LeadChatHub.Infrastructure.Data;

namespace LeadChatHub.Application.Services;

public class AccountHierarchyService
{
    private readonly AppDbContext _db;

    public AccountHierarchyService(AppDbContext db) => _db = db;

    public async Task<bool> UserHasContaAsync(Guid userId, Guid contaId)
    {
        // Direct access
        var direct = await _db.UsuariosContas.AnyAsync(uc =>
            uc.UsuarioId == userId && uc.ContaId == contaId && uc.Ativo);
        if (direct) return true;

        // Access via parent (gerente) account
        var userContas = await _db.UsuariosContas
            .Where(uc => uc.UsuarioId == userId && uc.Ativo)
            .Select(uc => uc.ContaId)
            .ToListAsync();

        foreach (var ucContaId in userContas)
        {
            if (await ContaIsDescendantOfAsync(contaId, ucContaId))
                return true;
        }
        return false;
    }

    public async Task<bool> UserIsAdminForContaAsync(Guid userId, Guid contaId)
    {
        var adminRoles = new[] { "super_admin", "admin_gerente", "admin_filha" };

        var directRole = await _db.UsuariosContas
            .Where(uc => uc.UsuarioId == userId && uc.ContaId == contaId && uc.Ativo)
            .Select(uc => uc.Role)
            .FirstOrDefaultAsync();

        if (directRole != null && adminRoles.Contains(directRole)) return true;

        // Check via hierarchy
        var adminContas = await _db.UsuariosContas
            .Where(uc => uc.UsuarioId == userId && uc.Ativo && adminRoles.Contains(uc.Role))
            .Select(uc => uc.ContaId)
            .ToListAsync();

        foreach (var ac in adminContas)
        {
            if (await ContaIsDescendantOfAsync(contaId, ac))
                return true;
        }
        return false;
    }

    public async Task<bool> ContaIsDescendantOfAsync(Guid childId, Guid parentId)
    {
        if (childId == parentId) return false;
        var current = await _db.Empresas.Where(e => e.Id == childId).Select(e => e.ContaGerenteId).FirstOrDefaultAsync();
        int hops = 0;
        while (current != null && hops < 50)
        {
            if (current == parentId) return true;
            current = await _db.Empresas.Where(e => e.Id == current).Select(e => e.ContaGerenteId).FirstOrDefaultAsync();
            hops++;
        }
        return false;
    }

    public async Task<List<Guid>> GetScopedContaIdsAsync(Guid contaId)
    {
        var empresa = await _db.Empresas.FindAsync(contaId);
        if (empresa == null) return new List<Guid>();
        if (empresa.TipoConta == "filha") return new List<Guid> { contaId };

        // Gerente: get all descendents
        var result = new List<Guid> { contaId };
        await CollectDescendants(contaId, result);
        return result;
    }

    private async Task CollectDescendants(Guid parentId, List<Guid> result)
    {
        var children = await _db.Empresas
            .Where(e => e.ContaGerenteId == parentId)
            .Select(e => e.Id)
            .ToListAsync();
        foreach (var child in children)
        {
            result.Add(child);
            await CollectDescendants(child, result);
        }
    }
}
