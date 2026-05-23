using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LeadChatHub.Core.Entities;
using LeadChatHub.Infrastructure.Data;

namespace LeadChatHub.API.Controllers;

[ApiController, Route("api/mensagens-programadas")]
public class MensagensProgramadasController : CrudController<MensagemProgramada>
{
    public MensagensProgramadasController(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/agendamentos")]
public class AgendamentosController : CrudController<Agendamento>
{
    public AgendamentosController(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/chatbot-fluxos")]
public class ChatbotFluxosController : CrudController<ChatbotFluxo>
{
    public ChatbotFluxosController(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/afiliados")]
public class AfiliadosController : CrudController<Afiliado>
{
    public AfiliadosController(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/indicacoes")]
public class IndicacoesController : CrudController<Indicacao>
{
    public IndicacoesController(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/integracoes-externas")]
public class IntegracoesExternasController : CrudController<IntegracaoExterna>
{
    public IntegracoesExternasController(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/base-conhecimento")]
public class BaseConhecimentoController : CrudController<BaseConhecimento>
{
    public BaseConhecimentoController(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/conversa-notas")]
public class ConversaNotasV2Controller : CrudController<ConversaNota>
{
    public ConversaNotasV2Controller(AppDbContext db) : base(db) { }

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
public class ContasVinculosV2Controller : CrudController<ContaVinculo>
{
    public ContasVinculosV2Controller(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/solicitacoes-vinculo-conta")]
public class SolicitacoesVinculoContaV2Controller : CrudController<SolicitacaoVinculoConta>
{
    public SolicitacoesVinculoContaV2Controller(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/conversao-destinos")]
public class ConversaoDestinosV2Controller : CrudController<ConversaoDestino>
{
    public ConversaoDestinosV2Controller(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/exportacoes-conversoes")]
public class ExportacoesConversoesV2Controller : CrudController<ExportacaoConversao>
{
    public ExportacoesConversoesV2Controller(AppDbContext db) : base(db) { }
}

[ApiController, Route("api/configuracoes-conversao")]
public class ConfiguracoesConversaoController : CrudController<ConfiguracaoConversao>
{
    public ConfiguracoesConversaoController(AppDbContext db) : base(db) { }
}
