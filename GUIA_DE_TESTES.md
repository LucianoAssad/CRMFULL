# Krescer SMKT — Guia de Testes
**URL:** https://diplomatic-reprieve-production-d59c.up.railway.app  
**Data:** Maio 2026

---

## 🔐 Acesso
| Campo | Valor |
|-------|-------|
| URL | https://diplomatic-reprieve-production-d59c.up.railway.app/login |
| E-mail | admin@admin.com |
| Perfil | Super Admin |

---

## P0 — Correções e base

### ✅ Dashboard com métricas
**Caminho:** Menu lateral → Dashboard  
**O que testar:**
1. Verificar cards: Total de leads, Conversas abertas, Oportunidades, Vendas, Valor ganho (verde), Valor perdido (vermelho)
2. Gráfico "Novos contatos por dia" — últimos 30 dias
3. Tabela "Performance de Campanhas"
4. Trocar as abas UTM: **Campanha / Source / Medium / Conjunto / Anúncio** — tabela muda
5. Filtrar por empresa e por período (De / Até)

---

### ✅ Pipeline — Editar coluna inline
**Caminho:** Menu lateral → Pipeline  
**O que testar:**
1. Clicar no **nome de uma coluna** (ex: "Novo") — campo de edição aparece
2. Digitar novo nome e pressionar Enter — salva
3. Pressionar Escape — cancela

---

### ✅ Atendimento — Filtros
**Caminho:** Menu lateral → Atendimento  
**O que testar:**
1. Filtrar por canal, status, responsável, prioridade
2. Buscar por nome ou telefone do lead
3. Filtrar por período

---

## P1 — Features de atendimento

### ✅ Mensagens rápidas via "/"
**Caminho:** Atendimento → selecionar conversa → campo de mensagem  
**O que testar:**
1. Clicar no campo de mensagem
2. Digitar `/` — lista de respostas rápidas aparece acima do input
3. Continuar digitando para filtrar (ex: `/ola`)
4. Usar ↑ ↓ para navegar
5. Pressionar Enter para selecionar
6. Clicar numa opção com o mouse

---

