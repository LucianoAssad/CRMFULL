using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using LeadChatHub.API.Hubs;
using LeadChatHub.Application.Services;
using LeadChatHub.Infrastructure.Data;

// v2
var builder = WebApplication.CreateBuilder(args);

// === Database ===
var connStr = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? "Host=localhost;Database=leadchathub;Username=postgres;Password=postgres";

// Railway provides DATABASE_URL in postgres:// format; convert if needed
if (connStr.StartsWith("postgres://") || connStr.StartsWith("postgresql://"))
{
    var uri = new Uri(connStr);
    var userInfo = uri.UserInfo.Split(':');
    connStr = $"Host={uri.Host};Port={uri.Port};Database={uri.AbsolutePath.TrimStart('/')};Username={userInfo[0]};Password={userInfo[1]};SSL Mode=Require;Trust Server Certificate=true";
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connStr));

// === JWT Auth ===
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? Environment.GetEnvironmentVariable("JWT_KEY")
    ?? "SuperSecretKeyForLeadChatHub2024!Min32Chars";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "LeadChatHub",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "LeadChatHub",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };

        // Allow SignalR to use token from query string
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// === Services ===
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<LeadScoringService>();
builder.Services.AddScoped<WhatsAppService>();
builder.Services.AddScoped<AccountHierarchyService>();
builder.Services.AddScoped<FileStorageService>();
builder.Services.AddHttpClient();

// === Controllers & SignalR ===
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        opts.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        opts.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        // Allow JSON objects/arrays to be deserialized into string properties (e.g. Filtros, Variaveis)
        opts.JsonSerializerOptions.Converters.Add(new LeadChatHub.API.JsonObjectToStringConverter());
    });

builder.Services.AddSignalR();

// === CORS ===
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod();
        // Note: AllowCredentials() removed — we use JWT Bearer tokens, not cookies.
        // AllowCredentials() + wildcard origin is invalid per CORS spec.
    });
});

// === Swagger ===
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Lead Chat Hub API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Description = "JWT Token",
        Name = "Authorization",
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// === Middleware Pipeline ===
app.UseSwagger();
app.UseSwaggerUI();

// Manual CORS — garante headers em todas as respostas
app.Use(async (context, next) =>
{
    context.Response.Headers["Access-Control-Allow-Origin"] = "*";
    context.Response.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
    context.Response.Headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    if (context.Request.Method == "OPTIONS")
    {
        context.Response.StatusCode = 204;
        return;
    }
    await next();
});

app.UseCors();

// Serve uploaded files
app.UseStaticFiles();
var uploadsPath = builder.Configuration["Storage:LocalPath"] ?? "uploads";
if (Directory.Exists(uploadsPath))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
            Path.Combine(Directory.GetCurrentDirectory(), uploadsPath)),
        RequestPath = "/uploads"
    });
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat");

