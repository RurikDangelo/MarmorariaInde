-- =========================================================================
-- 0006 - financeiro, planos de acao, alertas, auditoria e operacoes de estoque
-- =========================================================================

-- -------------------------------------------------------------------------
-- Financeiro
-- -------------------------------------------------------------------------
create table if not exists public.financial_accounts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  kind            text not null default 'CAIXA' check (kind in ('CAIXA','BANCO','CARTAO','OUTRO')),
  initial_balance numeric(14,2) not null default 0,
  active          boolean not null default true,
  notes           text,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id),
  updated_by      uuid references public.profiles(id)
);

create table if not exists public.financial_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       text not null check (kind in ('RECEITA','DESPESA')),
  color      text,
  active     boolean not null default true,
  is_demo    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  unique (name, kind)
);

create table if not exists public.financial_transactions (
  id             uuid primary key default gen_random_uuid(),
  description    text not null,
  kind           text not null check (kind in ('RECEITA','DESPESA')),
  category_id    uuid references public.financial_categories(id) on delete set null,
  account_id     uuid references public.financial_accounts(id) on delete set null,
  work_order_id  uuid references public.work_orders(id) on delete set null,
  customer_id    uuid references public.customers(id) on delete set null,
  amount         numeric(14,2) not null check (amount >= 0),
  due_date       date not null,
  paid_at        date,
  status         text not null default 'PENDENTE'
                 check (status in ('PENDENTE','PAGO','ATRASADO','CANCELADO')),
  payment_method text check (payment_method in
                   ('DINHEIRO','PIX','DEBITO','CREDITO','BOLETO','TRANSFERENCIA','CHEQUE','OUTRO')),
  installment    integer not null default 1,
  installments   integer not null default 1,
  notes          text,
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles(id),
  updated_by     uuid references public.profiles(id)
);

comment on table public.financial_transactions is
  'Contas a receber e a pagar. Receitas podem estar vinculadas a uma OS.';

create index if not exists idx_fin_tx_status_due on public.financial_transactions(status, due_date);
create index if not exists idx_fin_tx_wo on public.financial_transactions(work_order_id);
create index if not exists idx_fin_tx_kind_date on public.financial_transactions(kind, due_date desc);

-- Mantem work_orders.received_value sincronizado e registra na timeline.
create or replace function public.tg_sync_work_order_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_wo uuid := coalesce(new.work_order_id, old.work_order_id);
begin
  if v_wo is null then
    return null;
  end if;

  update public.work_orders wo
     set received_value = coalesce((
           select sum(t.amount)
             from public.financial_transactions t
            where t.work_order_id = v_wo
              and t.kind = 'RECEITA'
              and t.status = 'PAGO'
         ), 0),
         updated_at = now()
   where wo.id = v_wo;

  if tg_op <> 'DELETE' and new.status = 'PAGO'
     and (tg_op = 'INSERT' or old.status is distinct from 'PAGO') then
    insert into public.work_order_history (work_order_id, event_type, title, description, to_value, created_by)
    values (v_wo, 'PAGAMENTO', 'Pagamento recebido', new.description, new.amount::text, auth.uid());
  end if;

  return null;
end;
$fn$;

drop trigger if exists trg_sync_wo_received on public.financial_transactions;
create trigger trg_sync_wo_received
  after insert or update or delete on public.financial_transactions
  for each row execute function public.tg_sync_work_order_received();

-- -------------------------------------------------------------------------
-- Planos de acao
-- -------------------------------------------------------------------------
create table if not exists public.action_plans (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  problem        text,
  action         text,
  responsible_id uuid references public.profiles(id) on delete set null,
  work_order_id  uuid references public.work_orders(id) on delete set null,
  priority       text not null default 'NORMAL'
                 check (priority in ('BAIXA','NORMAL','ALTA','URGENTE')),
  due_date       date,
  status         text not null default 'ABERTO'
                 check (status in ('ABERTO','EM_ANDAMENTO','CONCLUIDO','CANCELADO')),
  completed_at   timestamptz,
  notes          text,
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles(id),
  updated_by     uuid references public.profiles(id)
);

create index if not exists idx_action_plans_status on public.action_plans(status, due_date);

