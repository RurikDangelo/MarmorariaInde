-- =========================================================================
-- 0004_work_orders.sql - orcamentos, ordens de servico, itens e historico
-- O coracao do sistema.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Status de OS (colunas do Kanban sao DADOS, nao codigo)
-- -------------------------------------------------------------------------
create table if not exists public.work_order_statuses (
  code        text primary key,
  label       text not null,
  description text,
  color       text not null default 'muted',
  sort_order  integer not null default 0,
  is_default  boolean not null default false,
  is_terminal boolean not null default false,
  kanban      boolean not null default true
);

comment on table public.work_order_statuses is
  'Etapas do fluxo da OS. Alimenta o Kanban e a timeline.';

-- -------------------------------------------------------------------------
-- Orcamentos
-- -------------------------------------------------------------------------
create table if not exists public.quotes (
  id           uuid primary key default gen_random_uuid(),
  number       text unique,
  customer_id  uuid not null references public.customers(id) on delete restrict,
  status       text not null default 'RASCUNHO'
               check (status in ('RASCUNHO','ENVIADO','APROVADO','RECUSADO','EXPIRADO','CANCELADO')),
  issue_date   date not null default (now() at time zone 'America/Sao_Paulo')::date,
  valid_until  date,
  subtotal     numeric(14,2) not null default 0,
  discount     numeric(14,2) not null default 0,
  surcharge    numeric(14,2) not null default 0,
  total        numeric(14,2) not null default 0,
  notes        text,
  internal_notes text,
  approved_at  timestamptz,
  approved_by  uuid references public.profiles(id),
  rejected_reason text,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles(id),
  updated_by   uuid references public.profiles(id)
);

comment on table public.quotes is 'Orcamento. Quando aprovado, gera a Ordem de Servico preservando os itens.';

create index if not exists idx_quotes_customer on public.quotes(customer_id);
create index if not exists idx_quotes_status on public.quotes(status);

create table if not exists public.quote_items (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references public.quotes(id) on delete cascade,
  sort_order   integer not null default 0,
  description  text not null,
  environment  text,
  material_id  uuid references public.materials(id) on delete set null,
  color        text,
  thickness_mm integer,
  length_mm    integer not null default 0,
  width_mm     integer not null default 0,
  quantity     numeric(10,2) not null default 1 check (quantity > 0),
  area_m2      numeric(12,4) generated always as (
                 round((length_mm::numeric / 1000) * (width_mm::numeric / 1000) * quantity, 4)
               ) stored,
  pricing_mode text not null default 'M2' check (pricing_mode in ('M2','ML','UN')),
  unit_price   numeric(14,2) not null default 0,
  total_price  numeric(14,2) generated always as (
                 case
                   when pricing_mode = 'M2'
                     then round(unit_price * round((length_mm::numeric / 1000) * (width_mm::numeric / 1000) * quantity, 4), 2)
                   when pricing_mode = 'ML'
                     then round(unit_price * round((length_mm::numeric / 1000) * quantity, 4), 2)
                   else round(unit_price * quantity, 2)
                 end
               ) stored,
  finish       text,
  edge         text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles(id),
  updated_by   uuid references public.profiles(id)
);

create index if not exists idx_quote_items_quote on public.quote_items(quote_id);

-- -------------------------------------------------------------------------
-- Ordem de Servico
-- -------------------------------------------------------------------------
create table if not exists public.work_orders (
  id              uuid primary key default gen_random_uuid(),
  number          text unique,
  customer_id     uuid not null references public.customers(id) on delete restrict,
  quote_id        uuid references public.quotes(id) on delete set null,
  status_code     text not null references public.work_order_statuses(code),
  priority        text not null default 'NORMAL'
                  check (priority in ('BAIXA','NORMAL','ALTA','URGENTE')),
  assigned_to     uuid references public.profiles(id) on delete set null,
  team_id         uuid,
  title           text,
  deadline        date,
  scheduled_measurement_at timestamptz,
  scheduled_install_at     timestamptz,
  -- endereco de execucao (pode diferir do cadastro do cliente)
  zip_code        text,
  address         text,
  address_number  text,
  complement      text,
  district        text,
  city            text,
  state           text,
  total_value     numeric(14,2) not null default 0,
  received_value  numeric(14,2) not null default 0,
  pending_value   numeric(14,2) generated always as (total_value - received_value) stored,
  discount        numeric(14,2) not null default 0,
  notes           text,
  internal_notes  text,
  started_at      timestamptz,
  finished_at     timestamptz,
  cancelled_at    timestamptz,
  cancel_reason   text,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id),
  updated_by      uuid references public.profiles(id)
);

