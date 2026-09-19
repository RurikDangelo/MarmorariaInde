# 02 — Instalação e ambiente local

## Pré-requisitos

- Node.js 20+ (testado com 24.19)
- npm 10+
- Uma conta Supabase com um projeto criado
- Git

## Passo a passo

```bash
git clone <url-do-repositorio> MarmorariaIndependencia
cd MarmorariaIndependencia
npm install
cp .env.local.example .env.local
```

### Preencher `.env.local`

| Variável | Onde pegar | Vai para a Vercel? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | **Sim** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon/publishable key | **Sim** |
| `SUPABASE_DB_URL` | Supabase → Project Settings → Database → Connection string | **Não** (só local/CI) |
| `NEXT_PUBLIC_SITE_URL` | URL pública do app (ex.: `https://…vercel.app`) | **Sim** |

> `NEXT_PUBLIC_SUPABASE_ANON_KEY` é pública por natureza — quem protege os dados é a RLS.
> `SUPABASE_DB_URL` contém a senha do banco e **nunca** sai da máquina/CI.

### Criar o schema

```bash
npm run db:push
```

Aplica `supabase/migrations/*.sql` em ordem e registra o que já rodou em
`public.schema_migrations`. As migrations são idempotentes — rodar de novo não quebra.

### Dados de demonstração (opcional, só em desenvolvimento)

```bash
npm run db:seed              # cria clientes, chapas, OS, produção, financeiro DEMO
npm run db:seed -- --limpar  # remove tudo que está marcado como is_demo
```

Todo dado DEMO tem `is_demo = true` e nome prefixado com `[DEMO]`.

### Primeiro usuário

O primeiro usuário criado no Supabase Auth vira **ADMINISTRADOR** automaticamente
(migration `0011_bootstrap_admin.sql`).

1. Supabase → Authentication → Users → **Add user**
2. Informe e-mail e senha, marque *Auto Confirm User*
3. Entre no sistema com esse e-mail

Os próximos usuários entram como `OPERACIONAL` e o papel é ajustado em **Equipe**.

### Rodar

```bash
npm run dev        # http://localhost:3000
npm run build      # build de produção
npm run typecheck  # tsc --noEmit
npm run lint
```

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `Supabase nao configurado` | `.env.local` sem as variáveis `NEXT_PUBLIC_*` |
| Login funciona mas tudo aparece vazio | Usuário sem permissão — confira o papel em **Equipe** |
| `db:push` não conecta | Senha errada na `SUPABASE_DB_URL` ou IP bloqueado no painel |
| Tela "Você não tem acesso" | Comportamento esperado do RBAC; ajuste o papel do usuário |
