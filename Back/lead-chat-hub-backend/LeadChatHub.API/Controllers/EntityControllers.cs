using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LeadChatHub.Core.Entities;
using LeadChatHub.Infrastructure.Data;
using LeadChatHub.Application.Services;

namespace LeadChatHub.API.Controllers;

// ===================== Empresas =====================
[ApiController, Route("api/empresas")]
public class EmpresasController : CrudController<Empresa>
{
    public EmpresasController(AppDbContext db) : base(db) { }

    [HttpGet("by-codigo/{codigo}")]
    public async Task<IActionResult> GetByCodigo(string codigo)
    {
        var e = await Db.Empresas.FirstOrDefaultAsync(x => x.CodigoPublico == codigo);
        return e == null ? NotFound() : Ok(e);
    }

    [HttpGet("{id}/filhas")]
    public async Task<IActionResult> GetFilhas(Guid id)
    {
        var filhas = await Db.Empresas.Where(e => e.ContaGerenteId == id).ToListAsync();
        return Ok(filhas);
    }
}

// ===================== Usuarios =====================
[ApiController, Route("api/usuarios")]
public class UsuariosController : CrudController<Usuario>
{
    public UsuariosController(AppDbContext db) : base(db) { }

    [HttpGet("by-email")]
    public async Task<IActionResult> GetByEmail([FromQuery] string email)
    {
        var u = await Db.Usuarios.FirstOrDefaultAsync(x => x.Email.ToLower() == email.ToLower());
        return u == null ? NotFound() : Ok(u);
    }
}

// ===================== UsuariosContas =====================
[ApiController, Route("api/usuarios-contas")]
public class UsuariosContasController : CrudController<UsuarioConta>
{
    public UsuariosContasController(AppDbContext db) : base(db) { }

    [HttpGet("by-usuario/{usuarioId}")]
    public async Task<IActionResult> GetByUsuario(Guid usuarioId)
    {
        var items = await Db.UsuariosContas
            .Where(uc => uc.UsuarioId == usuarioId)
            .Include(uc => uc.Conta)
            .ToListAsync();
        return Ok(items);
    }

    [HttpGet("by-conta/{contaId}")]
    public async Task<IActionResult> GetByConta(Guid contaId)
    {
        var items = await Db.UsuariosContas
            .Where(uc => uc.ContaId == contaId)
            .Include(uc => uc.Usuario)
            .ToListAsync();
        return Ok(items);
    }
}

// ===================== CanaisConectados =====================
[ApiController, Route("api/canais-conectados")]
public class CanaisConectadosController : CrudController<CanalConectado>
{
    public CanaisConectadosController(AppDbContext db) : base(db) { }
}

// ===================== CanalContas =====================
[ApiController, Route("api/canal-contas")]
public class CanalContasController : CrudController<CanalConta>
{
    public CanalContasController(AppDbContext db) : base(db) { }
}

// ===================== Leads =====================
[ApiController, Route("api/leads")]
public class LeadsController : CrudController<Lead>
{
    private readonly LeadScoringService _scoring;
    public LeadsController(AppDbContext db, LeadScoringService scoring) : base(db) { _scoring = scoring; }

    [HttpGet("by-empresa/{empresaId}")]
    public async Task<IActionResult> GetByEmpresa(Guid empresaId, [FromQuery] int limit = 100, [FromQuery] int offset = 0)
    {
        var items = await Db.Leads
            .Where(l => l.EmpresaId == empresaId)
            .OrderByDescending(l => l.Score)
            .Skip(offset).Take(limit)
            .ToListAsync();
        return Ok(items);
    }

    [HttpPost("{id}/recalcular-score")]
    public async Task<IActionResult> RecalcularScore(Guid id)
    {
        var score = await _scoring.RecalcularScoreAsync(id);
        return Ok(new { score });
    }
}

// ===================== Conversas =====================
[ApiController, Route("api/conversas")]
public class ConversasController : CrudController<Conversa>
{
    public ConversasController(AppDbContext db) : base(db) { }

    [HttpGet("by-empresa/{empresaId}")]
    public async Task<IActionResult> GetByEmpresa(Guid empresaId, [FromQuery] int limit = 50, [FromQuery] int offset = 0)
    {
        var items = await Db.Conversas
            .Where(c => c.EmpresaId == empresaId)
            .Include(c => c.Lead)
            .OrderByDescending(c => c.UltimaMensagemEm)
            .Skip(offset).Take(limit)
            .ToListAsync();
        return Ok(items);
    }

    [HttpPatch("{id}/mark-read")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        var c = await Db.Conversas.FindAsync(id);
        if (c == null) return NotFound();
        c.NaoLidas = 0;
        await Db.SaveChangesAsync();
        return Ok(c);
    }
}

// ===================== Mensagens =====================
[ApiController, Route("api/mensagens")]
public class MensagensController : CrudController<Mensagem>
{
    public MensagensController(AppDbContext db) : base(db) { }

