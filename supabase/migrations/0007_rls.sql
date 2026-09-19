-- =========================================================================
-- 0007_rls.sql - Row Level Security em TODAS as tabelas
-- Regra: nada e acessivel sem permissao verificada no banco.
-- =========================================================================

-- Gera o conjunto padrao de policies para uma tabela de negocio.
create or replace function public.apply_standard_rls(
  p_table    text,
  p_resource text,
  p_delete_permission text default null
)
returns void
language plpgsql
as $fn$
declare
  v_delete text := coalesce(p_delete_permission, p_resource || '.write');
begin
  -- NAO usamos FORCE ROW LEVEL SECURITY de proposito: as funcoes SECURITY DEFINER
  -- (reserva/consumo de estoque, triggers de historico e totais) precisam escrever em
  -- tabelas de outro modulo. Elas validam a permissao explicitamente com has_perm().
  execute format('alter table public.%I enable row level security', p_table);

  execute format('drop policy if exists %I on public.%I', p_table || '_select', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_insert', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_update', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_delete', p_table);

  execute format(
    'create policy %I on public.%I for select to authenticated using (public.has_perm(%L))',
    p_table || '_select', p_table, p_resource || '.read');

  execute format(
    'create policy %I on public.%I for insert to authenticated with check (public.has_perm(%L))',
    p_table || '_insert', p_table, p_resource || '.write');

  execute format(
    'create policy %I on public.%I for update to authenticated using (public.has_perm(%L)) with check (public.has_perm(%L))',
    p_table || '_update', p_table, p_resource || '.write', p_resource || '.write');

  execute format(
    'create policy %I on public.%I for delete to authenticated using (public.has_perm(%L))',
    p_table || '_delete', p_table, v_delete);
end;
$fn$;

-- Tabelas de catalogo: qualquer usuario autenticado le, so settings.write escreve.
create or replace function public.apply_catalog_rls(p_table text)
returns void
language plpgsql
as $fn$
begin
  execute format('alter table public.%I enable row level security', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_select', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_write', p_table);

  execute format(
    'create policy %I on public.%I for select to authenticated using (auth.uid() is not null)',
    p_table || '_select', p_table);
  execute format(
    'create policy %I on public.%I for all to authenticated using (public.has_perm(''settings.write'')) with check (public.has_perm(''settings.write''))',
    p_table || '_write', p_table);
end;
$fn$;

-- -------------------------------------------------------------------------
-- Catalogos
-- -------------------------------------------------------------------------
select public.apply_catalog_rls('roles');
select public.apply_catalog_rls('permissions');
select public.apply_catalog_rls('work_order_statuses');
select public.apply_catalog_rls('production_steps');
select public.apply_catalog_rls('material_types');

-- role_permissions: leitura autenticada (o frontend monta o menu), escrita so users.write
alter table public.role_permissions enable row level security;
drop policy if exists role_permissions_select on public.role_permissions;
drop policy if exists role_permissions_write on public.role_permissions;
create policy role_permissions_select on public.role_permissions
  for select to authenticated using (auth.uid() is not null);
create policy role_permissions_write on public.role_permissions
  for all to authenticated
  using (public.has_perm('users.write')) with check (public.has_perm('users.write'));

-- document_counters: manipulado apenas por funcao security definer
alter table public.document_counters enable row level security;
drop policy if exists document_counters_select on public.document_counters;
create policy document_counters_select on public.document_counters
  for select to authenticated using (public.has_perm('settings.read'));

-- -------------------------------------------------------------------------
-- Perfis
-- -------------------------------------------------------------------------
alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete on public.profiles;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_perm('users.read'));

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (public.has_perm('users.write'));

-- O usuario edita o proprio cadastro; papel e situacao sao bloqueados por trigger.
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_perm('users.write'))
  with check (id = auth.uid() or public.has_perm('users.write'));

create policy profiles_delete on public.profiles
  for delete to authenticated
  using (public.has_perm('users.write'));

-- Impede escalacao de privilegio: so quem tem users.write muda papel/situacao.
create or replace function public.tg_protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active)
     and not public.has_perm('users.write') then
    raise exception 'Somente administradores podem alterar papel ou situacao do usuario'
      using errcode = '42501';
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_protect_profile_role on public.profiles;
create trigger trg_protect_profile_role before update on public.profiles
  for each row execute function public.tg_protect_profile_role();

