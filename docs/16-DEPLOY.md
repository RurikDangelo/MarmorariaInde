# 16 — Deploy

> **Ambiente atual**
> Produção: https://marmoraria-independencia.vercel.app
> Projeto Vercel: `tivexy/marmoraria-independencia` · repositório: `RurikDangelo/MarmorariaInde`
> Supabase: projeto `gzkeermtmkpgnxwwxgaq` (região sa-east-1)
> Funções da Vercel: `gru1` (São Paulo), fixado em `vercel.json` — a mesma cidade do banco
> O deploy é automático a cada push na branch `main`.

## Variáveis de ambiente

### Na Vercel (Production, Preview e Development)

| Variável | Valor | Secreta? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | não |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/publishable key do projeto | não (protegida por RLS) |
| `NEXT_PUBLIC_SITE_URL` | URL pública do app | não |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → `service_role` | **SIM — marque como Sensitive** |

### Somente local/CI — **nunca** na Vercel

| Variável | Uso |
|---|---|
| `SUPABASE_DB_URL` | `npm run db:push` e `npm run db:seed` |

> `service_role` ignora RLS. Se vazar para o browser, todo o controle de acesso cai.
> Ela é usada **apenas** em `src/lib/supabase/admin.ts`, que importa `server-only` —
> qualquer tentativa de usá-la em componente de cliente quebra o build. Serve só para
> criar usuário no Auth e redefinir senha, sempre atrás de `users.write`.
> Sem ela o sistema funciona: só a criação de usuários pela tela fica indisponível.

## Passo a passo

### 1. GitHub

```bash
git init
git add .
git commit -m "feat: initial ERP for marmoraria"
gh repo create marmoraria-independencia --private --source=. --push
```

### 2. Vercel

```bash
vercel login
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add NEXT_PUBLIC_SITE_URL production
vercel --prod
```

Pelo painel: New Project → importar o repositório → adicionar as três variáveis → Deploy.
O preset do Next.js cobre build e runtime.

**Região das funções.** O `vercel.json` fixa as funções em **`gru1` (São Paulo)**, ao lado
do Supabase (`sa-east-1`). Sem isso a Vercel usa Washington (`iad1`) e cada consulta ao
banco atravessa o continente (~120 ms ida e volta, várias por tela). Se o banco mudar de
região, mude o `regions` junto. Para conferir, o cabeçalho `x-vercel-id` traz
`<borda>::<função>::…` e deve mostrar `gru1::gru1`:

```bash
curl -sI https://marmoraria-independencia.vercel.app/login | grep -i x-vercel-id
```

### 3. Supabase

Depois de saber a URL de produção:

**Authentication → URL Configuration**
- Site URL: `https://marmoraria-independencia.vercel.app`
- Redirect URLs: `https://marmoraria-independencia.vercel.app/auth/callback`

Sem isso, o link de recuperação de senha volta para `localhost`.

**Authentication → Providers → Email**
- Desative *Enable sign ups* (não existe autocadastro neste sistema)

### 4. Primeiro acesso

Authentication → Users → Add user (com *Auto Confirm*). O primeiro usuário vira
`ADMINISTRADOR` automaticamente.

## Migrations em produção

```bash
SUPABASE_DB_URL="postgresql://…" npm run db:push
```

Roda da sua máquina ou de um job de CI com a variável protegida. O script registra o que
já foi aplicado em `public.schema_migrations` e é seguro rodar de novo.

## Checklist antes de liberar para a equipe

- [ ] `npm run typecheck` e `npm run build` sem erro
- [ ] Migrations aplicadas (`npm run db:push`)
- [ ] Dados DEMO removidos (`npm run db:seed -- --limpar`)
- [ ] Variáveis configuradas na Vercel
- [ ] Funções na mesma região do banco (`x-vercel-id` com `gru1::gru1`)
- [ ] Redirect URLs configuradas no Supabase
- [ ] Autocadastro desativado
- [ ] Usuário administrador criado e testado
- [ ] Advisors de segurança do Supabase revisados
