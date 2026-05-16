using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using LeadChatHub.Application.Services;

namespace LeadChatHub.API.Controllers;

[ApiController]
[Route("api/hierarchy")]
[Authorize]
public class HierarchyController : ControllerBase
{
    private readonly AccountHierarchyService _hierarchy;

    public HierarchyController(AccountHierarchyService hierarchy) => _hierarchy = hierarchy;

    [HttpGet("user-has-conta")]
    public async Task<IActionResult> UserHasConta([FromQuery] Guid userId, [FromQuery] Guid contaId)
    {
        var has = await _hierarchy.UserHasContaAsync(userId, contaId);
        return Ok(new { has });
    }

    [HttpGet("user-is-admin")]
    public async Task<IActionResult> UserIsAdmin([FromQuery] Guid userId, [FromQuery] Guid contaId)
    {
        var isAdmin = await _hierarchy.UserIsAdminForContaAsync(userId, contaId);
        return Ok(new { isAdmin });
    }

    [HttpGet("scoped-contas/{contaId}")]
    public async Task<IActionResult> GetScopedContas(Guid contaId)
    {
        var ids = await _hierarchy.GetScopedContaIdsAsync(contaId);
        return Ok(ids);
    }
}