comment on table public.work_orders is
  'Ordem de Servico: do orcamento aprovado ate a instalacao finalizada.';
comment on column public.work_orders.pending_value is 'Calculado: total_value - received_value.';

create index if not exists idx_work_orders_status on public.work_orders(status_code);
create index if not exists idx_work_orders_customer on public.work_orders(customer_id);
create index if not exists idx_work_orders_deadline on public.work_orders(deadline)
  where finished_at is null and cancelled_at is null;
create index if not exists idx_work_orders_assigned on public.work_orders(assigned_to);
create index if not exists idx_work_orders_number_trgm on public.work_orders using gin (number gin_trgm_ops);

-- -------------------------------------------------------------------------
-- Itens da OS (as pecas)
-- -------------------------------------------------------------------------
create table if not exists public.work_order_items (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  sort_order    integer not null default 0,
  description   text not null,
  environment   text,
  material_id   uuid references public.materials(id) on delete set null,
  color         text,
  thickness_mm  integer,
  length_mm     integer not null default 0,
  width_mm      integer not null default 0,
  quantity      numeric(10,2) not null default 1 check (quantity > 0),
  area_m2       numeric(12,4) generated always as (
                  round((length_mm::numeric / 1000) * (width_mm::numeric / 1000) * quantity, 4)
                ) stored,
  pricing_mode  text not null default 'M2' check (pricing_mode in ('M2','ML','UN')),
  unit_price    numeric(14,2) not null default 0,
  total_price   numeric(14,2) generated always as (
                  case
                    when pricing_mode = 'M2'
                      then round(unit_price * round((length_mm::numeric / 1000) * (width_mm::numeric / 1000) * quantity, 4), 2)
                    when pricing_mode = 'ML'
                      then round(unit_price * round((length_mm::numeric / 1000) * quantity, 4), 2)
                    else round(unit_price * quantity, 2)
                  end
                ) stored,
  -- beneficiamento
  finish        text,
  edge          text,
  skirt_mm      integer,
  backsplash_mm integer,
  cutouts       integer not null default 0,
  has_sink      boolean not null default false,
  sink_type     text,
  sink_quantity integer not null default 0,
  has_cooktop   boolean not null default false,
  cooktop_type  text,
  faucet_holes  integer not null default 0,
  outlet_holes  integer not null default 0,
  extra_holes   integer not null default 0,
  notes         text,
  production_status text not null default 'PENDENTE'
                check (production_status in ('PENDENTE','EM_PRODUCAO','PRONTO','INSTALADO','RETRABALHO')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id),
  updated_by    uuid references public.profiles(id)
);

comment on table public.work_order_items is
  'Peca da OS com medidas em milimetros, beneficiamento e recortes. m2 e valor sao calculados no banco.';

create index if not exists idx_wo_items_wo on public.work_order_items(work_order_id);

-- -------------------------------------------------------------------------
-- Anexos e fotos
-- -------------------------------------------------------------------------
create table if not exists public.work_order_photos (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  stage         text not null default 'GERAL'
                check (stage in ('GERAL','MEDICAO','PRODUCAO','CONFERENCIA','EXPEDICAO','INSTALACAO_ANTES','INSTALACAO_DEPOIS')),
  storage_path  text not null,
  caption       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id),
  updated_by    uuid references public.profiles(id)
);

create index if not exists idx_wo_photos_wo on public.work_order_photos(work_order_id);

create table if not exists public.work_order_attachments (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  file_name     text not null,
  storage_path  text not null,
  mime_type     text,
  size_bytes    bigint,
  kind          text not null default 'DOCUMENTO'
                check (kind in ('DOCUMENTO','CROQUI','PROJETO','COMPROVANTE','CONTRATO','OUTRO')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id),
  updated_by    uuid references public.profiles(id)
);

create index if not exists idx_wo_attachments_wo on public.work_order_attachments(work_order_id);

-- -------------------------------------------------------------------------
-- Historico / timeline
-- -------------------------------------------------------------------------
create table if not exists public.work_order_history (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  event_type    text not null,
  title         text not null,
  description   text,
  from_value    text,
  to_value      text,
  metadata      jsonb,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id)
);

comment on table public.work_order_history is
  'Timeline da OS: criacao, mudanca de status, medicao, producao, material, pagamento, anexos.';

create index if not exists idx_wo_history_wo on public.work_order_history(work_order_id, created_at desc);

