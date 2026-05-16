# Lead Chat Hub - Backend API

ASP.NET Core 8 Web API com Entity Framework Core e PostgreSQL.

## Estrutura

```
LeadChatHub.Core/          → Entidades, DTOs, Interfaces, Enums
LeadChatHub.Infrastructure/→ EF Core DbContext, Repositories
LeadChatHub.Application/   → Services (Auth, WhatsApp, Scoring, Hierarchy, Storage)
LeadChatHub.API/           → Controllers, SignalR Hub, Program.cs
```

## Funcionalidades

- ✅ CRUD completo para todas as 33 tabelas
- ✅ Autenticação JWT (login, register, refresh token)
- ✅ Autorização baseada em contas/hierarquia MCC
- ✅ SignalR Hub para mensagens em tempo real
- ✅ Integração WhatsApp (webhook + envio)
- ✅ Score automático de leads
- ✅ Upload de arquivos
- ✅ Swagger UI

## Configuração

### Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Connection string PostgreSQL |
| `JWT_KEY` | Chave secreta JWT (min 32 chars) |
| `PORT` | Porta do servidor (default: 5000) |

### Desenvolvimento Local

```bash
# Restaurar pacotes
dotnet restore

# Rodar
dotnet run --project LeadChatHub.API
```

API disponível em `http://localhost:5000`
Swagger em `http://localhost:5000/swagger`

### Deploy no Railway

1. Criar novo projeto no Railway
2. Adicionar PostgreSQL como addon
3. Configurar variáveis:
   - `DATABASE_URL` (automático do addon)
   - `JWT_KEY` (gerar chave segura)
4. Deploy via GitHub ou CLI

## Endpoints Principais

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Registro |
| POST | `/api/auth/refresh` | Refresh token |
| GET | `/api/auth/me` | Usuário atual |
| GET/POST/PUT/DELETE | `/api/{entidade}` | CRUD genérico |
| GET | `/api/whatsapp/webhook` | Verificação webhook |
| POST | `/api/whatsapp/webhook` | Receber eventos |
| POST | `/api/whatsapp/send` | Enviar mensagem |
| POST | `/api/upload` | Upload arquivo |
| WS | `/hubs/chat` | SignalR realtime |
