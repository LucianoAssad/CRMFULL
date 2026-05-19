using System.Text;
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
    try
    {
        db.Database.EnsureCreated();

        // Adicionar colunas novas que não existem no schema original (idempotente)
        var conn = db.Database.GetDbConnection();
        conn.Open();
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
                ALTER TABLE leads ADD COLUMN IF NOT EXISTS telefone2 varchar(50) NULL;
                ALTER TABLE leads ADD COLUMN IF NOT EXISTS complemento varchar(100) NULL;
                ALTER TABLE leads ADD COLUMN IF NOT EXISTS cep varchar(20) NULL;
                ALTER TABLE leads ADD COLUMN IF NOT EXISTS rua varchar(200) NULL;
                ALTER TABLE leads ADD COLUMN IF NOT EXISTS numero varchar(20) NULL;
                ALTER TABLE leads ADD COLUMN IF NOT EXISTS bairro varchar(100) NULL;
                ALTER TABLE leads ADD COLUMN IF NOT EXISTS cidade varchar(100) NULL;
                ALTER TABLE leads ADD COLUMN IF NOT EXISTS estado varchar(50) NULL;
            ";
            cmd.ExecuteNonQuery();
        }
        conn.Close();

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
    catch (Exception ex) { Console.WriteLine($"DB init warning: {ex.Message}"); }
}

var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
app.Urls.Add($"http://0.0.0.0:{port}");

app.Run();
