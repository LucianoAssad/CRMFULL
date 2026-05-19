using System.Linq.Expressions;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LeadChatHub.Infrastructure.Data;

namespace LeadChatHub.API.Controllers;

/// <summary>
/// Base controller providing CRUD for all entity types via EF Core directly.
/// Subclasses just specify the entity and route.
/// Enforces multi-tenant isolation: queries are automatically scoped to the
/// authenticated user's accessible empresa_ids (via usuarios_contas).
/// Super admins bypass scope enforcement.
/// </summary>
[Authorize]
public abstract class CrudController<T> : ControllerBase where T : class
{
    protected readonly AppDbContext Db;
    protected CrudController(AppDbContext db) => Db = db;

    protected Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Guid.Empty.ToString());
    protected string? UserRole => User.FindFirstValue(ClaimTypes.Role);
    protected Guid? UserEmpresaId
    {
        get
        {
            var v = User.FindFirstValue("empresa_id");
            return v != null ? Guid.Parse(v) : null;
        }
    }

    /// <summary>
    /// Returns the empresa IDs the current user has access to.
    /// Super_admin gets all empresas. Others get only their vinculadas.
    /// </summary>
    protected async Task<List<Guid>?> GetScopedEmpresaIds()
    {
        if (UserRole == "super_admin") return null; // null = no filter needed
        var userId = UserId;
        var ids = await Db.UsuariosContas
            .Where(uc => uc.UsuarioId == userId && uc.Ativo)
            .Select(uc => uc.ContaId)
            .ToListAsync();
        return ids;
    }

    /// <summary>
    /// Applies empresa_id scope to a queryable if the entity has EmpresaId property.
    /// Returns empty sequence if user has no accessible empresas.
    /// </summary>
    protected async Task<IQueryable<T>> ApplyTenantScope(IQueryable<T> query)
    {
        var empresaIdProp = typeof(T).GetProperty("EmpresaId");
        if (empresaIdProp == null) return query; // entity has no empresa_id, skip

        var scopedIds = await GetScopedEmpresaIds();
        if (scopedIds == null) return query; // super_admin, no filter

        if (scopedIds.Count == 0) return Enumerable.Empty<T>().AsQueryable();

        // Build WHERE EmpresaId IN (scopedIds) using expression trees
        var param = Expression.Parameter(typeof(T), "x");
        var prop = Expression.Property(param, empresaIdProp);
        var containsMethod = typeof(List<Guid>).GetMethod("Contains", new[] { typeof(Guid) })!;
        var listExpr = Expression.Constant(scopedIds);
        var call = Expression.Call(listExpr, containsMethod, prop);
        var lambda = Expression.Lambda<Func<T, bool>>(call, param);
        return query.Where(lambda);
    }

    [HttpGet]
    public virtual async Task<IActionResult> GetAll([FromQuery] int limit = 1000, [FromQuery] int offset = 0)
    {
        var query = await ApplyTenantScope(Db.Set<T>().AsNoTracking());
        var items = await query.Skip(offset).Take(limit).ToListAsync();
        return Ok(items);
    }

    [HttpGet("{id}")]
    public virtual async Task<IActionResult> GetById(Guid id)
    {
        var item = await Db.Set<T>().FindAsync(id);
        if (item == null) return NotFound();
        return Ok(item);
    }

    [HttpPost]
    public virtual async Task<IActionResult> Create([FromBody] T entity)
    {
        Db.Set<T>().Add(entity);
        await Db.SaveChangesAsync();
        return Created("", entity);
    }

    [HttpPut("{id}")]
    public virtual async Task<IActionResult> Update(Guid id, [FromBody] T entity)
    {
        var existing = await Db.Set<T>().FindAsync(id);
        if (existing == null) return NotFound();
        Db.Entry(existing).CurrentValues.SetValues(entity);
        await Db.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpPatch("{id}")]
    public virtual async Task<IActionResult> Patch(Guid id, [FromBody] Dictionary<string, object?> fields)
    {
        var existing = await Db.Set<T>().FindAsync(id);
        if (existing == null) return NotFound();

        var entry = Db.Entry(existing);
        foreach (var (key, value) in fields)
        {
            var prop = entry.Properties.FirstOrDefault(p =>
                string.Equals(p.Metadata.Name, key, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(p.Metadata.GetColumnName(), key, StringComparison.OrdinalIgnoreCase));
            if (prop != null && prop.Metadata.Name != "Id")
            {
                try
                {
                    var targetType = Nullable.GetUnderlyingType(prop.Metadata.ClrType) ?? prop.Metadata.ClrType;
                    if (value == null)
                        prop.CurrentValue = null;
                    else if (value is System.Text.Json.JsonElement je)
                        prop.CurrentValue = ConvertJsonElement(je, targetType);
                    else
                        prop.CurrentValue = Convert.ChangeType(value, targetType);
                    prop.IsModified = true;
                }
                catch { /* skip invalid fields */ }
            }
        }
        await Db.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpDelete("{id}")]
    public virtual async Task<IActionResult> Delete(Guid id)
    {
        var item = await Db.Set<T>().FindAsync(id);
        if (item == null) return NotFound();
        Db.Set<T>().Remove(item);
        await Db.SaveChangesAsync();
        return NoContent();
    }

    private static object? ConvertJsonElement(System.Text.Json.JsonElement je, Type target)
    {
        if (target == typeof(string)) return je.GetString();
        if (target == typeof(int)) return je.GetInt32();
        if (target == typeof(long)) return je.GetInt64();
        if (target == typeof(decimal)) return je.GetDecimal();
        if (target == typeof(double)) return je.GetDouble();
        if (target == typeof(bool)) return je.GetBoolean();
        if (target == typeof(Guid)) return je.GetGuid();
        if (target == typeof(DateTime)) return je.GetDateTime();
        return je.ToString();
    }
}