// Auto-migrate on startup (optional, can be disabled in production)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // Step 1: EnsureCreated in its own try/catch so a failure here doesn't skip migrations
    try { db.Database.EnsureCreated(); }
    catch (Exception ex) { Console.WriteLine($"EnsureCreated warning: {ex.Message}"); }

    // Step 2: ALTER TABLE migrations — always runs, even if EnsureCreated failed
    try
    {

        // Adicionar colunas novas que não existem no schema original (idempotente)
        var conn = db.Database.GetDbConnection();
        conn.Open();
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
                -- pipelines: coluna updated_at pode estar ausente em instâncias antigas
                ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();
                ALTER TABLE pipeline_etapas ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();
                ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

                -- leads
                ALTER TABLE leads ADD COLUMN IF NOT EXISTS telefone2 varchar(50) NULL;
                ALTER TABLE leads ADD COLUMN IF NOT EXISTS complemento varchar(100) NULL;
                ALTER TABLE leads ADD COLUMN IF NOT EXISTS cep varchar(20) NULL;
                ALTER TABLE leads ADD COLUMN IF NOT EXISTS rua varchar(200) NULL;
                ALTER TABLE leads ADD COLUMN IF NOT EXISTS numero varchar(20) NULL;
                ALTER TABLE leads ADD COLUMN IF NOT EXISTS bairro varchar(100) NULL;
                ALTER TABLE leads ADD COLUMN IF NOT EXISTS cidade varchar(100) NULL;
                ALTER TABLE leads ADD COLUMN IF NOT EXISTS estado varchar(50) NULL;
                ALTER TABLE leads ADD COLUMN IF NOT EXISTS genero varchar(20) NULL;

                -- empresas: campos adicionais
                ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tipo_vinculo_gerente varchar(50) NULL;
                ALTER TABLE empresas ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

                -- conversas: campos adicionais
                ALTER TABLE conversas ADD COLUMN IF NOT EXISTS prioridade varchar(20) NOT NULL DEFAULT 'normal';
                ALTER TABLE conversas ADD COLUMN IF NOT EXISTS responsavel_id uuid NULL;
                ALTER TABLE conversas ADD COLUMN IF NOT EXISTS erro_envio boolean NOT NULL DEFAULT false;

                -- perfil_comercial: campos adicionais
                ALTER TABLE perfil_comercial ADD COLUMN IF NOT EXISTS nome_unidade varchar(200) NULL;
                ALTER TABLE perfil_comercial ADD COLUMN IF NOT EXISTS nome_fantasia varchar(200) NULL;
                ALTER TABLE perfil_comercial ADD COLUMN IF NOT EXISTS razao_social varchar(300) NULL;
                ALTER TABLE perfil_comercial ADD COLUMN IF NOT EXISTS cnpj varchar(20) NULL;
                ALTER TABLE perfil_comercial ADD COLUMN IF NOT EXISTS whatsapp varchar(50) NULL;
                ALTER TABLE perfil_comercial ADD COLUMN IF NOT EXISTS endereco_logradouro varchar(200) NULL;
                ALTER TABLE perfil_comercial ADD COLUMN IF NOT EXISTS endereco_numero varchar(20) NULL;
                ALTER TABLE perfil_comercial ADD COLUMN IF NOT EXISTS endereco_complemento varchar(100) NULL;
                ALTER TABLE perfil_comercial ADD COLUMN IF NOT EXISTS endereco_bairro varchar(100) NULL;
                ALTER TABLE perfil_comercial ADD COLUMN IF NOT EXISTS endereco_cidade varchar(100) NULL;
                ALTER TABLE perfil_comercial ADD COLUMN IF NOT EXISTS endereco_uf varchar(10) NULL;
                ALTER TABLE perfil_comercial ADD COLUMN IF NOT EXISTS endereco_cep varchar(20) NULL;
                ALTER TABLE perfil_comercial ADD COLUMN IF NOT EXISTS termos_orcamento_padrao text NULL;
                ALTER TABLE perfil_comercial ADD COLUMN IF NOT EXISTS observacao_orcamento_padrao text NULL;
                ALTER TABLE perfil_comercial ADD COLUMN IF NOT EXISTS validade_orcamento_padrao_dias int NOT NULL DEFAULT 30;
                ALTER TABLE perfil_comercial ADD COLUMN IF NOT EXISTS formas_pagamento_padrao jsonb NULL;
                ALTER TABLE perfil_comercial ADD COLUMN IF NOT EXISTS parcelamento_padrao varchar(200) NULL;
                ALTER TABLE perfil_comercial ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

                -- campanhas: garantir colunas presentes
                ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS criada_por_conta_id uuid NULL;
                ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS conta_gerente_id uuid NULL;
                ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS escopo varchar(50) NOT NULL DEFAULT 'conta';
                ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS assunto varchar(300) NULL;
                ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS variaveis text NOT NULL DEFAULT '[]';
                ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS filtros text NOT NULL DEFAULT '{}';
                ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS agendada_para timestamptz NULL;
                ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS iniciada_em timestamptz NULL;
                ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS finalizada_em timestamptz NULL;
                ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS total_destinatarios int NOT NULL DEFAULT 0;
                ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS total_enviados int NOT NULL DEFAULT 0;
                ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS total_falhas int NOT NULL DEFAULT 0;
                ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS total_optout int NOT NULL DEFAULT 0;

                -- lead_identidades: garantir coluna identificador unique
                ALTER TABLE lead_identidades ADD COLUMN IF NOT EXISTS empresa_id uuid NULL;
                ALTER TABLE lead_identidades ADD COLUMN IF NOT EXISTS canal varchar(50) NULL;

                -- oportunidades: garantir colunas
                ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS pipeline_id uuid NULL;
                ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS etapa_id uuid NULL;
                ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS responsavel_id uuid NULL;
                ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS motivo_perda text NULL;
                ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS perdida_em timestamptz NULL;

                -- orcamentos: renomear tabela itens_orcamento → orcamento_itens se necessário
                DO $$ BEGIN
                    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'itens_orcamento') AND
                       NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'orcamento_itens') THEN
                        ALTER TABLE itens_orcamento RENAME TO orcamento_itens;
                    END IF;
                END $$;

                -- orcamentos: adicionar colunas faltantes
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS oportunidade_id uuid NULL;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS operador_id uuid NULL;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS operador_nome varchar(200) NULL;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS vendedor_id uuid NULL;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS titulo varchar(300) NULL;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS moeda varchar(10) NOT NULL DEFAULT 'BRL';
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS subtotal numeric(12,2) NOT NULL DEFAULT 0;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS desconto_total numeric(12,2) NOT NULL DEFAULT 0;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS taxas_total numeric(12,2) NOT NULL DEFAULT 0;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS validade_em timestamptz NULL;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS condicoes_pagamento text NULL;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS termos text NULL;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS observacoes_cliente text NULL;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS observacoes_internas text NULL;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS mensagem_chat text NULL;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS pdf_url text NULL;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS pdf_gerado_em timestamptz NULL;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS enviado_em timestamptz NULL;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS convertido_venda_id uuid NULL;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS created_by uuid NULL;
                ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS updated_by uuid NULL;

                -- orcamento_itens: adicionar colunas faltantes (cria tabela se não existir)
                CREATE TABLE IF NOT EXISTS orcamento_itens (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    orcamento_id uuid NOT NULL,
                    empresa_id uuid NOT NULL,
                    produto_id uuid NULL,
                    categoria varchar(100) NULL,
                    descricao text NOT NULL DEFAULT '',
                    servico varchar(200) NULL,
                    quantidade numeric(10,3) NOT NULL DEFAULT 1,
                    unidade varchar(20) NOT NULL DEFAULT 'un',
                    medida varchar(100) NULL,
                    material varchar(200) NULL,
                    nivel_sujeira varchar(50) NULL,
                    valor_unitario numeric(12,2) NOT NULL DEFAULT 0,
                    desconto numeric(12,2) NOT NULL DEFAULT 0,
                    valor_total numeric(12,2) NOT NULL DEFAULT 0,
                    observacao_tecnica text NULL,
                    ordem int NOT NULL DEFAULT 0,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NOT NULL DEFAULT NOW()
                );
                ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS empresa_id uuid NULL;
                ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS produto_id uuid NULL;
                ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS categoria varchar(100) NULL;
                ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS servico varchar(200) NULL;
                ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS unidade varchar(20) NULL;
                ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS medida varchar(100) NULL;
                ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS material varchar(200) NULL;
                ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS nivel_sujeira varchar(50) NULL;
                ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS desconto numeric(12,2) NULL;
                ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS observacao_tecnica text NULL;
                ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS ordem int NULL;
                ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS updated_at timestamptz NULL;

                -- orcamentos: garantir numero como int
                ALTER TABLE orcamentos ALTER COLUMN numero TYPE integer USING COALESCE(numero::integer, 0);
                ALTER TABLE orcamentos ALTER COLUMN numero SET DEFAULT 0;

                -- RF-158: vínculos entre contas (pedidos + aprovações)
                CREATE TABLE IF NOT EXISTS solicitacoes_vinculo_conta (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    conta_solicitante_id uuid NOT NULL,
                    conta_alvo_id uuid NOT NULL,
                    tipo_solicitacao varchar(50) NOT NULL DEFAULT 'vinculo',
                    tipo_vinculo_solicitado varchar(50) NULL,
                    status varchar(30) NOT NULL DEFAULT 'pendente',
                    mensagem text NULL,
                    respondido_por uuid NULL,
                    respondido_em timestamptz NULL,
                    created_by uuid NULL,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS contas_vinculos (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    conta_gerente_id uuid NOT NULL,
                    conta_alvo_id uuid NOT NULL,
                    tipo_vinculo varchar(50) NOT NULL DEFAULT 'gerenciamento',
                    status varchar(30) NOT NULL DEFAULT 'ativo',
                    principal boolean NOT NULL DEFAULT false,
                    origem varchar(50) NOT NULL DEFAULT 'manual',
                    solicitacao_id uuid NULL,
                    created_by uuid NULL,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NOT NULL DEFAULT NOW()
                );

                -- conversa_notas
                CREATE TABLE IF NOT EXISTS conversa_notas (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    empresa_id uuid NOT NULL,
                    conversa_id uuid NOT NULL,
                    usuario_id uuid NULL,
                    conteudo text NOT NULL DEFAULT '',
                    privada boolean NOT NULL DEFAULT true,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NOT NULL DEFAULT NOW()
                );

                -- conversao_destinos
                CREATE TABLE IF NOT EXISTS conversao_destinos (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    empresa_id uuid NOT NULL,
                    conversao_id uuid NOT NULL,
                    plataforma varchar(50) NOT NULL DEFAULT '',
                    metodo_envio varchar(50) NOT NULL DEFAULT 'csv',
                    tipo_evento_plataforma varchar(100) NULL,
                    status_envio varchar(50) NOT NULL DEFAULT 'pendente',
                    identificadores jsonb NULL,
                    payload_preview jsonb NULL,
                    erro text NULL,
                    exportacao_id uuid NULL,
                    enviado_em timestamptz NULL,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NOT NULL DEFAULT NOW()
                );

                -- exportacoes_conversoes
                CREATE TABLE IF NOT EXISTS exportacoes_conversoes (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    empresa_id uuid NOT NULL,
                    plataforma varchar(50) NOT NULL DEFAULT '',
                    metodo_envio varchar(50) NOT NULL DEFAULT 'csv',
                    status varchar(30) NOT NULL DEFAULT 'pendente',
                    arquivo_url text NULL,
                    google_sheet_url text NULL,
                    total_registros int NOT NULL DEFAULT 0,
                    total_sucesso int NOT NULL DEFAULT 0,
                    total_erro int NOT NULL DEFAULT 0,
                    filtros jsonb NULL,
                    created_by uuid NULL,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NOT NULL DEFAULT NOW()
                );

                -- configuracoes_conversao
                CREATE TABLE IF NOT EXISTS configuracoes_conversao (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    empresa_id uuid NOT NULL,
                    plataforma varchar(50) NOT NULL DEFAULT '',
                    metodo_padrao varchar(50) NOT NULL DEFAULT 'csv',
                    google_customer_id varchar(100) NULL,
                    google_conversion_action_id varchar(100) NULL,
                    meta_pixel_id varchar(100) NULL,
                    meta_dataset_id varchar(100) NULL,
                    meta_access_token text NULL,
                    tiktok_advertiser_id varchar(100) NULL,
                    tiktok_event_source_id varchar(100) NULL,
                    token_status varchar(30) NOT NULL DEFAULT 'nao_configurado',
                    ativo boolean NOT NULL DEFAULT true,
                    tipo varchar(50) NOT NULL DEFAULT 'pixel',
                    nome varchar(150) NULL,
                    configuracao text NULL,
                    configuracoes jsonb NULL,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NOT NULL DEFAULT NOW()
                );

                -- agendamentos
                CREATE TABLE IF NOT EXISTS agendamentos (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    empresa_id uuid NOT NULL,
                    lead_id uuid NOT NULL,
                    conversa_id uuid NULL,
                    usuario_id uuid NULL,
                    titulo varchar(200) NOT NULL DEFAULT '',
                    descricao text NULL,
                    tipo varchar(50) NOT NULL DEFAULT 'reuniao',
                    status varchar(30) NOT NULL DEFAULT 'agendado',
                    data_inicio timestamptz NOT NULL DEFAULT NOW(),
                    data_fim timestamptz NULL,
                    dia_todo boolean NOT NULL DEFAULT false,
                    local varchar(300) NULL,
                    link_reuniao varchar(500) NULL,
                    lembrete_minutos int NULL,
                    notas text NULL,
                    created_by uuid NULL,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NOT NULL DEFAULT NOW()
                );

                -- chatbot_fluxos
                CREATE TABLE IF NOT EXISTS chatbot_fluxos (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    empresa_id uuid NOT NULL,
                    canal_id uuid NULL,
                    nome varchar(150) NOT NULL DEFAULT '',
                    tipo varchar(50) NOT NULL DEFAULT 'saudacao',
                    configuracao text NULL,
                    horario_inicio varchar(10) NULL,
                    horario_fim varchar(10) NULL,
                    dias_semana varchar(30) NULL,
                    ativo boolean NOT NULL DEFAULT true,
                    ordem int NOT NULL DEFAULT 0,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NOT NULL DEFAULT NOW()
                );

                -- mensagens_programadas
                CREATE TABLE IF NOT EXISTS mensagens_programadas (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    empresa_id uuid NOT NULL,
                    conversa_id uuid NOT NULL,
                    conteudo text NOT NULL,
                    agendado_para timestamptz NOT NULL,
                    status varchar(30) NOT NULL DEFAULT 'pendente',
                    enviado_em timestamptz NULL,
                    erro text NULL,
                    created_at timestamptz NOT NULL DEFAULT NOW()
                );

                -- afiliados
                CREATE TABLE IF NOT EXISTS afiliados (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    empresa_id uuid NOT NULL,
                    usuario_id uuid NULL,
                    nome varchar(200) NOT NULL DEFAULT '',
                    email varchar(200) NULL,
                    telefone varchar(50) NULL,
                    codigo_afiliado varchar(50) NOT NULL DEFAULT '',
                    percentual_comissao numeric(5,2) NOT NULL DEFAULT 10,
                    total_indicacoes int NOT NULL DEFAULT 0,
                    total_convertidas int NOT NULL DEFAULT 0,
                    total_comissao numeric(12,2) NOT NULL DEFAULT 0,
                    status varchar(30) NOT NULL DEFAULT 'ativo',
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NOT NULL DEFAULT NOW()
                );

                -- indicacoes
                CREATE TABLE IF NOT EXISTS indicacoes (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    empresa_id uuid NOT NULL,
                    afiliado_id uuid NOT NULL,
                    lead_id uuid NULL,
                    nome_indicado varchar(200) NOT NULL DEFAULT '',
                    email_indicado varchar(200) NULL,
                    telefone_indicado varchar(50) NULL,
                    status varchar(30) NOT NULL DEFAULT 'pendente',
                    valor_venda numeric(12,2) NULL,
                    valor_comissao numeric(12,2) NULL,
                    comissao_paga boolean NOT NULL DEFAULT false,
                    paga_em timestamptz NULL,
                    observacoes text NULL,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NOT NULL DEFAULT NOW()
                );

                -- integracoes_externas
                CREATE TABLE IF NOT EXISTS integracoes_externas (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    empresa_id uuid NOT NULL,
                    plataforma varchar(50) NOT NULL DEFAULT '',
                    nome varchar(150) NOT NULL DEFAULT '',
                    webhook_url text NULL,
                    api_key text NULL,
                    configuracao text NULL,
                    status varchar(30) NOT NULL DEFAULT 'inativo',
                    ultimo_disparo timestamptz NULL,
                    total_disparos int NOT NULL DEFAULT 0,
                    ativo boolean NOT NULL DEFAULT false,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NOT NULL DEFAULT NOW()
                );

                -- base_conhecimento
                CREATE TABLE IF NOT EXISTS base_conhecimento (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    empresa_id uuid NOT NULL,
                    autor_id uuid NULL,
                    titulo varchar(300) NOT NULL DEFAULT '',
                    conteudo text NULL,
                    categoria varchar(100) NOT NULL DEFAULT 'geral',
                    tags text NULL,
                    publico boolean NOT NULL DEFAULT false,
                    ativo boolean NOT NULL DEFAULT true,
                    visualizacoes int NOT NULL DEFAULT 0,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NOT NULL DEFAULT NOW()
                );
            ";
            cmd.ExecuteNonQuery();
        }
        conn.Close();
        Console.WriteLine("DB migrations OK");
    }
    catch (Exception ex) { Console.WriteLine($"DB migration warning: {ex.Message}"); }

    // Step 3: Seed data — runs independently of migrations
    try
    {
        // Garantir que todo usuário com Role=super_admin tenha vínculo em pelo menos uma empresa ativa
        var superAdmins = db.Usuarios.Where(u => u.Role == "super_admin" && u.Ativo).ToList();
        var primeiraEmpresa = db.Empresas.OrderBy(e => e.CreatedAt).FirstOrDefault();
        if (primeiraEmpresa != null)
        {
            foreach (var sa in superAdmins)
            {
                if (!db.UsuariosContas.Any(uc => uc.UsuarioId == sa.Id))
                {
                    db.UsuariosContas.Add(new LeadChatHub.Core.Entities.UsuarioConta
                    {
                        UsuarioId = sa.Id,
                        ContaId = primeiraEmpresa.Id,
                        Role = "super_admin",
                        Ativo = true
                    });
                    Console.WriteLine($"Seed: vínculo super_admin {sa.Email} -> {primeiraEmpresa.Nome} criado");
                }
            }
            db.SaveChanges();
        }

        if (!db.Empresas.Any())
        {
            var empresa = new LeadChatHub.Core.Entities.Empresa
            {
                Nome = "Empresa Principal",
                TipoConta = "gerente"
            };
            db.Empresas.Add(empresa);
            db.SaveChanges();

            var admin = new LeadChatHub.Core.Entities.Usuario
            {
                EmpresaId = empresa.Id,
                Nome = "Admin",
                Email = "admin@admin.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                Role = "super_admin"
            };
            db.Usuarios.Add(admin);

            db.UsuariosContas.Add(new LeadChatHub.Core.Entities.UsuarioConta
            {
                UsuarioId = admin.Id,
                ContaId = empresa.Id,
                Role = "super_admin"
            });

            db.SaveChanges();
            Console.WriteLine("Seed: usuário admin criado — admin@admin.com / admin123");
        }
    }
    catch (Exception ex) { Console.WriteLine($"DB seed warning: {ex.Message}"); }
}

var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
app.Urls.Add($"http://0.0.0.0:{port}");

app.Run();
