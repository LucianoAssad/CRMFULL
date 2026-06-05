# 🧪 Krescer SMKT — Guia de Testes End-to-End (V2)

**URL:** https://diplomatic-reprieve-production-d59c.up.railway.app  
**Login padrão:** admin@admin.com / admin123  
**Data:** Junho 2026

---

## Como usar este guia

- ✅ Marque o item quando passar
- ❌ Marque quando falhar — anote o erro
- ⚠️ Marque quando passar parcialmente — anote o comportamento

---

## 🏗️ BLOCO 1 — Cadastro e Configuração Inicial

### 1.1 Login / Acesso

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 1.1.1 | Acessar `/login` → entrar com admin@admin.com / admin123 | Redireciona para Dashboard | ✅ |
| 1.1.2 | Tentar login com senha errada | Mensagem de erro "Credenciais inválidas" | ✅ |
| 1.1.3 | Logout → botão usuário → Sair | Volta para /login, tokens removidos | ✅ |
| 1.1.4 | Tema escuro/claro → botão 🌙/☀️ no rodapé do sidebar | Tema troca e persiste ao recarregar | ✅ |

---

### 1.2 Perfil Comercial

**Caminho:** Configurações → Perfil Comercial

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 1.2.1 | Preencher nome da empresa, CNPJ, telefone, e-mail, site | Campos salvos | ✅ |
| 1.2.2 | Upload de logo (JPG/PNG) | Logo exibida no perfil | ✅ |
| 1.2.3 | Preencher CEP válido no endereço | Rua, Bairro, Cidade, Estado preenchidos automaticamente | ✅ |
| 1.2.4 | Salvar perfil → recarregar página | Dados persistem | ✅ |
| 1.2.5 | Preencher termos e observações padrão de orçamento | Salvos e usados em novos orçamentos | ✅ |

---

### 1.3 Usuários e Permissões

**Caminho:** Acesso e Segurança → Usuários

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 1.3.1 | Criar usuário com role "atendente" | Aparece na lista | |
| 1.3.2 | Criar usuário com role "admin_filha" | Aparece na lista | |
| 1.3.3 | Editar nome/telefone de usuário | Alteração salva | |
| 1.3.4 | Desativar usuário → tentar login | Login bloqueado | |
| 1.3.5 | Reativar usuário → tentar login | Login funciona | |

---

### 1.4 Conexões / Canais

**Caminho:** Conexões → Novo canal

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 1.4.1 | Criar canal WhatsApp (nome + identificador +55...) | Aparece na lista de canais | |
| 1.4.2 | Criar canal Webchat | Aparece na lista | |
| 1.4.3 | Criar canal Instagram | Aparece na lista | |
| 1.4.4 | Badge de qualidade exibido (🟢/🟡/🔴) | Badge visível na coluna Status | |
| 1.4.5 | Desativar canal | Não aparece nos filtros do Atendimento | |

---

## 👥 BLOCO 2 — Leads e Clientes

### 2.1 CRUD de Lead

**Caminho:** Leads/Clientes

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 2.1.1 | Criar lead PF (nome, telefone, e-mail, origem) | Lead aparece na lista | |
| 2.1.2 | Criar lead PJ (CNPJ, razão social, nome fantasia) | Campos PJ salvos | |
| 2.1.3 | Preencher CEP no lead → autocomplete | Endereço preenchido automaticamente via ViaCEP | |
| 2.1.4 | Definir gênero (Masculino / Feminino / Outro) | Salvo no lead | |
| 2.1.5 | Alterar status: Novo → Qualificado → Convertido | Status atualiza na lista | |
| 2.1.6 | Pesquisar lead por nome | Resultado filtrado | |
| 2.1.7 | Filtrar por status, origem, score | Lista filtrada corretamente | |
| 2.1.8 | Excluir lead | Removido da lista | |

### 2.2 Tags e Notas

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 2.2.1 | Adicionar tags ao lead | Tags salvas e exibidas | |
| 2.2.2 | Adicionar nota ao lead | Nota salva | |

