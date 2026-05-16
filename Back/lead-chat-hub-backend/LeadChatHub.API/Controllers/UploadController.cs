using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using LeadChatHub.Application.Services;

namespace LeadChatHub.API.Controllers;

[ApiController]
[Route("api/upload")]
[Authorize]
public class UploadController : ControllerBase
{
    private readonly FileStorageService _storage;

    public UploadController(FileStorageService storage) => _storage = storage;

    [HttpPost]
    public async Task<IActionResult> Upload(
        IFormFile file,
        [FromForm] Guid empresaId,
        [FromForm] string? entidadeTipo,
        [FromForm] Guid? entidadeId)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "Arquivo é obrigatório" });

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var arquivo = await _storage.UploadAsync(file, empresaId, userId, entidadeTipo, entidadeId);
        return Ok(arquivo);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var ok = await _storage.DeleteAsync(id);
        if (!ok) return NotFound();
        return NoContent();
    }
}