-- -------------------------------------------------------------------------
-- Alertas
-- -------------------------------------------------------------------------
create table if not exists public.alerts (
  id          uuid primary key default gen_random_uuid(),
  alert_key   text not null unique,
  alert_type  text not null,
  severity    text not null default 'INFO' check (severity in ('INFO','ATENCAO','CRITICO')),
  title       text not null,
  description text,
  entity_type text,
  entity_id   uuid,
  href        text,
  auto        boolean not null default true,
  dismissed_at timestamptz,
  dismissed_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.alerts is
  'Alertas operacionais. Os automaticos sao recalculados por public.refresh_alerts().';

create index if not exists idx_alerts_severity on public.alerts(severity, created_at desc);

-- -------------------------------------------------------------------------
-- Auditoria
-- -------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  record_id   uuid,
  action      text not null check (action in ('INSERT','UPDATE','DELETE')),
  actor_id    uuid,
  changes     jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.audit_logs is 'Log imutavel de alteracoes em tabelas sensiveis.';

create index if not exists idx_audit_table_record on public.audit_logs(table_name, record_id, created_at desc);
create index if not exists idx_audit_actor on public.audit_logs(actor_id, created_at desc);

create or replace function public.tg_write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_changes jsonb;
  v_id uuid;
begin
  if tg_op = 'DELETE' then
    v_changes := to_jsonb(old);
    v_id := (to_jsonb(old)->>'id')::uuid;
  elsif tg_op = 'INSERT' then
    v_changes := to_jsonb(new);
    v_id := (to_jsonb(new)->>'id')::uuid;
  else
    select coalesce(jsonb_object_agg(key, jsonb_build_object('de', o.value, 'para', n.value)), '{}'::jsonb)
      into v_changes
      from jsonb_each(to_jsonb(old)) o
      join jsonb_each(to_jsonb(new)) n using (key)
     where o.value is distinct from n.value
       and key not in ('updated_at','updated_by');
    v_id := (to_jsonb(new)->>'id')::uuid;
    if v_changes = '{}'::jsonb then
      return coalesce(new, old);
    end if;
  end if;

  insert into public.audit_logs (table_name, record_id, action, actor_id, changes)
  values (tg_table_name, v_id, tg_op, auth.uid(), v_changes);

  return coalesce(new, old);
end;
$fn$;

create or replace function public.attach_audit_log_trigger(p_table text)
returns void
language plpgsql
as $fn$
begin
  execute format('drop trigger if exists trg_audit_log on public.%I', p_table);
  execute format(
    'create trigger trg_audit_log after insert or update or delete on public.%I '
    'for each row execute function public.tg_write_audit_log()', p_table);
end;
$fn$;

select public.attach_audit_log_trigger('work_orders');
select public.attach_audit_log_trigger('profiles');
select public.attach_audit_log_trigger('financial_transactions');
select public.attach_audit_log_trigger('stock_items');
select public.attach_audit_log_trigger('company_settings');
select public.attach_audit_log_trigger('role_permissions');

-- -------------------------------------------------------------------------
-- Operacoes de estoque (transacionais, com checagem explicita de permissao)
-- -------------------------------------------------------------------------
create or replace function public.reserve_stock_item(
  p_stock_item_id uuid,
  p_work_order_id uuid,
  p_notes text default null
)
returns public.stock_items
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_item public.stock_items;
begin
  if not public.has_perm('stock.write') then
    raise exception 'Sem permissao para movimentar estoque' using errcode = '42501';
  end if;

  select * into v_item from public.stock_items where id = p_stock_item_id for update;
  if not found then
    raise exception 'Item de estoque nao encontrado';
  end if;
  if v_item.status <> 'DISPONIVEL' then
    raise exception 'Item % nao esta disponivel (status atual: %)', coalesce(v_item.code, v_item.id::text), v_item.status;
  end if;

  update public.stock_items
     set status = 'RESERVADA',
         reserved_work_order_id = p_work_order_id,
         updated_at = now()
   where id = p_stock_item_id
  returning * into v_item;

  insert into public.stock_movements
    (stock_item_id, material_id, work_order_id, movement_type, quantity, area_m2, unit_cost, total_cost, notes, created_by)
  values (v_item.id, v_item.material_id, p_work_order_id, 'RESERVA', v_item.quantity, v_item.area_m2,
          v_item.unit_cost, v_item.unit_cost, p_notes, auth.uid());

  insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
  values (p_work_order_id, 'MATERIAL', 'Material reservado',
          coalesce(v_item.code, 'Item') || ' reservado para a OS.', auth.uid());

  return v_item;
end;
$fn$;

create or replace function public.release_stock_item(p_stock_item_id uuid, p_notes text default null)
returns public.stock_items
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_item public.stock_items;
  v_wo uuid;
begin
  if not public.has_perm('stock.write') then
    raise exception 'Sem permissao para movimentar estoque' using errcode = '42501';
  end if;

  select * into v_item from public.stock_items where id = p_stock_item_id for update;
  if not found then
    raise exception 'Item de estoque nao encontrado';
  end if;

  v_wo := v_item.reserved_work_order_id;

  update public.stock_items
     set status = 'DISPONIVEL', reserved_work_order_id = null, updated_at = now()
   where id = p_stock_item_id
  returning * into v_item;

  insert into public.stock_movements
    (stock_item_id, material_id, work_order_id, movement_type, quantity, area_m2, notes, created_by)
  values (v_item.id, v_item.material_id, v_wo, 'LIBERACAO', v_item.quantity, v_item.area_m2, p_notes, auth.uid());

  if v_wo is not null then
    insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
    values (v_wo, 'MATERIAL', 'Reserva liberada', coalesce(v_item.code, 'Item'), auth.uid());
  end if;

  return v_item;
end;
$fn$;

-- Consome a chapa e, opcionalmente, registra a sobra como novo item (retalho).
create or replace function public.consume_stock_item(
  p_stock_item_id uuid,
  p_work_order_id uuid,
  p_used_area_m2 numeric default null,
  p_remnant_length_mm integer default null,
  p_remnant_width_mm integer default null,
  p_notes text default null
)
returns public.stock_items
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_item public.stock_items;
  v_remnant_id uuid;
  v_cost numeric(14,2);
begin
  if not public.has_perm('stock.write') then
    raise exception 'Sem permissao para movimentar estoque' using errcode = '42501';
  end if;

  select * into v_item from public.stock_items where id = p_stock_item_id for update;
  if not found then
    raise exception 'Item de estoque nao encontrado';
  end if;
  if v_item.status in ('CONSUMIDA','DESCARTADA') then
    raise exception 'Item ja foi baixado (status: %)', v_item.status;
  end if;

  v_cost := coalesce(v_item.unit_cost, 0);

  update public.stock_items
     set status = 'CONSUMIDA',
         reserved_work_order_id = coalesce(p_work_order_id, reserved_work_order_id),
         updated_at = now()
   where id = p_stock_item_id
  returning * into v_item;

  insert into public.stock_movements
    (stock_item_id, material_id, work_order_id, movement_type, quantity, area_m2, unit_cost, total_cost, notes, created_by)
  values (v_item.id, v_item.material_id, p_work_order_id, 'CONSUMO', v_item.quantity,
          coalesce(p_used_area_m2, v_item.area_m2), v_item.unit_cost, v_cost, p_notes, auth.uid());

  -- sobra aproveitavel vira um novo item de estoque (retalho)
  if p_remnant_length_mm is not null and p_remnant_width_mm is not null
     and p_remnant_length_mm > 0 and p_remnant_width_mm > 0 then
    insert into public.stock_items
      (kind, code, material_id, location_id, supplier, batch, thickness_mm, length_mm, width_mm,
       is_remnant, parent_item_id, quantity, unit, unit_cost, status, notes, created_by, is_demo)
    values ('CHAPA', coalesce(v_item.code, 'CHAPA') || '-R' || substr(gen_random_uuid()::text, 1, 4),
            v_item.material_id, v_item.location_id, v_item.supplier, v_item.batch, v_item.thickness_mm,
            p_remnant_length_mm, p_remnant_width_mm, true, v_item.id, 1, v_item.unit, v_item.unit_cost,
            'DISPONIVEL', 'Retalho gerado da chapa ' || coalesce(v_item.code, v_item.id::text),
            auth.uid(), v_item.is_demo)
    returning id into v_remnant_id;

    insert into public.stock_movements
      (stock_item_id, material_id, work_order_id, movement_type, quantity, area_m2, unit_cost, notes, created_by)
    values (v_remnant_id, v_item.material_id, p_work_order_id, 'SOBRA', 1,
            round((p_remnant_length_mm::numeric / 1000) * (p_remnant_width_mm::numeric / 1000), 4),
            v_item.unit_cost, 'Retalho aproveitavel', auth.uid());
  end if;

  if p_work_order_id is not null then
    insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
    values (p_work_order_id, 'MATERIAL', 'Material consumido',
            coalesce(v_item.code, 'Item') || ' baixado do estoque.', auth.uid());
  end if;

  return v_item;
end;
$fn$;

create or replace function public.register_stock_loss(
  p_stock_item_id uuid,
  p_reason text,
  p_notes text default null,
  p_work_order_id uuid default null,
  p_discard boolean default false
)
returns public.stock_items
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_item public.stock_items;
begin
  if not public.has_perm('stock.write') then
    raise exception 'Sem permissao para movimentar estoque' using errcode = '42501';
  end if;
  if p_reason is null then
    raise exception 'Motivo da perda e obrigatorio';
  end if;

  select * into v_item from public.stock_items where id = p_stock_item_id for update;
  if not found then
    raise exception 'Item de estoque nao encontrado';
  end if;

  update public.stock_items
     set status = case when p_discard then 'DESCARTADA' else 'DANIFICADA' end,
         updated_at = now()
   where id = p_stock_item_id
  returning * into v_item;

  insert into public.stock_movements
    (stock_item_id, material_id, work_order_id, movement_type, quantity, area_m2,
     unit_cost, total_cost, loss_reason, notes, created_by)
  values (v_item.id, v_item.material_id, p_work_order_id,
          case when p_discard then 'DESCARTE' else 'PERDA' end,
          v_item.quantity, v_item.area_m2, v_item.unit_cost, coalesce(v_item.unit_cost, 0),
          p_reason, p_notes, auth.uid());

  if p_work_order_id is not null then
    insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
    values (p_work_order_id, 'MATERIAL', 'Perda registrada',
            coalesce(v_item.code, 'Item') || ' - motivo: ' || p_reason, auth.uid());
  end if;

  return v_item;
end;
$fn$;

-- -------------------------------------------------------------------------
-- Recalculo de alertas automaticos
-- -------------------------------------------------------------------------
create or replace function public.refresh_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_count integer;
begin
  create temp table tmp_alerts (
    alert_key text primary key,
    alert_type text,
    severity text,
    title text,
    description text,
    entity_type text,
    entity_id uuid,
    href text
  ) on commit drop;

  -- OS atrasada
  insert into tmp_alerts
  select 'os_atrasada:' || wo.id, 'OS_ATRASADA', 'CRITICO',
         'OS ' || wo.number || ' atrasada',
         'Prazo venceu em ' || to_char(wo.deadline, 'DD/MM/YYYY') || ' - ' || c.name,
         'work_order', wo.id, '/os/' || wo.id
    from public.work_orders wo
    join public.customers c on c.id = wo.customer_id
   where wo.deadline < v_today
     and wo.finished_at is null and wo.cancelled_at is null
  on conflict do nothing;

  -- OS proxima do vencimento (3 dias)
  insert into tmp_alerts
  select 'os_vencendo:' || wo.id, 'OS_VENCENDO', 'ATENCAO',
         'OS ' || wo.number || ' vence em breve',
         'Prazo: ' || to_char(wo.deadline, 'DD/MM/YYYY') || ' - ' || c.name,
         'work_order', wo.id, '/os/' || wo.id
    from public.work_orders wo
    join public.customers c on c.id = wo.customer_id
   where wo.deadline between v_today and v_today + 3
     and wo.finished_at is null and wo.cancelled_at is null
  on conflict do nothing;

  -- OS parada ha mais de 7 dias
  insert into tmp_alerts
  select 'os_parada:' || wo.id, 'OS_PARADA', 'ATENCAO',
         'OS ' || wo.number || ' sem movimentacao',
         'Sem atualizacao desde ' || to_char(wo.updated_at, 'DD/MM/YYYY'),
         'work_order', wo.id, '/os/' || wo.id
    from public.work_orders wo
    join public.work_order_statuses s on s.code = wo.status_code
   where wo.updated_at < now() - interval '7 days'
     and wo.finished_at is null and wo.cancelled_at is null
     and not s.is_terminal
  on conflict do nothing;

  -- Estoque abaixo do minimo
  insert into tmp_alerts
  select 'estoque_minimo:' || m.id, 'ESTOQUE_MINIMO', 'ATENCAO',
         'Estoque baixo: ' || m.name,
         'Disponivel: ' || coalesce(sum(si.quantity) filter (where si.status = 'DISPONIVEL'), 0)
           || ' / minimo: ' || m.min_quantity,
         'material', m.id, '/estoque'
    from public.materials m
    left join public.stock_items si on si.material_id = m.id
   where m.active and m.min_quantity > 0
   group by m.id, m.name, m.min_quantity
  having coalesce(sum(si.quantity) filter (where si.status = 'DISPONIVEL'), 0) < m.min_quantity
  on conflict do nothing;

  -- Pagamento vencido
  insert into tmp_alerts
  select 'pagamento_vencido:' || t.id, 'PAGAMENTO_VENCIDO', 'CRITICO',
         case when t.kind = 'RECEITA' then 'Recebimento vencido' else 'Pagamento vencido' end,
         t.description || ' - venceu em ' || to_char(t.due_date, 'DD/MM/YYYY'),
         'financial_transaction', t.id, '/financeiro'
    from public.financial_transactions t
   where t.status = 'PENDENTE' and t.due_date < v_today
  on conflict do nothing;

  -- Medicao pendente
  insert into tmp_alerts
  select 'medicao_pendente:' || m.id, 'MEDICAO_PENDENTE', 'ATENCAO',
         'Medicao pendente na OS ' || wo.number,
         case when m.scheduled_at is null then 'Sem data agendada'
              else 'Agendada para ' || to_char(m.scheduled_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') end,
         'measurement', m.id, '/os/' || wo.id
    from public.work_order_measurements m
    join public.work_orders wo on wo.id = m.work_order_id
   where m.status in ('PENDENTE','AGENDADA')
     and wo.cancelled_at is null
     and (m.scheduled_at is null or m.scheduled_at < now() + interval '2 days')
  on conflict do nothing;

  -- Instalacao sem equipe
  insert into tmp_alerts
  select 'instalacao_sem_equipe:' || i.id, 'INSTALACAO_SEM_EQUIPE', 'ATENCAO',
         'Instalacao sem equipe na OS ' || wo.number,
         'Agendada para ' || to_char(i.scheduled_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
         'installation', i.id, '/os/' || wo.id
    from public.installations i
    join public.work_orders wo on wo.id = i.work_order_id
   where i.team_id is null
     and i.status in ('AGENDADA','REAGENDADA')
     and i.scheduled_at is not null
     and i.scheduled_at < now() + interval '3 days'
  on conflict do nothing;

  -- Plano de acao atrasado
  insert into tmp_alerts
  select 'plano_atrasado:' || ap.id, 'PLANO_ATRASADO', 'ATENCAO',
         'Plano de acao atrasado',
         ap.title || ' - prazo ' || to_char(ap.due_date, 'DD/MM/YYYY'),
         'action_plan', ap.id, '/planos-de-acao'
    from public.action_plans ap
   where ap.due_date < v_today and ap.status in ('ABERTO','EM_ANDAMENTO')
  on conflict do nothing;

  -- Sincroniza: remove automaticos que nao se aplicam mais
  delete from public.alerts a
   where a.auto and not exists (select 1 from tmp_alerts t where t.alert_key = a.alert_key);

  insert into public.alerts (alert_key, alert_type, severity, title, description, entity_type, entity_id, href, auto)
  select t.alert_key, t.alert_type, t.severity, t.title, t.description, t.entity_type, t.entity_id, t.href, true
    from tmp_alerts t
  on conflict (alert_key) do update
    set severity = excluded.severity,
        title = excluded.title,
        description = excluded.description,
        updated_at = now();

  select count(*) into v_count from public.alerts where dismissed_at is null;
  return v_count;
end;
$fn$;

comment on function public.refresh_alerts is
  'Recalcula os alertas automaticos. Chamado pelo dashboard e pela central de alertas.';

select public.attach_audit_trigger('financial_accounts');
select public.attach_audit_trigger('financial_categories');
select public.attach_audit_trigger('financial_transactions');
select public.attach_audit_trigger('action_plans');
