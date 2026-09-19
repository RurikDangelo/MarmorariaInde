# 21 — Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) ·
Versionamento: [SemVer](https://semver.org/lang/pt-BR/).

## [0.1.0] — 2026-09-18

Primeira versão operacional do ERP da Marmoraria Independência.

### Adicionado

**Fundação**
- Next.js 16 (App Router, RSC) + React 19 + TypeScript + Tailwind v4
- Design system shadcn-style sobre Radix (22 primitivos) com tokens claro/escuro
- Tema da empresa persistido no banco e aplicado sem flash (server-side)
- PWA: manifest, ícone, atalhos e comportamento standalone

**Banco (11 migrations)**
- 36 tabelas, 115 policies de RLS, 14 policies de Storage
- RBAC com 8 papéis e 32 permissões verificadas no banco (`has_perm`)
- Colunas geradas para m², valor do item, valor pendente e duração de etapa
- Triggers de numeração, totais, timeline, histórico de medição e auditoria
- Funções transacionais de estoque (reserva, consumo com retalho, perda)
- `convert_quote_to_work_order()` — aprovação de orçamento gera OS atômica
- `refresh_alerts()` — recálculo idempotente dos alertas automáticos
- Primeiro usuário criado vira ADMINISTRADOR

**Módulos**
- Ordens de serviço: lista, Kanban com arrastar e soltar, detalhe com 8 abas,
  criação, edição, impressão A4 e timeline completa
- Peças da OS com beneficiamento (acabamento, borda, saia, frontão, recortes, cuba,
  cooktop, furos) e cálculo de m² e valor no banco
- Medições com checklist de 11 itens, condições do local, revisões com diff e
  importação das medidas para as peças da OS
- Produção: apontamento por etapa com responsável, duração e retrabalho
- Estoque: chapas, retalhos e insumos; reserva, consumo com geração de sobra,
  perdas com motivo e painel de desperdício
- Instalações: agenda, checklist de 8 itens e conclusão que finaliza a OS
- Orçamentos: itens, situações e conversão em OS preservando os dados
- Financeiro: contas a pagar e receber, baixa e sincronização do recebido da OS
- Equipe: pessoas, equipes e desempenho a partir de dados reais
- Alertas: 8 regras automáticas com severidade
- Planos de ação: problema, ação, responsável, prazo e status
- Dashboard executivo com filtro de período
- Relatórios: 6 exportações CSV respeitando as permissões
- Configurações: empresa, identidade visual, etapas do fluxo e matriz de permissões
- Auditoria: log imutável de alterações sensíveis

**Acesso**
- Criação de usuários pelo próprio sistema (Equipe → Novo usuário), com senha
  provisória, definição de papel e redefinição de senha
- `service_role` isolada em `src/lib/supabase/admin.ts` com `import 'server-only'`
- O papel nunca vem do metadata do Auth: todo usuário nasce `OPERACIONAL`
  (exceto o primeiro do sistema)

**Qualidade**
- Textos de catálogo, triggers e mensagens de erro em português correto
- Helpers `format_quantity()` e `format_currency()` no banco, independentes do locale
  do servidor (5,5 · 1.250 · R$ 5.626,00)
- Paleta de gráficos validada para daltonismo e contraste em ambos os temas
- Loading, empty e error states em todas as telas; tabelas viram cartões no celular
- Seed de dados DEMO marcados com `is_demo`, removível por comando

### Notas de migração

Primeira versão — nada a migrar.
Para subir do zero: `npm run db:push` e crie o primeiro usuário no Supabase Auth.

### Pendências conhecidas

- Rate limiting adicional na borda (hoje é o padrão do Supabase Auth)
- MFA disponível no Supabase, ainda não habilitado
- Ícones PNG do PWA (hoje SVG) para melhor resultado no iOS
- Política de retenção para `audit_logs`
