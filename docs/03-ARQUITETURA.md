# 03 — Arquitetura

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | Next.js 16 (App Router) | RSC reduz JavaScript no cliente; oficina usa celular e rede ruim |
| UI | React 19 + Tailwind v4 + Radix (shadcn-style) | Componentes acessíveis sem dependência de tema de terceiros |
| Backend | Supabase (PostgreSQL 17) | Auth, Storage e RLS no mesmo lugar; regra de acesso mora no banco |
| Deploy | Vercel | Build e runtime alinhados ao Next |

## Fluxo de dados

```
Server Component  ──► createClient() (cookies) ──► PostgREST ──► RLS ──► dados
      │
      └─ Server Action ──► Zod ──► assertPermission() ──► escrita ──► RLS revalida
                                                            │
                                                            └─ triggers: histórico, totais, auditoria
```

Três camadas de autorização, nessa ordem de confiança (da menor para a maior):

1. **Interface** — esconde o que o usuário não pode usar. Conveniência, não segurança.
2. **Server Action** — `assertPermission('recurso.acao')` antes de qualquer escrita.
3. **RLS no banco** — a última palavra. Mesmo com token válido e requisição forjada,
   o Postgres recusa.

## Estrutura de pastas

```
src/
  app/
    (auth)/              login, recuperar-senha, nova-senha
    (app)/               área autenticada (sidebar + topbar)
      dashboard/ os/ orcamentos/ medicoes/ producao/ instalacoes/
      estoque/ clientes/ equipe/ financeiro/ alertas/ planos-de-acao/
      relatorios/ configuracoes/ auditoria/ perfil/
    api/relatorios/      exportação CSV
    auth/callback/       troca do code do e-mail por sessão
  components/
    ui/                  design system (Button, Dialog, Select…)
    shared/              blocos reutilizáveis (DataTable, Timeline, MetricCard…)
    layout/              sidebar, topbar, command menu
    theme/               provider e injeção das cores da empresa
  features/<modulo>/
    queries.ts           leitura (Server Components)
    actions.ts           escrita (Server Actions)
    schema.ts            validação Zod
    components/          componentes do módulo
  lib/
    supabase/            clients (browser, server, proxy)
    auth/                sessão, permissões
    utils.ts             formatadores e máscaras (pt-BR)
  types/database.ts      tipos das tabelas
supabase/migrations/     SQL versionado — fonte da verdade do schema
scripts/                 db-push, seed-demo
docs/                    esta documentação
```

## Decisões arquiteturais (ADR resumido)

### 1. RLS como autorização principal
**Decisão:** toda policy chama `public.has_perm('<recurso>.<acao>')`, que lê
`profiles → role_permissions`.
**Por quê:** a marmoraria terá usuários de perfis muito diferentes no mesmo app. Regra de
acesso espalhada no frontend vira bug de vazamento. No banco, é uma linha de policy.
**Custo:** cada consulta executa `has_perm` (função `stable`, cacheada dentro da query).

### 2. Funções `SECURITY DEFINER` para operações cruzadas
Reservar/consumir/perder material mexe em `stock_items`, `stock_movements` e
`work_order_history` ao mesmo tempo. Um usuário de Estoque não tem `work_orders.write`.
As funções (`reserve_stock_item`, `consume_stock_item`, `register_stock_loss`,
`convert_quote_to_work_order`) rodam como owner **e checam a permissão explicitamente**
com `has_perm` na primeira linha. Por isso **não usamos `FORCE ROW LEVEL SECURITY`**.

### 3. Medidas em milímetros, dinheiro em `numeric(14,2)`
Inteiro em mm elimina erro de ponto flutuante na área. `area_m2` e `total_price` são
**colunas geradas** — o valor não depende do cliente que gravou.

### 4. Status da OS é tabela, não enum
`work_order_statuses` alimenta o Kanban, a timeline e os filtros. Mudar o fluxo da
marmoraria é `UPDATE`, não deploy.

### 5. Tipos escritos à mão em `types/database.ts`
Em vez de gerar tipos do Supabase (que exigiria acesso de CLI ao projeto), as consultas
usam `.returns<T>()` com interfaces explícitas. Mais controle, menos acoplamento à tooling.

### 6. Paleta de gráficos separada da marca
A empresa escolhe primária/secundária/destaque em Configurações. Os tokens `--chart-*`
**não** mudam: são validados para daltonismo e contraste. Marca é identidade; gráfico é leitura.

## Convenções

- Interface em **português do Brasil**; código e identificadores em inglês.
- Toda tela tem loading, empty, error e feedback (toast).
- Componente acima de ~200 linhas é sinal de quebrar.
- Nada de `any` sem justificativa, `ignoreBuildErrors` ou `TODO` no lugar de implementação.
