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
quotes.read/write/approve
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

1. Supabase → **Authentication → Users → Add user**
2. E-mail + senha, marque *Auto Confirm User*
3. O perfil aparece em **Equipe** no sistema
4. Um administrador ajusta o papel ali mesmo

> Não existe autocadastro. A marmoraria decide quem entra.

## Proteções contra escalada de privilégio

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
