using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LeadChatHub.Core.Entities;
using LeadChatHub.Infrastructure.Data;

namespace LeadChatHub.API.Controllers;

// P2/P3 controllers — class names use suffix "Ex" to avoid duplicate-name compile error
// Route attributes are the real API paths used by the frontend.

[ApiController, Route("api/mensagens-programadas")]
public class MensagensProgramadasExController : CrudController<MensagemProgramada>
{
    public MensagensProgramadasExController(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/agendamentos")]
public class AgendamentosExController : CrudController<Agendamento>
{
    public AgendamentosExController(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/chatbot-fluxos")]
public class ChatbotFluxosExController : CrudController<ChatbotFluxo>
{
    public ChatbotFluxosExController(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/afiliados")]
public class AfiliadosExController : CrudController<Afiliado>
{
    public AfiliadosExController(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/indicacoes")]
public class IndicacoesExController : CrudController<Indicacao>
{
    public IndicacoesExController(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/integracoes-externas")]
public class IntegracoesExternasExController : CrudController<IntegracaoExterna>
{
    public IntegracoesExternasExController(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/base-conhecimento")]
public class BaseConhecimentoExController : CrudController<BaseConhecimento>
{
    public BaseConhecimentoExController(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/conversa-notas")]
public class ConversaNotasExController : CrudController<ConversaNota>
{
    public ConversaNotasExController(AppDbContext db) : base(db) { }

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

[ApiController, Route("api/contas-vinculos")]
public class ContasVinculosExController : CrudController<ContaVinculo>
{
    public ContasVinculosExController(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/solicitacoes-vinculo-conta")]
public class SolicitacoesVinculoContaExController : CrudController<SolicitacaoVinculoConta>
{
    public SolicitacoesVinculoContaExController(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/conversao-destinos")]
public class ConversaoDestinosExController : CrudController<ConversaoDestino>
{
    public ConversaoDestinosExController(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/exportacoes-conversoes")]
public class ExportacoesConversoesExController : CrudController<ExportacaoConversao>
{
    public ExportacoesConversoesExController(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/configuracoes-conversao")]
public class ConfiguracoesConversaoExController : CrudController<ConfiguracaoConversao>
{
    public ConfiguracoesConversaoExController(AppDbContext db) : base(db) { }
}
// trigger deploy v4 - column mapping fix
