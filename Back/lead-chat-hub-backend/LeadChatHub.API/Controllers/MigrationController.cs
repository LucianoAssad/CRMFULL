using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LeadChatHub.Infrastructure.Data;

namespace LeadChatHub.API.Controllers;

[ApiController]
[Route("api/admin/migrate")]
public class MigrationController : ControllerBase
{
    private readonly AppDbContext _db;
    public MigrationController(AppDbContext db) => _db = db;

    [HttpPost("run-sql")]
    public async Task<IActionResult> RunSql([FromBody] RunSqlRequest req)
    {
        if (req.Secret != "migrate-secret-2024")
            return Unauthorized();

        try
        {
            await _db.Database.ExecuteSqlRawAsync(req.Sql);
            return Ok(new { success = true, message = "SQL executado com sucesso" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, error = ex.Message });
        }
    }
}

public record RunSqlRequest(string Secret, string Sql);