### ✅ Variáveis do contato via "\"
**Caminho:** Atendimento → selecionar conversa → campo de mensagem  
**O que testar:**
1. Digitar `\` no campo — popup de variáveis aparece
2. Opções: Nome, Primeiro nome, Telefone, Email, CPF, Cidade, Estado
3. Clicar numa variável — substitui `\` pelo valor real do contato
4. Pressionar Escape — fecha sem substituir

---

### ✅ Gravar áudio (PTT)
**Caminho:** Atendimento → selecionar conversa → ícone 🎙️  
**Pré-requisito:** campo de mensagem deve estar vazio  
**O que testar:**
1. Clicar no ícone de microfone — solicita permissão do browser
2. Permitir microfone — cronômetro aparece (00:00)
3. Falar algo
4. Clicar em Send (ícone verde) — envia o áudio
5. Clicar no quadrado (■) — cancela sem enviar

---

### ✅ Catálogo de produtos no chat
**Caminho:** Atendimento → selecionar conversa → ícone 📦  
**O que testar:**
1. Clicar no ícone de caixinha
2. Dialog com lista de produtos aparece
3. Buscar produto pelo nome
4. Clicar num produto — texto formatado é inserido no campo de mensagem
5. Editar o texto se necessário e enviar

---

### ✅ Agendar mensagem
**Caminho:** Atendimento → selecionar conversa → ícone ⋮ (três pontos) → "Agendar mensagem"  
**O que testar:**
1. Clicar nos três pontos no header da conversa
2. Clicar em "Agendar mensagem"
3. Preencher: texto da mensagem, data e hora
4. Clicar em "Agendar" — mensagem salva na tabela `mensagens_programadas`

---

### ✅ Respostas rápidas — Cadastro
**Caminho:** (Backend) — gerenciado via tabela `respostas_rapidas`  
**O que testar:**
1. No atendimento, digitar `/` — se não aparecer nada, a tabela está vazia
2. As respostas rápidas estáticas (fallback) sempre aparecem

---

### ✅ Saudação automática
**Caminho:** Menu lateral → Configurações → seção "Saudação automática"  
**O que testar:**
1. Ativar o toggle
2. Adicionar até 5 mensagens com delay configurável
3. Usar variáveis: `{{nome}}`, `{{telefone}}`
4. Clicar em Salvar

---

### ✅ Qualidade do número WhatsApp
**Caminho:** Menu lateral → Conexões → coluna Status  
**O que testar:**
1. Canais WhatsApp exibem badge de qualidade: 🟢 Alta / 🟡 Média / 🔴 Baixa
2. Qualidade vem do campo `configuracoes._quality` do canal

---

### ✅ Gênero do lead
**Caminho:** Atendimento → selecionar conversa → painel direito → "Cadastro completo"  
**O que testar:**
1. Expandir seção "Cadastro completo"
2. Campo "Gênero": Não definido / Masculino / Feminino / Outro
3. Salvar — persiste no banco

---

### ✅ CEP autocomplete
**Caminho:** Atendimento → conversa → painel direito → "Cadastro completo"  
**O que testar:**
1. Digitar um CEP válido (ex: `22041001`) no campo CEP
2. Campos Rua, Bairro, Cidade e Estado preenchem automaticamente via ViaCEP

---

### ✅ Token CAPI Meta
**Caminho:** Menu lateral → Conversões → aba Configurações → Meta Ads  
**O que testar:**
1. Expandir configuração Meta Ads
2. Campo "Token de acesso CAPI" com toggle mostrar/ocultar
3. Salvar token

---

### ✅ Vínculo pixel por canal
**Caminho:** Menu lateral → Conversões → aba Configurações → Meta Ads  
**O que testar:**
1. Select "Vincular ao número/instância WhatsApp"
2. Selecionar canal — salva qual canal dispara eventos para aquele pixel

---

## P2 — Novas funcionalidades

### ✅ Agendamentos — Calendário
**Caminho:** Menu lateral → Agendamentos  
**O que testar:**
1. Visualização em calendário mensal — navegar meses com ← →
2. Clicar em um dia — painel direito mostra agendamentos do dia
3. Duplo clique em um dia — abre modal de novo agendamento naquela data
4. Clicar "Novo agendamento" — preencher formulário completo
5. Tipos: Reunião 🤝, Ligação 📞, Visita 🏠, Tarefa ✅, Follow-up 🔔
6. Marcar como Concluído ou Cancelar direto no card
7. Trocar para aba "Lista" — mostra todos cronologicamente

---

### ✅ Agendamento rápido no chat
**Caminho:** Atendimento → conversa → ícone ⋮ → "Criar agendamento"  
**O que testar:**
1. Preencher título, tipo e data/hora
2. Clicar Criar — agendamento vinculado ao lead da conversa

---

### ✅ Agendamentos no painel do lead
**Caminho:** Atendimento → conversa → painel direito → seção "Agendamentos"  
**O que testar:**
1. Ver agendamentos existentes do lead
2. Marcar como concluído/cancelar
3. Criar novo agendamento inline

---

### ✅ Chatbot & Fluxos
**Caminho:** Menu lateral → Chatbot & Fluxos  
**O que testar:**
1. Aba **Saudação automática** → Novo fluxo → configurar mensagens + delay + horário + dias
2. Aba **Menu interativo** → Novo fluxo → cabeçalho + opções numeradas
3. Aba **Respostas por palavra-chave** → Novo fluxo → palavra + resposta + modo exato
4. Aba **Assistente IA** → Novo fluxo → prompt do sistema + modelo GPT + token OpenAI
5. Aba **Fora do horário** → mensagem fora do expediente
6. Cada fluxo: toggle Ativo/Inativo, vincular a canal específico, dias da semana, horário

---

### ✅ Grupos WhatsApp
**Caminho:** Menu lateral → Grupos WhatsApp  
**O que testar:**
1. Página exibe aviso se não houver canal Evolution API / WPPConnect
2. Clicar "Registrar grupo" → preencher nome, canal, JID, descrição
3. Editar / Remover grupos cadastrados

---

## P3 — Integrações e crescimento

### ✅ Afiliados
**Caminho:** Menu lateral → Afiliados  
**O que testar:**
1. Clicar "Novo afiliado" → nome, e-mail, telefone, código (auto-gerado), comissão %
2. Copiar link de indicação (ícone de cópia ao lado do código)
3. Clicar "Nova indicação" → vincular ao afiliado, preencher dados do indicado
4. Na aba Indicações: mudar status (pendente → contatado → convertido → perdido)
5. Em convertido: botão "Marcar pago" para quitar comissão
6. KPIs no topo: total afiliados, indicações, convertidas, comissão total, pendente pagar

---

### ✅ Integrações externas
**Caminho:** Menu lateral → Integrações  
**O que testar:**
1. Ver catálogo: Zapier, Make, RD Station, HubSpot, ActiveCampaign, Pipedrive, n8n, Google Sheets
2. Clicar em **Zapier** → webhook URL gerado automaticamente → copiar
3. Clicar em **RD Station** → campo API Key (com toggle mostrar/ocultar)
4. Ver lista de eventos que serão disparados
5. Ativar integração → aparece em "Configuradas" com toggle on/off

---

### ✅ Base de Conhecimento
**Caminho:** Menu lateral → Base de Conhecimento  
**O que testar:**
1. Clicar "Novo artigo" → título, categoria, tags, conteúdo (Markdown)
2. Toggle "Visível para clientes" (público)
3. Buscar artigo pelo nome ou conteúdo
4. Filtrar por categoria (botões de filtro)
5. Clicar em um artigo → abre modal de leitura
6. Editar / Excluir artigo
7. Contador de visualizações

---

### ✅ Comunidade
**Caminho:** Menu lateral → Comunidade  
**O que testar:**
1. Página de novidades e roadmap
2. Links de suporte
3. Últimas atualizações da plataforma

---

## 🐛 Como reportar bugs

Ao encontrar um erro:
1. **Print da tela** com o erro visível
2. **Caminho percorrido** para reproduzir
3. **Console do browser** (F12 → Console) — copiar a mensagem de erro em vermelho
4. Enviar para o time de desenvolvimento

---

## 📊 Status geral das features

| Bloco | Features | Status |
|-------|----------|--------|
| P0 | Dashboard, Pipeline, Atendimento | ✅ Produção |
| P1 | Chat, CEP, Gênero, CAPI, Pixel | ✅ Produção |
| P2 | Agendamentos, Chatbot, Catálogo, Grupos | ✅ Produção |
| P3 | Afiliados, Integrações, Base de Conhecimento, Comunidade | ✅ Produção |

**Total: 40+ features implementadas** 🚀
