using Microsoft.AspNetCore.Http;
using LeadChatHub.Core.Entities;
using LeadChatHub.Infrastructure.Data;

namespace LeadChatHub.Application.Services;

public class FileStorageService
{
    private readonly AppDbContext _db;
    private readonly string _uploadPath;

    public FileStorageService(AppDbContext db, Microsoft.Extensions.Configuration.IConfiguration config)
    {
        _db = db;
        _uploadPath = config["Storage:LocalPath"] ?? "uploads";
        Directory.CreateDirectory(_uploadPath);
    }

    public async Task<Arquivo> UploadAsync(IFormFile file, Guid empresaId, Guid? usuarioId,
        string? entidadeTipo = null, Guid? entidadeId = null)
    {
        var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
        var empresaDir = Path.Combine(_uploadPath, empresaId.ToString());
        Directory.CreateDirectory(empresaDir);
        var filePath = Path.Combine(empresaDir, fileName);

        await using var stream = new FileStream(filePath, FileMode.Create);
        await file.CopyToAsync(stream);

        var arquivo = new Arquivo
        {
            EmpresaId = empresaId,
            Nome = file.FileName,
            TipoMime = file.ContentType,
            Tamanho = file.Length,
            Url = $"/uploads/{empresaId}/{fileName}",
            EntidadeTipo = entidadeTipo,
            EntidadeId = entidadeId,
            UploadedPor = usuarioId
        };

        _db.Arquivos.Add(arquivo);
        await _db.SaveChangesAsync();
        return arquivo;
    }

    public async Task<bool> DeleteAsync(Guid arquivoId)
    {
        var arquivo = await _db.Arquivos.FindAsync(arquivoId);
        if (arquivo == null) return false;

        var fullPath = Path.Combine(Directory.GetCurrentDirectory(), arquivo.Url.TrimStart('/'));
        if (File.Exists(fullPath)) File.Delete(fullPath);

        _db.Arquivos.Remove(arquivo);
        await _db.SaveChangesAsync();
        return true;
    }
}
