# 17 — Segurança

## Modelo em três camadas

1. **Interface** — esconde o que o usuário não pode usar. Conveniência.
2. **Server Action** — `assertPermission('recurso.acao')` antes de qualquer escrita.
3. **RLS no PostgreSQL** — a decisão final. Toda tabela tem RLS ligada e policies que
   chamam `public.has_perm()`.

Uma requisição forjada direto na API do Supabase com o token de um usuário de Produção
não consegue ler o financeiro. O Postgres recusa.

## O que está implementado

| Controle | Como |
|---|---|
| Autenticação | Supabase Auth, sessão em cookie httpOnly, renovada no proxy a cada request |
| Proteção de rotas | `src/proxy.ts` redireciona quem não tem sessão |
| RBAC | `roles` → `role_permissions` → `has_perm()` nas policies |
| RLS | ligada em **todas** as tabelas de `public`; `anon` sem privilégios |
| Escalada de privilégio | trigger impede o usuário de mudar o próprio papel/situação |
| Validação de entrada | Zod em toda Server Action, antes de tocar o banco |
| Auditoria | trigger `SECURITY DEFINER` grava em `audit_logs`; sem policy de insert/update/delete |
| Storage | 4 buckets, 3 privados; policies herdam a permissão do módulo |
| Arquivos privados | acesso por URL assinada de 30 minutos, gerada no servidor |
| Segredos | nenhum no repositório; `.env.local` no `.gitignore` |
| `service_role` | não usada na aplicação, nunca exposta ao cliente |
| Mensagens de erro | login e recuperação de senha não revelam se o e-mail existe |

## Funções `SECURITY DEFINER`

São necessárias para operações que cruzam módulos (reservar material grava na timeline
da OS). Todas seguem a mesma regra:

```sql
if not public.has_perm('stock.write') then
  raise exception 'Sem permissao para movimentar estoque' using errcode = '42501';
end if;
```

Todas têm `set search_path = public` para evitar sequestro de schema.

**Não usamos `FORCE ROW LEVEL SECURITY`** — seria incompatível com esse desenho, já que a
função owner precisa escrever em tabelas de outro módulo. A permissão é verificada
explicitamente em vez disso.

## OWASP — como cada item é tratado

| Risco | Tratamento |
|---|---|
| Broken Access Control | RLS + RBAC no banco; nunca só no frontend |
| Cryptographic Failures | TLS ponta a ponta; senhas no Supabase Auth (bcrypt); sem segredo no cliente |
| Injection | consultas parametrizadas (PostgREST/pg); termos de busca sanitizados |
| Insecure Design | permissão granular por recurso e ação, não por tela |
| Security Misconfiguration | `anon` revogado; buckets privados por padrão; sem `ignoreBuildErrors` |
| Identification & Auth | sem autocadastro; recuperação por link de uso único |
| Data Integrity | valores calculados no banco (m², totais), não no cliente |
| Logging & Monitoring | `audit_logs` + `work_order_history` imutáveis |
| SSRF | a aplicação não busca URLs informadas pelo usuário |

## Pendências conscientes

- **Rate limiting** — hoje é o padrão do Supabase Auth. Se o app for exposto a tráfego
  aberto, adicionar limite por IP na borda (Vercel Firewall).
- **MFA** — o Supabase suporta; ainda não ativado.
- **Retenção de auditoria** — `audit_logs` cresce indefinidamente. Definir política de
  arquivamento quando passar de ~1M de linhas.

## Rotação de credenciais

A senha do banco deve ser rotacionada se tiver sido compartilhada em chat, e-mail ou
ticket: Supabase → Project Settings → Database → Reset database password. Depois, atualize
`SUPABASE_DB_URL` no `.env.local` e no CI. A anon key é pública e não precisa de rotação
por exposição.
