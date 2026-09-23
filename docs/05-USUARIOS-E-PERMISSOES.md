# 05 — Usuários e permissões (RBAC)

## Como funciona

1. O usuário nasce no **Supabase Auth**.
2. Um trigger cria o registro em `public.profiles` com um papel.
   O **primeiro usuário do sistema vira `ADMINISTRADOR`**; os demais entram como `OPERACIONAL`.
3. O papel aponta para um conjunto de permissões em `role_permissions`.
4. Toda policy de RLS chama `public.has_perm('<recurso>.<acao>')`.

Trocar o papel de alguém muda o acesso **imediatamente, inclusive no banco** — não existe
"permissão só no frontend".

## Papéis

| Papel | Para quem | Resumo do acesso |
|---|---|---|
| `ADMINISTRADOR` | dono / TI | tudo, inclusive usuários e configurações |
| `GESTOR` | gerente de operação | tudo da operação; não gerencia usuários nem altera configurações |
| `PRODUCAO` | oficina | vê OS, aponta produção, move etapas, consulta estoque |
| `MEDICAO` | medidor de campo | vê OS, registra e edita medições, move etapas |
| `INSTALACAO` | equipe de obra | vê OS, registra instalação e checklist, move etapas |
| `FINANCEIRO` | administrativo | financeiro completo, clientes, leitura de OS e orçamentos |
| `ESTOQUE` | pátio / almoxarifado | estoque completo, leitura de OS e produção |
| `OPERACIONAL` | consulta | leitura da operação, sem escrita |

## Permissões

Formato `recurso.acao`. Catálogo completo em `0009_seed_catalog.sql` e visível na tela
**Configurações → Permissões**.

```
customers.read/write
quotes.read/write/approve/delete
work_orders.read/write/status/delete
measurements.read/write
production.read/write
installations.read/write
stock.read/write
financial.read/write
team.read/write
users.read/write
settings.read/write
alerts.read/write
action_plans.read/write
reports.read
dashboard.read
audit.read
```

## Criar um usuário

**Pelo próprio sistema** (recomendado) — quem tem `users.write`:

1. **Equipe → Novo usuário**
2. Nome, e-mail, função, papel de acesso e uma senha provisória
   (o sistema sugere uma fácil de ditar no telefone, ex.: `granito-bancada-4821`)
3. A pessoa entra com esse e-mail e senha, e troca a senha no primeiro acesso

Em **Equipe → Pessoas**, o botão **Senha** permite definir outra senha provisória
ou enviar o link de redefinição por e-mail.

**Pelo painel do Supabase** (alternativa) — Authentication → Users → Add user,
marcando *Auto Confirm User*.

> Não existe autocadastro público. A marmoraria decide quem entra.

### Acesso sem e-mail real

O medidor e o instalador normalmente não têm e-mail da empresa. No campo
**Acesso** você pode digitar só um nome de usuário:

```
joao.silva  →  joao.silva@marmoraria.app
```

O domínio vem de **Configurações → Domínio de login**. Esses endereços não
recebem e-mail: a senha provisória é entregue pelo administrador, e a
redefinição é feita pelo botão **Senha** na lista de pessoas.

Se você digitar um e-mail real (com `@`), ele é usado como está — e aí a pessoa
também consegue usar o "Esqueci a senha".

> O Supabase valida o domínio do e-mail no cadastro. Se ele recusar o domínio
> configurado, a tela avisa e basta trocar em Configurações — sem deploy.

### Por que isso exige a service_role

Criar usuário no Auth é operação administrativa: a API pública só cria conta se
a própria pessoa se cadastrar. O sistema usa `SUPABASE_SERVICE_ROLE_KEY`, que
existe **somente no servidor**, com três travas:

- `src/lib/supabase/admin.ts` começa com `import 'server-only'`. Se algum
  componente de cliente importar esse arquivo, **o build quebra**. A chave não
  tem como chegar ao browser por acidente.
- A chave ignora RLS. Por isso toda action que a usa chama
  `assertPermission('users.write')` na primeira linha — sem RLS para defender,
  a checagem explícita é a única barreira.
- O **papel** não é aplicado com a service_role. Ele é gravado em um segundo
  passo, com a sessão do administrador, passando por RLS e pelo trigger
  `tg_protect_profile_role`. Quem não pode promover, não promove — nem por aqui.

Sem a variável configurada o sistema funciona normalmente: apenas a criação de
usuários pela tela fica indisponível, e a tela avisa isso.

## Proteções contra escalada de privilégio

- **O papel nunca vem do metadata do Auth.** `signUp()` aceita metadata arbitrário do
  cliente; se o trigger confiasse nele, bastaria pedir `role: ADMINISTRADOR` no cadastro.
  Todo usuário nasce `OPERACIONAL` (migration `0017`), exceto o primeiro do sistema.
- `tg_protect_profile_role`: só quem tem `users.write` altera `role` ou `active`.
  O usuário pode editar o próprio nome e telefone, nunca o próprio papel.
- `profiles`: cada um enxerga o próprio registro; a lista completa exige `users.read`.
- `audit_logs`: sem policy de `insert`/`update`/`delete` — escrita só via trigger
  `SECURITY DEFINER`. O log não pode ser adulterado pela API.
- `anon` (não autenticado) teve todos os privilégios revogados no schema `public`.

## Testar uma permissão

```sql
-- no SQL Editor do Supabase, como o usuário autenticado:
select public.current_role_code();
select * from public.my_permissions();
select public.has_perm('work_orders.write');
```
