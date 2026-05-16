# Lead Chat Hub - Frontend

React + TypeScript + Vite + Tailwind CSS + shadcn/ui

## Migração de Supabase para REST API

O SDK do Supabase foi substituído por uma camada de compatibilidade em
`src/integrations/supabase/client.ts` que:

- Mantém a mesma API (`supabase.from("table").select().eq()`)
- Redireciona todas chamadas para a REST API ASP.NET Core
- Implementa auth via JWT (login, refresh, logout)
- Substitui `supabase.functions.invoke()` por chamadas diretas à API
- Substitui Supabase Realtime por SignalR (`src/hooks/use-signalr.ts`)

## Configuração

```bash
# Copiar variáveis de ambiente
cp .env.example .env

# Editar .env com a URL da API
VITE_API_URL=http://localhost:5000/api
```

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Rodar em dev
npm run dev
```

## Build

```bash
npm run build
```

Os arquivos de build ficam em `dist/`.

## Deploy

### Railway (recomendado)

1. Criar novo serviço no Railway
2. Configurar:
   - Build Command: `npm run build`
   - Start Command: `npx serve dist -s -l $PORT`
   - Variável `VITE_API_URL` apontando para o backend

### Outros

Qualquer hosting de arquivos estáticos (Vercel, Netlify, etc.)
pode servir a pasta `dist/`. Basta configurar `VITE_API_URL`.

## Estrutura Principal

```
src/
├── components/       → Componentes React
│   ├── crm/         → CRM (chat, leads, conversas)
│   └── ui/          → shadcn/ui components
├── contexts/        → AuthContext, ActiveAccountContext
├── hooks/           → use-signalr, use-mobile, use-toast
├── integrations/
│   └── supabase/
│       ├── client.ts → API client (compatibilidade Supabase)
│       └── types.ts  → Tipos TypeScript
├── layouts/         → AdminLayout
├── lib/             → Business logic helpers
├── pages/           → Páginas da aplicação
└── App.tsx          → Rotas
```
