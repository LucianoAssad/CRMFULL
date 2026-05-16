using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LeadChatHub.Infrastructure.Data;

namespace LeadChatHub.API.Controllers;

/// <summary>
/// Base controller providing CRUD for all entity types via EF Core directly.
/// Subclasses just specify the entity and route.
/// </summary>
[Authorize]
public abstract class CrudController<T> : ControllerBase where T : class
{
    protected readonly AppDbContext Db;
    protected CrudController(AppDbContext db) => Db = db;

    protected Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Guid.Empty.ToString());
    protected Guid? UserEmpresaId
    {
        get
        {
            var v = User.FindFirstValue("empresa_id");
            return v != null ? Guid.Parse(v) : null;
        }
    }

    [HttpGet]
    public virtual async Task<IActionResult> GetAll([FromQuery] int limit = 100, [FromQuery] int offset = 0)
    {
        var items = await Db.Set<T>().AsNoTracking().Skip(offset).Take(limit).ToListAsync();
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