    [HttpGet("by-conversa/{conversaId}")]
    public async Task<IActionResult> GetByConversa(Guid conversaId, [FromQuery] int limit = 100, [FromQuery] int offset = 0)
    {
        var items = await Db.Mensagens
            .Where(m => m.ConversaId == conversaId)
            .OrderBy(m => m.CreatedAt)
            .Skip(offset).Take(limit)
            .ToListAsync();
        return Ok(items);
    }
}

// ===================== ConversoesOffline =====================
[ApiController, Route("api/conversoes-offline")]
public class ConversoesOfflineController : CrudController<ConversaoOffline>
{
    public ConversoesOfflineController(AppDbContext db) : base(db) { }
}

// ===================== ProdutosServicos =====================
[ApiController, Route("api/produtos-servicos")]
public class ProdutosServicosController : CrudController<ProdutoServico>
{
    public ProdutosServicosController(AppDbContext db) : base(db) { }
}

// ===================== Vendas =====================
[ApiController, Route("api/vendas")]
public class VendasController : CrudController<Venda>
{
    public VendasController(AppDbContext db) : base(db) { }

    [HttpGet("{id}/with-items")]
    public async Task<IActionResult> GetWithItems(Guid id)
    {
        var v = await Db.Vendas.Include(v => v.Itens).FirstOrDefaultAsync(v => v.Id == id);
        return v == null ? NotFound() : Ok(v);
    }
}

// ===================== ItensVenda =====================
[ApiController, Route("api/itens-venda")]
public class ItensVendaController : CrudController<ItemVenda>
{
    public ItensVendaController(AppDbContext db) : base(db) { }

    public override async Task<IActionResult> Create([FromBody] ItemVenda entity)
    {
        Db.ItensVenda.Add(entity);
        await Db.SaveChangesAsync();
        // Recalculate venda total
        await RecalcVendaTotal(entity.VendaId);
        return Created("", entity);
    }

    public override async Task<IActionResult> Delete(Guid id)
    {
        var item = await Db.ItensVenda.FindAsync(id);
        if (item == null) return NotFound();
        var vendaId = item.VendaId;
        Db.ItensVenda.Remove(item);
        await Db.SaveChangesAsync();
        await RecalcVendaTotal(vendaId);
        return NoContent();
    }

    private async Task RecalcVendaTotal(Guid vendaId)
    {
        var venda = await Db.Vendas.FindAsync(vendaId);
        if (venda == null) return;
        venda.ValorTotal = await Db.ItensVenda.Where(i => i.VendaId == vendaId).SumAsync(i => i.ValorTotal);
        await Db.SaveChangesAsync();
    }
}

// ===================== Pipelines =====================
[ApiController, Route("api/pipelines")]
public class PipelinesController : CrudController<Pipeline>
{
    public PipelinesController(AppDbContext db) : base(db) { }

    [HttpGet("{id}/with-etapas")]
    public async Task<IActionResult> GetWithEtapas(Guid id)
    {
        var p = await Db.Pipelines.Include(p => p.Etapas.OrderBy(e => e.Ordem)).FirstOrDefaultAsync(p => p.Id == id);
        return p == null ? NotFound() : Ok(p);
    }
}

// ===================== PipelineEtapas =====================
[ApiController, Route("api/pipeline-etapas")]
public class PipelineEtapasController : CrudController<PipelineEtapa>
{
    public PipelineEtapasController(AppDbContext db) : base(db) { }
}

// ===================== WhatsappTemplates =====================
[ApiController, Route("api/whatsapp-templates")]
public class WhatsappTemplatesController : CrudController<WhatsappTemplate>
{
    public WhatsappTemplatesController(AppDbContext db) : base(db) { }
}

// ===================== Campanhas =====================
[ApiController, Route("api/campanhas")]
public class CampanhasController : CrudController<Campanha>
{
    public CampanhasController(AppDbContext db) : base(db) { }
}

// ===================== CampanhaContas =====================
[ApiController, Route("api/campanha-contas")]
public class CampanhaContasController : CrudController<CampanhaConta>
{
    public CampanhaContasController(AppDbContext db) : base(db) { }
}

// ===================== CampanhaDestinatarios =====================
[ApiController, Route("api/campanha-destinatarios")]
public class CampanhaDestinatariosController : CrudController<CampanhaDestinatario>
{
    public CampanhaDestinatariosController(AppDbContext db) : base(db) { }
}

// ===================== CampanhaLogs =====================
[ApiController, Route("api/campanha-logs")]
public class CampanhaLogsController : CrudController<CampanhaLog>
{
    public CampanhaLogsController(AppDbContext db) : base(db) { }
}

// ===================== OptOuts =====================
[ApiController, Route("api/opt-outs")]
public class OptOutsController : CrudController<OptOut>
{
    public OptOutsController(AppDbContext db) : base(db) { }
}

// ===================== EventosConversa =====================
[ApiController, Route("api/eventos-conversa")]
public class EventosConversaController : CrudController<EventoConversa>
{
    public EventosConversaController(AppDbContext db) : base(db) { }
}