-- -------------------------------------------------------------------------
-- Configuracoes da empresa: todos leem (tema/logo), so settings.write altera
-- -------------------------------------------------------------------------
alter table public.company_settings enable row level security;
drop policy if exists company_settings_select on public.company_settings;
drop policy if exists company_settings_update on public.company_settings;
create policy company_settings_select on public.company_settings
  for select to authenticated using (auth.uid() is not null);
create policy company_settings_update on public.company_settings
  for update to authenticated
  using (public.has_perm('settings.write')) with check (public.has_perm('settings.write'));

-- -------------------------------------------------------------------------
-- Tabelas de negocio
-- -------------------------------------------------------------------------
select public.apply_standard_rls('customers', 'customers');
select public.apply_standard_rls('materials', 'stock');
select public.apply_standard_rls('products', 'stock');
select public.apply_standard_rls('stock_locations', 'stock');
select public.apply_standard_rls('stock_items', 'stock');
select public.apply_standard_rls('stock_movements', 'stock');

select public.apply_standard_rls('quotes', 'quotes');
select public.apply_standard_rls('quote_items', 'quotes');

select public.apply_standard_rls('work_orders', 'work_orders', 'work_orders.delete');
select public.apply_standard_rls('work_order_items', 'work_orders');
select public.apply_standard_rls('work_order_photos', 'work_orders');
select public.apply_standard_rls('work_order_attachments', 'work_orders');

select public.apply_standard_rls('work_order_measurements', 'measurements');
select public.apply_standard_rls('work_order_measurement_items', 'measurements');

select public.apply_standard_rls('production_records', 'production');
select public.apply_standard_rls('installations', 'installations');

select public.apply_standard_rls('teams', 'team');
select public.apply_standard_rls('team_members', 'team');

select public.apply_standard_rls('financial_accounts', 'financial');
select public.apply_standard_rls('financial_categories', 'financial');
select public.apply_standard_rls('financial_transactions', 'financial');

select public.apply_standard_rls('action_plans', 'action_plans');

-- Historico da OS: leitura com work_orders.read, insercao manual com work_orders.write,
-- sem update/delete (timeline e imutavel).
alter table public.work_order_history enable row level security;
drop policy if exists work_order_history_select on public.work_order_history;
drop policy if exists work_order_history_insert on public.work_order_history;
create policy work_order_history_select on public.work_order_history
  for select to authenticated using (public.has_perm('work_orders.read'));
create policy work_order_history_insert on public.work_order_history
  for insert to authenticated with check (public.has_perm('work_orders.write'));

-- Historico de medicao: somente leitura para quem le medicao.
alter table public.work_order_measurement_history enable row level security;
drop policy if exists measurement_history_select on public.work_order_measurement_history;
create policy measurement_history_select on public.work_order_measurement_history
  for select to authenticated using (public.has_perm('measurements.read'));

-- Alertas: leitura ampla, dispensa (update) com alerts.write.
alter table public.alerts enable row level security;
drop policy if exists alerts_select on public.alerts;
drop policy if exists alerts_update on public.alerts;
drop policy if exists alerts_insert on public.alerts;
drop policy if exists alerts_delete on public.alerts;
create policy alerts_select on public.alerts
  for select to authenticated using (public.has_perm('alerts.read'));
create policy alerts_update on public.alerts
  for update to authenticated
  using (public.has_perm('alerts.write')) with check (public.has_perm('alerts.write'));
create policy alerts_insert on public.alerts
  for insert to authenticated with check (public.has_perm('alerts.write'));
create policy alerts_delete on public.alerts
  for delete to authenticated using (public.has_perm('alerts.write'));

-- Auditoria: somente leitura, e somente para quem tem audit.read.
-- Sem policy de insert/update/delete: gravacao acontece via trigger security definer.
alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated using (public.has_perm('audit.read'));

-- -------------------------------------------------------------------------
-- Revoga acesso anonimo em massa
-- -------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
revoke all on all sequences in schema public from anon;
