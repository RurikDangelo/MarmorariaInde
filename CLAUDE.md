# CLAUDE.md — MARMORARIA INDEPENDENCIA ERP

> Leia este arquivo **antes de qualquer alteração importante**.

## 1. Contexto

ERP vertical para marmoraria (São José dos Campos/SP, empresa desde 2009, granitos e
mármores nacionais e importados). **Não é um CRM.** O coração do sistema é a
**Ordem de Serviço (OS)**, que carrega o trabalho do orçamento até a instalação.

Fluxo operacional modelado:

```
ORÇAMENTO → APROVAÇÃO → MEDIÇÃO → CONFERÊNCIA → PLANEJAMENTO → SEPARAÇÃO DE MATERIAL
→ CORTE → ACABAMENTO → CONFERÊNCIA DE QUALIDADE → EXPEDIÇÃO → INSTALAÇÃO → FINALIZAÇÃO
```

Princípio: **desenvolva processos, não telas isoladas.** Toda mudança relevante gera
histórico (`work_order_history`) e, quando sensível, `audit_logs`.

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, RSC) |
| UI | React 19, TypeScript, Tailwind CSS v4, shadcn-style (Radix + CVA), Lucide |
| Backend | Supabase (PostgreSQL 17, Auth, Storage, RLS, Functions) |
| Deploy | Vercel |
| VCS | Git / GitHub |

## 3. Arquitetura

- **RSC-first**: páginas são Server Components e leem dados via `createServerClient`.
- **Desempenho** (ver `docs/03-ARQUITETURA.md`): sessão por `getSessionUser()`/`getClaims()`,
  nunca `auth.getUser()` em página ou layout; consultas independentes num único `Promise.all`
  (o documento principal junto com `requirePermission`); o que não muda a tela vai para
  `after()`. Funções da Vercel em `gru1`, a mesma região do Supabase (`vercel.json`).
- **Mutations**: Server Actions em `src/features/<modulo>/actions.ts`. Toda action:
  1. valida entrada com Zod;
  2. checa permissão (`requirePermission`);
  3. escreve no banco (RLS ainda revalida);
  4. `revalidatePath`.
- **Client Components** só onde há interação (kanban, forms, filtros, uploads).
- **Feature-first**: `src/features/<modulo>/{actions.ts,queries.ts,schema.ts,components/}`.
- `src/components/ui/*` = design system (primitivos). `src/components/shared/*` = blocos
  reutilizáveis (DataTable, PageHeader, StatusBadge, Timeline, KanbanBoard...).

```
src/
  app/(auth)/            # login, recuperação de senha
  app/(app)/             # área autenticada (sidebar + topbar)
  components/ui/         # design system
  components/shared/     # blocos reutilizáveis
  features/<modulo>/     # regra de negócio por módulo
  lib/supabase/          # clients (browser, server, middleware)
  lib/auth/              # sessão, permissões, RBAC
  lib/                   # utils, formatters, constants
  types/database.ts      # tipos do schema
supabase/migrations/     # SQL versionado (fonte da verdade do banco)
docs/                    # documentação obrigatória
```

## 4. Banco de dados

- Fonte da verdade: `supabase/migrations/*.sql` (ordem lexicográfica).
- Aplicar: `npm run db:push` (usa `SUPABASE_DB_URL` do `.env.local`).
- Toda tabela de negócio tem `id uuid pk default gen_random_uuid()`, `created_at`,
  `updated_at`, `created_by`, `updated_by`.
- **Medidas em milímetros** (`integer`). `area_m2` é coluna **gerada**. Nunca calcule m²
  no frontend para persistir.
- **Dinheiro** em `numeric(14,2)`. Nunca `float`.
- Status de OS é FK para `work_order_statuses` (colunas do Kanban são dados, não código).
- **Montagem** (ambientes → produtos → materiais/peças/composição) é do orçamento **ou**
  da OS (`quote_id` XOR `work_order_id`) e só é gravada por funções `SECURITY DEFINER`
  (`save_line_item`, `save_environment`...). As tabelas são só leitura pela API. Ver
  `docs/22-MONTAGEM-DO-ORCAMENTO.md`. A OS é uma **tela única** (`/os/nova`, `/os/[id]`).
- Migrations precisam ser idempotentes (`db:push -- --all`) e testadas com
  `npm run db:test` (Postgres local) antes de ir para produção.

## 5. Segurança (inegociável)

- **RLS ligado em todas as tabelas.** Política padrão usa `public.has_perm('<recurso>.<acao>')`.
- Permissão é verificada **no banco e no servidor**. O frontend só esconde UI.
- `service_role` **nunca** vai para o client nem para o repositório.
- Entrada sempre validada com Zod antes de tocar o banco.
- Uploads vão para buckets privados com policy por permissão.
- Ações sensíveis gravam `audit_logs`.

## 6. Padrões de código

- TypeScript estrito. `any` só com justificativa em comentário.
- Componente > 200 linhas é sinal de que deve ser quebrado.
- Nada de `ignoreBuildErrors`, `TODO` no lugar de implementação, ou dado fake em produção.
- Toda tela precisa de: loading state, empty state, error state e feedback (toast).
- Mobile-first: tabela vira lista em telas pequenas; Kanban rola horizontalmente.
- Texto da interface em **português do Brasil**; código e identificadores em inglês.

## 7. Comandos

```bash
npm run dev        # desenvolvimento
npm run build      # build de produção (precisa passar antes de qualquer entrega)
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run db:push    # aplica supabase/migrations/*.sql
npm run db:seed    # popula dados DEMO (somente desenvolvimento)
npm run db:test    # testes do banco (TEST_DATABASE_URL = Postgres local descartável)
npm run db:bundle -- 0020  # .sql único das migrations para o SQL Editor do Supabase
```

## 8. Workflow obrigatório

1. analisar → 2. planejar → 3. implementar → 4. testar → 5. corrigir →
6. revisar segurança → 7. atualizar documentação → 8. registrar mudança (commit semântico)

Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `security:`.

## 9. Testes / qualidade mínima antes de "pronto"

- `npm run typecheck` e `npm run build` sem erro.
- CRUD testado, permissões testadas, RLS testado.
- Responsividade verificada (desktop, tablet, celular).

## 10. Documentação

`/docs` é obrigatório e deve ser atualizado junto com a feature.
`docs/20-MANUAL-PONTA-A-PONTA.md` descreve do primeiro login até a finalização de uma OS.
`docs/21-CHANGELOG.md` registra cada entrega.

## 11. O que NÃO construir

CRM, funil de vendas, leads, pipeline comercial, automação de marketing, social media.