// ===================== Orcamentos =====================
[ApiController, Route("api/orcamentos")]
public class OrcamentosController : CrudController<Orcamento>
{
    public OrcamentosController(AppDbContext db) : base(db) { }

    [HttpGet("{id}/with-items")]
    public async Task<IActionResult> GetWithItems(Guid id)
    {
        var o = await Db.Orcamentos.Include(o => o.Itens).FirstOrDefaultAsync(o => o.Id == id);
        return o == null ? NotFound() : Ok(o);
    }
}

// ===================== OrcamentoItens =====================
[ApiController, Route("api/orcamento-itens")]
public class OrcamentoItensController : CrudController<OrcamentoItem>
{
    public OrcamentoItensController(AppDbContext db) : base(db) { }
}

// ===================== NotasInternas =====================
[ApiController, Route("api/notas-internas")]
public class NotasInternasController : CrudController<NotaInterna>
{
    public NotasInternasController(AppDbContext db) : base(db) { }
}

// ===================== RespostasRapidas =====================
[ApiController, Route("api/respostas-rapidas")]
public class RespostasRapidasController : CrudController<RespostaRapida>
{
    public RespostasRapidasController(AppDbContext db) : base(db) { }
}

// ===================== LeadIdentidades =====================
[ApiController, Route("api/lead-identidades")]
public class LeadIdentidadesController : CrudController<LeadIdentidade>
{
    public LeadIdentidadesController(AppDbContext db) : base(db) { }
}

// ===================== Oportunidades =====================
[ApiController, Route("api/oportunidades")]
public class OportunidadesController : CrudController<Oportunidade>
{
    public OportunidadesController(AppDbContext db) : base(db) { }
}

// ===================== Arquivos =====================
[ApiController, Route("api/arquivos")]
public class ArquivosController : CrudController<Arquivo>
{
    public ArquivosController(AppDbContext db) : base(db) { }
}

// ===================== WebhooksConfig =====================
[ApiController, Route("api/webhooks-config")]
public class WebhooksConfigController : CrudController<WebhookConfig>
{
    public WebhooksConfigController(AppDbContext db) : base(db) { }
}

// ===================== Importacoes =====================
[ApiController, Route("api/importacoes")]
public class ImportacoesController : CrudController<Importacao>
{
    public ImportacoesController(AppDbContext db) : base(db) { }
}

// ===================== PerfilComercial =====================
[ApiController, Route("api/perfil-comercial")]
public class PerfilComercialController : CrudController<PerfilComercial>
{
    public PerfilComercialController(AppDbContext db) : base(db) { }

    [HttpGet("by-empresa/{empresaId}")]
    public async Task<IActionResult> GetByEmpresa(Guid empresaId)
    {
        var p = await Db.PerfisComerciais.FirstOrDefaultAsync(x => x.EmpresaId == empresaId);
        return p == null ? NotFound() : Ok(p);
    }
}

// ===================== SolicitacoesVinculoConta =====================
[ApiController, Route("api/solicitacoes-vinculo-conta")]
public class SolicitacoesVinculoContaController : CrudController<SolicitacaoVinculoConta>
{
    public SolicitacoesVinculoContaController(AppDbContext db) : base(db) { }
}

// ===================== ContasVinculos =====================
[ApiController, Route("api/contas-vinculos")]
public class ContasVinculosController : CrudController<ContaVinculo>
{
    public ContasVinculosController(AppDbContext db) : base(db) { }
}

// ===================== AuditLogs =====================
[ApiController, Route("api/audit-logs")]
public class AuditLogsController : CrudController<AuditLog>
{
    public AuditLogsController(AppDbContext db) : base(db) { }
}

// ===================== ConversaNotas =====================
[ApiController, Route("api/conversa-notas")]
public class ConversaNotasController : CrudController<ConversaNota>
{
    public ConversaNotasController(AppDbContext db) : base(db) { }

    [HttpGet("by-conversa/{conversaId}")]
    public async Task<IActionResult> GetByConversa(Guid conversaId)
    {
        var items = await Db.ConversaNotas
            .Where(n => n.ConversaId == conversaId)
            .OrderBy(n => n.CreatedAt)
            .ToListAsync();
        return Ok(items);
    }
}

// ===================== ConversaoDestinos =====================
[ApiController, Route("api/conversao-destinos")]
public class ConversaoDestinosController : CrudController<ConversaoDestino>
{
    public ConversaoDestinosController(AppDbContext db) : base(db) { }
}

// ===================== ExportacoesConversoes =====================
[ApiController, Route("api/exportacoes-conversoes")]
public class ExportacoesConversoesController : CrudController<ExportacaoConversao>
{
    public ExportacoesConversoesController(AppDbContext db) : base(db) { }
}

// ===================== ConfiguracoesConversao =====================
[ApiController, Route("api/configuracoes-conversao")]
public class ConfiguracoesConversaoController : CrudController<ConfiguracaoConversao>
{
    public ConfiguracoesConversaoController(AppDbContext db) : base(db) { }
}
