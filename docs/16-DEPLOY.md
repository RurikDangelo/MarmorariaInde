# 16 — Deploy

## Variáveis de ambiente

### Na Vercel (Production, Preview e Development)

| Variável | Valor | Secreta? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | não |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/publishable key do projeto | não (protegida por RLS) |
| `NEXT_PUBLIC_SITE_URL` | URL pública do app | não |

### Somente local/CI — **nunca** na Vercel

| Variável | Uso |
|---|---|
| `SUPABASE_DB_URL` | `npm run db:push` e `npm run db:seed` |
| `SUPABASE_SERVICE_ROLE_KEY` | scripts administrativos, se um dia forem necessários |

> `service_role` ignora RLS. Se ela vazar para o browser, todo o controle de acesso cai.
> Ela não é usada em nenhum ponto do código da aplicação.

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
O preset do Next.js já cobre build e runtime; não há configuração especial.

### 3. Supabase

Depois de saber a URL de produção:

**Authentication → URL Configuration**
- Site URL: `https://<seu-app>.vercel.app`
- Redirect URLs: `https://<seu-app>.vercel.app/auth/callback`

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
- [ ] Redirect URLs configuradas no Supabase
- [ ] Autocadastro desativado
- [ ] Usuário administrador criado e testado
- [ ] Advisors de segurança do Supabase revisados