-- -------------------------------------------------------------------------
-- Triggers: numeracao, totais e historico
-- -------------------------------------------------------------------------
create or replace function public.tg_work_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.number is null or new.number = '' then
    new.number := public.next_document_number('OS');
  end if;
  if new.status_code is null then
    select code into new.status_code from public.work_order_statuses
     where is_default order by sort_order limit 1;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_work_order_number on public.work_orders;
create trigger trg_work_order_number before insert on public.work_orders
  for each row execute function public.tg_work_order_number();

create or replace function public.tg_quote_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.number is null or new.number = '' then
    new.number := public.next_document_number('ORC');
  end if;
  if new.valid_until is null then
    select new.issue_date + (quote_validity_days || ' days')::interval
      into new.valid_until from public.company_settings where id;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_quote_number on public.quotes;
create trigger trg_quote_number before insert on public.quotes
  for each row execute function public.tg_quote_number();

-- Recalcula o total da OS a partir dos itens.
create or replace function public.tg_recalc_work_order_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid := coalesce(new.work_order_id, old.work_order_id);
begin
  update public.work_orders wo
     set total_value = coalesce((
           select sum(i.total_price) from public.work_order_items i where i.work_order_id = v_id
         ), 0) - wo.discount,
         updated_at = now()
   where wo.id = v_id;
  return null;
end;
$fn$;

drop trigger if exists trg_recalc_wo_total on public.work_order_items;
create trigger trg_recalc_wo_total
  after insert or update or delete on public.work_order_items
  for each row execute function public.tg_recalc_work_order_total();

-- Recalcula o total do orcamento a partir dos itens.
create or replace function public.tg_recalc_quote_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid := coalesce(new.quote_id, old.quote_id);
begin
  update public.quotes q
     set subtotal = coalesce((
           select sum(i.total_price) from public.quote_items i where i.quote_id = v_id
         ), 0),
         total = coalesce((
           select sum(i.total_price) from public.quote_items i where i.quote_id = v_id
         ), 0) - q.discount + q.surcharge,
         updated_at = now()
   where q.id = v_id;
  return null;
end;
$fn$;

drop trigger if exists trg_recalc_quote_total on public.quote_items;
create trigger trg_recalc_quote_total
  after insert or update or delete on public.quote_items
  for each row execute function public.tg_recalc_quote_total();

-- Timeline automatica da OS.
create or replace function public.tg_work_order_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_from text;
  v_to   text;
begin
  if tg_op = 'INSERT' then
    insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
    values (new.id, 'CRIACAO', 'OS criada',
            'Ordem de servico ' || new.number || ' criada.', auth.uid());
    return new;
  end if;

  if new.status_code is distinct from old.status_code then
    select label into v_from from public.work_order_statuses where code = old.status_code;
    select label into v_to   from public.work_order_statuses where code = new.status_code;
    insert into public.work_order_history (work_order_id, event_type, title, from_value, to_value, created_by)
    values (new.id, 'STATUS', 'Status alterado', v_from, v_to, auth.uid());
  end if;

  if new.priority is distinct from old.priority then
    insert into public.work_order_history (work_order_id, event_type, title, from_value, to_value, created_by)
    values (new.id, 'PRIORIDADE', 'Prioridade alterada', old.priority, new.priority, auth.uid());
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into public.work_order_history (work_order_id, event_type, title, from_value, to_value, created_by)
    values (new.id, 'RESPONSAVEL', 'Responsavel alterado',
            (select full_name from public.profiles where id = old.assigned_to),
            (select full_name from public.profiles where id = new.assigned_to), auth.uid());
  end if;

  if new.deadline is distinct from old.deadline then
    insert into public.work_order_history (work_order_id, event_type, title, from_value, to_value, created_by)
    values (new.id, 'PRAZO', 'Prazo alterado', old.deadline::text, new.deadline::text, auth.uid());
  end if;

  if new.total_value is distinct from old.total_value then
    insert into public.work_order_history (work_order_id, event_type, title, from_value, to_value, created_by)
    values (new.id, 'VALOR', 'Valor atualizado', old.total_value::text, new.total_value::text, auth.uid());
  end if;

  if new.cancelled_at is not null and old.cancelled_at is null then
    insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
    values (new.id, 'CANCELAMENTO', 'OS cancelada', new.cancel_reason, auth.uid());
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_wo_history on public.work_orders;
create trigger trg_wo_history after insert or update on public.work_orders
  for each row execute function public.tg_work_order_history();

select public.attach_audit_trigger('quotes');
select public.attach_audit_trigger('quote_items');
select public.attach_audit_trigger('work_orders');
select public.attach_audit_trigger('work_order_items');
select public.attach_audit_trigger('work_order_photos');
select public.attach_audit_trigger('work_order_attachments');