### 2.3 Rastreamento UTM

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 2.3.1 | Acessar URL com `?utm_source=google&utm_campaign=teste&utm_medium=cpc` | Lead criado herda UTMs | |
| 2.3.2 | Lead com gclid/fbclid capturado | IDs salvos no lead | |

---

## 💬 BLOCO 3 — Atendimento (Chat)

### 3.1 Conversas

**Caminho:** Atendimento

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 3.1.1 | Selecionar conversa | Mensagens carregam, painel do lead abre | |
| 3.1.2 | Enviar mensagem de texto | Aparece como outbound no chat | |
| 3.1.3 | `ultima_mensagem` da conversa atualiza na lista | Preview na lista atualiza | |
| 3.1.4 | Filtrar por canal (ex: WhatsApp) | Apenas conversas do canal aparecem | |
| 3.1.5 | Filtrar por status (Aberta / Aguardando / Resolvida) | Filtro funciona | |
| 3.1.6 | Filtrar por responsável | Filtro funciona | |
| 3.1.7 | Filtrar por prioridade | Filtro funciona | |
| 3.1.8 | Buscar por nome ou telefone | Resultado correto | |
| 3.1.9 | Filtrar por período (De / Até) | Filtro funciona | |

### 3.2 Recursos Avançados do Chat

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 3.2.1 | Digitar `/` → lista de respostas rápidas aparece | Lista exibida acima do input | |
| 3.2.2 | Continuar digitando após `/` → filtra | Opções filtradas em tempo real | |
| 3.2.3 | Selecionar resposta com Enter ou clique | Texto inserido no campo | |
| 3.2.4 | Digitar `\` → popup de variáveis | Opções: Nome, Primeiro nome, Telefone, Email | |
| 3.2.5 | Clicar variável → substitui pelo valor real | Valor do lead inserido | |
| 3.2.6 | Ícone 🎙️ → gravar áudio PTT | Cronômetro aparece | |
| 3.2.7 | Enviar áudio | Player de áudio exibido no chat | |
| 3.2.8 | Cancelar gravação (■) | Sem envio | |
| 3.2.9 | Ícone 📦 → catálogo de produtos | Lista de produtos aparece | |
| 3.2.10 | Buscar produto no catálogo | Filtro funciona | |
| 3.2.11 | Clicar produto → texto formatado com preço no campo | Texto inserido | |
| 3.2.12 | Enviar mensagem com produto | Mensagem enviada | |

### 3.3 Menu ⋮ (Três Pontos)

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 3.3.1 | **Ir para Lead** | Abre página do lead | |
| 3.3.2 | **Ir para Atendimento** | Vai para seção de atendimento | |
| 3.3.3 | **Ir para Orçamentos** | Scroll para seção orçamentos | |
| 3.3.4 | **Ir para Agendamentos** | Scroll para seção agendamentos | |
| 3.3.5 | **Agendar mensagem** → preencher → Agendar | Mensagem agendada, chega no horário (±60s) | |
| 3.3.6 | **Catálogo de produtos** | Abre dialog de produtos | |
| 3.3.7 | **Criar agendamento** → título + tipo + data → Criar | Agendamento criado e vinculado ao lead | |
| 3.3.8 | **Status: Resolvida** | Conversa marcada como resolvida | |
| 3.3.9 | **Status: Aguardando atendente** | Status atualiza | |

### 3.4 Painel do Lead (lado direito)

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 3.4.1 | Expandir "Cadastro completo" → editar campos | Campos editáveis | |
| 3.4.2 | Salvar alterações do lead | Toast "Lead atualizado" | |
| 3.4.3 | Seção Notas Internas → adicionar nota | Nota salva visível só para equipe | |
| 3.4.4 | Seção Agendamentos → criar novo | Agendamento criado | |
| 3.4.5 | Seção Orçamentos → criar orçamento | Abre dialog de orçamento | |
| 3.4.6 | Seção Histórico → exibe eventos | Conversas e eventos anteriores | |
| 3.4.7 | Seção Identidades → exibe telefone/email | Identidades do lead listadas | |

### 3.5 Assumir / Atribuir Conversa

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 3.5.1 | Botão "Assumir" → conversa atribuída ao usuário logado | Responsável aparece no painel | |
| 3.5.2 | Atribuir a outro usuário via select | Responsável atualizado | |

---

## 🗂️ BLOCO 4 — Pipeline e Oportunidades

### 4.1 Pipeline

**Caminho:** Pipeline

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 4.1.1 | Criar novo pipeline (nome) | Aparece na lista de pipelines | |
| 4.1.2 | Adicionar etapas (Novo, Em contato, Proposta, Fechado) | Colunas aparecem no kanban | |
| 4.1.3 | Renomear etapa: clicar no nome → editar → Enter | Nome salvo inline | |
| 4.1.4 | Renomear etapa: pressionar Escape | Cancela edição | |
| 4.1.5 | Reordenar etapas (drag & drop) | Nova ordem salva | |
| 4.1.6 | Excluir etapa sem leads | Etapa removida | |

### 4.2 Oportunidades

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 4.2.1 | Criar oportunidade para um lead | Card aparece na etapa inicial | |
| 4.2.2 | Definir valor, responsável, data de fechamento | Dados salvos | |
| 4.2.3 | Mover card entre etapas (drag & drop) | Etapa atualizada no banco | |
| 4.2.4 | Marcar oportunidade como perdida | Campo "Motivo de perda" exibido | |
| 4.2.5 | Filtrar pipeline por responsável / período | Filtro funciona | |

---

## 💰 BLOCO 5 — Vendas e Orçamentos

### 5.1 Orçamentos

**Caminho:** Painel do lead → Orçamentos → Novo orçamento

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 5.1.1 | Criar orçamento (título, cliente, validade) | Orçamento criado com número automático | |
| 5.1.2 | Adicionar itens (produto + quantidade + valor) | Subtotal calculado automaticamente | |
| 5.1.3 | Aplicar desconto | Total recalculado | |
| 5.1.4 | Remover item | Total atualizado | |
| 5.1.5 | Marcar orçamento como "Enviado" | Status atualizado | |
| 5.1.6 | Converter para venda | Venda criada no histórico | |

### 5.2 Vendas

**Caminho:** Vendas

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 5.2.1 | Registrar venda manualmente (lead + valor) | Venda aparece na lista | |
| 5.2.2 | Adicionar itens da venda | Total calculado | |
| 5.2.3 | Venda aparece no histórico do lead | Histórico atualizado | |
| 5.2.4 | Filtrar vendas por período | Filtro funciona | |

### 5.3 Produtos e Serviços

**Caminho:** Produtos

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 5.3.1 | Criar produto (nome, tipo "produto", valor padrão) | Aparece na lista e no catálogo do chat | |
| 5.3.2 | Criar serviço (nome, tipo "servico", valor) | Aparece na lista e no orçamento | |
| 5.3.3 | Editar produto | Alterações salvas | |
| 5.3.4 | Desativar produto | Não aparece no catálogo | |

---

## 📅 BLOCO 6 — Agendamentos

**Caminho:** Agendamentos

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 6.1 | Visualização mensal → setas ← → para navegar meses | Meses trocam corretamente | |
| 6.2 | Clicar em um dia → painel direito mostra agendamentos | Agendamentos do dia listados | |
| 6.3 | Duplo clique em dia vazio → modal de novo agendamento | Modal abre com data pré-preenchida | |
| 6.4 | Criar agendamento: Reunião 🤝 com link de reunião | Salvo e exibido no calendário | |
| 6.5 | Criar: Ligação 📞, Visita 🏠, Tarefa ✅, Follow-up 🔔 | Ícone correto no card | |
| 6.6 | Aba "Lista" → cronológico | Todos os agendamentos em ordem | |
| 6.7 | Marcar como Concluído | Status "concluido" no card | |
| 6.8 | Cancelar agendamento | Status "cancelado" | |
| 6.9 | Editar agendamento existente | Dados atualizados | |
| 6.10 | Agendamento criado no chat → aparece no calendário | Sincronização correta | |

---

## 📣 BLOCO 7 — Campanhas e Templates

### 7.1 Templates WhatsApp

**Caminho:** Templates

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 7.1.1 | Criar template (nome, corpo com variáveis {{1}}) | Salvo na lista | |
| 7.1.2 | Definir categoria UTILITY / MARKETING | Campo salvo | |
| 7.1.3 | Enviar template via chat (⋮ → template) | Mensagem enviada/simulada | |

### 7.2 Campanhas

**Caminho:** Campanhas → Nova campanha

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 7.2.1 | Criar campanha → selecionar template | Campanha criada | |
| 7.2.2 | Definir filtros de leads (status, origem) | Filtros salvos | |
| 7.2.3 | Agendar campanha para data futura | Status "agendada" | |
| 7.2.4 | Ver totais: destinatários, enviados, falhas, opt-outs | Contadores visíveis | |

---

## 🤖 BLOCO 8 — Chatbot & Fluxos

**Caminho:** Chatbot & Fluxos

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 8.1 | **Saudação automática** → novo fluxo → mensagens + delay + horário + dias | Fluxo salvo e ativo | |
| 8.2 | **Menu interativo** → cabeçalho + opções numeradas | Salvo | |
| 8.3 | **Resposta por palavra-chave** → palavra + resposta + modo exato | Salvo | |
| 8.4 | **Assistente IA** → prompt + modelo GPT + token OpenAI | Salvo | |
| 8.5 | **Fora do horário** → mensagem de expediente | Salvo | |
| 8.6 | Toggle Ativo/Inativo em cada fluxo | Estado persistido | |
| 8.7 | Vincular fluxo a canal específico | Canal vinculado | |
| 8.8 | Definir dias da semana e horário de funcionamento | Configuração salva | |

---

## 🏘️ BLOCO 9 — Grupos WhatsApp

**Caminho:** Grupos WhatsApp

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 9.1 | Página exibe aviso se não houver canal Evolution API | Aviso exibido | |
| 9.2 | Registrar grupo (nome, canal, JID, descrição) | Grupo criado | |
| 9.3 | Editar grupo | Dados atualizados | |
| 9.4 | Remover grupo | Removido da lista | |

---

## 📊 BLOCO 10 — Conversões e Analytics

### 10.1 Dashboard

**Caminho:** Dashboard

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 10.1.1 | Cards: leads, conversas, oportunidades, vendas, valor ganho | Números corretos | |
| 10.1.2 | Gráfico "Novos contatos por dia" — 30 dias | Gráfico exibido | |
| 10.1.3 | Tabela "Performance de Campanhas" | Dados de campanhas | |
| 10.1.4 | Trocar abas UTM: Campanha / Source / Medium / Conjunto / Anúncio | Tabela atualiza | |
| 10.1.5 | Filtrar por empresa e por período (De / Até) | Dados filtrados | |

### 10.2 Configurações de Conversão

**Caminho:** Conversões → Configurações

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 10.2.1 | Meta Ads → pixel ID + token CAPI (toggle mostrar/ocultar) | Token salvo mascarado | |
| 10.2.2 | Vincular pixel a canal WhatsApp | Canal vinculado | |
| 10.2.3 | Google Ads → Customer ID + Conversion Action ID | Salvos | |
| 10.2.4 | TikTok → Advertiser ID + Event Source ID | Salvos | |

### 10.3 Exportação de Conversões

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 10.3.1 | Exportar conversões → CSV | Arquivo gerado/download | |
| 10.3.2 | Filtrar por período antes de exportar | Exportação filtrada | |

---

## 🔗 BLOCO 11 — Integrações Externas

**Caminho:** Integrações

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 11.1 | Ver catálogo: Zapier, Make, RD Station, HubSpot, etc. | Lista exibida | |
| 11.2 | Zapier → webhook URL gerado automaticamente → copiar | URL copiada | |
| 11.3 | RD Station → campo API Key (mostrar/ocultar) | Toggle funciona | |
| 11.4 | Ver lista de eventos que serão disparados | Lista visível | |
| 11.5 | Ativar integração → aparece em "Configuradas" | Status "ativo" | |
| 11.6 | Toggle on/off de integração ativa | Estado alterado | |

---

## 🤝 BLOCO 12 — Afiliados

**Caminho:** Afiliados

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 12.1 | Criar afiliado (nome, email, código auto-gerado, comissão %) | Afiliado criado | |
| 12.2 | Copiar link de indicação | Link copiado para clipboard | |
| 12.3 | Registrar indicação → vincular ao afiliado | Indicação criada | |
| 12.4 | Mudar status: Pendente → Contatado → Convertido → Perdido | Status atualizado | |
| 12.5 | Em "Convertido": botão "Marcar pago" | Comissão marcada como paga | |
| 12.6 | KPIs no topo: total afiliados, indicações, convertidas, comissão total, pendente pagar | Valores corretos | |

---

## 📚 BLOCO 13 — Base de Conhecimento

**Caminho:** Base de Conhecimento

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 13.1 | Criar artigo (título, categoria, tags, conteúdo Markdown) | Artigo criado | |
| 13.2 | Toggle "Visível para clientes" (público) | Estado salvo | |
| 13.3 | Buscar artigo por nome | Resultado filtrado | |
| 13.4 | Buscar artigo por conteúdo | Resultado filtrado | |
| 13.5 | Filtrar por categoria | Lista filtrada | |
| 13.6 | Clicar artigo → modal de leitura abre | Modal exibido | |
| 13.7 | Contador de visualizações incrementa ao abrir | +1 a cada abertura | |
| 13.8 | Editar artigo | Alterações salvas | |
| 13.9 | Excluir artigo | Removido da lista | |

---

## 👑 BLOCO 14 — Hierarquia de Contas (Manager)

**Caminho:** (troca para modo Manager no seletor de conta)

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 14.1 | Criar conta filha (Manager → Contas) | Conta criada | |
| 14.2 | Vincular filha a gerente | Hierarquia estabelecida | |
| 14.3 | Trocar contexto para conta filha | Dados da filha carregam | |
| 14.4 | Compartilhar canal da gerente com filha | Canal disponível na filha | |
| 14.5 | Enviar solicitação de vínculo entre contas | Solicitação criada | |
| 14.6 | Aprovar/rejeitar solicitação | Status atualizado | |

---

## 📥 BLOCO 15 — Importações

**Caminho:** Importações

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 15.1 | Upload CSV de leads (nome, telefone, email, status) | Importação processada | |
| 15.2 | Verificar registros com sucesso | Leads criados na lista | |
| 15.3 | Linha com erro (email inválido) | Contagem de erros correta | |
| 15.4 | Download do relatório de importação | Arquivo com detalhes de erros | |

---

## 🌐 BLOCO 16 — Comunidade

**Caminho:** Comunidade

| # | Teste | Esperado | Status |
|---|-------|----------|--------|
| 16.1 | Página carrega com novidades e roadmap | Conteúdo exibido | |
| 16.2 | Links de suporte visíveis | Links presentes | |
| 16.3 | Últimas atualizações da plataforma listadas | Lista exibida | |

---

## ✅ Scorecard Final

| Bloco | Total | ✅ OK | ❌ Falha | ⚠️ Parcial |
|-------|-------|-------|---------|-----------|
| 1 — Setup | 14 | 5 | 0 | 0 |
| 2 — Leads | | | | |
| 3 — Atendimento | | | | |
| 4 — Pipeline | | | | |
| 5 — Vendas | | | | |
| 6 — Agendamentos | | | | |
| 7 — Campanhas | | | | |
| 8 — Chatbot | | | | |
| 9 — Grupos WA | | | | |
| 10 — Conversões | | | | |
| 11 — Integrações | | | | |
| 12 — Afiliados | | | | |
| 13 — Base KB | | | | |
| 14 — Manager | | | | |
| 15 — Importações | | | | |
| 16 — Comunidade | | | | |
| **TOTAL** | | | | |

---

## 🐛 Log de Bugs

| # | Bloco | Descrição | Passos para reproduzir | Severidade |
|---|-------|-----------|----------------------|-----------|
| 1 | 1.2.3 | CEP não autocompleta no Perfil Comercial | Configurações → Perfil Comercial → digitar CEP no campo endereço → campos Rua/Bairro/Cidade/Estado não preenchem automaticamente | Baixa |

---

*Gerado automaticamente com base no schema do banco de dados — Krescer SMKT v9*
