-- =========================================================================
-- 0005 - medicao, producao, equipes e instalacao
-- =========================================================================

-- -------------------------------------------------------------------------
-- Equipes
-- -------------------------------------------------------------------------
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  kind       text not null default 'MISTA'
             check (kind in ('PRODUCAO','MEDICAO','INSTALACAO','MISTA')),
  leader_id  uuid references public.profiles(id) on delete set null,
  phone      text,
  notes      text,
  active     boolean not null default true,
  is_demo    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id)
);

comment on table public.teams is 'Equipes de producao, medicao e instalacao.';

create table if not exists public.team_members (
  team_id      uuid not null references public.teams(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  role_in_team text,
  created_at   timestamptz not null default now(),
  primary key (team_id, profile_id)
);

alter table public.work_orders
  drop constraint if exists work_orders_team_id_fkey;
alter table public.work_orders
  add constraint work_orders_team_id_fkey
  foreign key (team_id) references public.teams(id) on delete set null;

alter table public.stock_items
  drop constraint if exists stock_items_reserved_work_order_id_fkey;
alter table public.stock_items
  add constraint stock_items_reserved_work_order_id_fkey
  foreign key (reserved_work_order_id) references public.work_orders(id) on delete set null;

alter table public.stock_movements
  drop constraint if exists stock_movements_work_order_id_fkey;
alter table public.stock_movements
  add constraint stock_movements_work_order_id_fkey
  foreign key (work_order_id) references public.work_orders(id) on delete set null;

-- -------------------------------------------------------------------------
-- Medicao
-- -------------------------------------------------------------------------
create table if not exists public.work_order_measurements (
  id              uuid primary key default gen_random_uuid(),
  work_order_id   uuid not null references public.work_orders(id) on delete cascade,
  responsible_id  uuid references public.profiles(id) on delete set null,
  team_id         uuid references public.teams(id) on delete set null,
  scheduled_at    timestamptz,
  measured_at     timestamptz,
  status          text not null default 'PENDENTE'
                  check (status in ('PENDENTE','AGENDADA','REALIZADA','APROVADA','REPROVADA')),
  zip_code        text,
  address         text,
  address_number  text,
  complement      text,
  district        text,
  city            text,
  state           text,
  -- condicoes do local
  obstacles       text,
  hydraulics_notes text,
  electrical_notes text,
  wall_notes      text,
  notes           text,
  sketch_path     text,
  -- checklist (secao 15 do escopo)
  check_measures      boolean not null default false,
  check_square        boolean not null default false,
  check_level         boolean not null default false,
  check_wall          boolean not null default false,
  check_sink          boolean not null default false,
  check_cooktop       boolean not null default false,
  check_faucet        boolean not null default false,
  check_outlets       boolean not null default false,
  check_hydraulics    boolean not null default false,
  check_photos        boolean not null default false,
  customer_present    boolean not null default false,
  approved            boolean not null default false,
  approved_at         timestamptz,
  approved_by         uuid references public.profiles(id) on delete set null,
  rejected_reason     text,
  revision            integer not null default 1,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id),
  updated_by      uuid references public.profiles(id)
);

comment on table public.work_order_measurements is
  'Medicao em campo vinculada a OS, com checklist de conferencia e croqui.';

create index if not exists idx_measurements_wo on public.work_order_measurements(work_order_id);
create index if not exists idx_measurements_status on public.work_order_measurements(status);

create table if not exists public.work_order_measurement_items (
  id             uuid primary key default gen_random_uuid(),
  measurement_id uuid not null references public.work_order_measurements(id) on delete cascade,
  sort_order     integer not null default 0,
  environment    text,
  description    text not null,
  length_mm      integer not null default 0,
  width_mm       integer not null default 0,
  thickness_mm   integer,
  quantity       numeric(10,2) not null default 1 check (quantity > 0),
  area_m2        numeric(12,4) generated always as (
                   round((length_mm::numeric / 1000) * (width_mm::numeric / 1000) * quantity, 4)
                 ) stored,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles(id),
  updated_by     uuid references public.profiles(id)
);

create index if not exists idx_measurement_items_measurement
  on public.work_order_measurement_items(measurement_id);

-- Historico de alteracoes da medicao (exigencia da secao 15 do escopo).
create table if not exists public.work_order_measurement_history (
  id             uuid primary key default gen_random_uuid(),
  measurement_id uuid not null references public.work_order_measurements(id) on delete cascade,
  revision       integer not null,
  changed_fields jsonb not null,
  snapshot       jsonb,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.profiles(id)
);

create index if not exists idx_measurement_history_measurement
  on public.work_order_measurement_history(measurement_id, created_at desc);

create or replace function public.tg_measurement_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_changes jsonb := '{}'::jsonb;
begin
  if to_jsonb(new) - 'updated_at' - 'updated_by' - 'revision'
     = to_jsonb(old) - 'updated_at' - 'updated_by' - 'revision' then
    return new;
  end if;

  select coalesce(jsonb_object_agg(key, jsonb_build_object('de', old_row.value, 'para', new_row.value)), '{}'::jsonb)
    into v_changes
  from jsonb_each(to_jsonb(old)) old_row
  join jsonb_each(to_jsonb(new)) new_row using (key)
  where old_row.value is distinct from new_row.value
    and key not in ('updated_at','updated_by','revision');

  new.revision := old.revision + 1;

  insert into public.work_order_measurement_history
    (measurement_id, revision, changed_fields, snapshot, created_by)
  values (new.id, new.revision, v_changes, to_jsonb(new), auth.uid());

  insert into public.work_order_history
    (work_order_id, event_type, title, description, metadata, created_by)
  values (new.work_order_id, 'MEDICAO', 'Medicao atualizada',
          'Revisao ' || new.revision, v_changes, auth.uid());

  return new;
end;
$fn$;

drop trigger if exists trg_measurement_history on public.work_order_measurements;
create trigger trg_measurement_history before update on public.work_order_measurements
  for each row execute function public.tg_measurement_history();

create or replace function public.tg_measurement_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.work_order_history
    (work_order_id, event_type, title, description, created_by)
  values (new.work_order_id, 'MEDICAO', 'Medicao registrada',
          'Medicao criada para a OS.', auth.uid());
  return new;
end;
$fn$;

drop trigger if exists trg_measurement_created on public.work_order_measurements;
create trigger trg_measurement_created after insert on public.work_order_measurements
  for each row execute function public.tg_measurement_created();

-- -------------------------------------------------------------------------
-- Producao
-- -------------------------------------------------------------------------
create table if not exists public.production_steps (
  code       text primary key,
  label      text not null,
  sort_order integer not null default 0,
  active     boolean not null default true
);

comment on table public.production_steps is
  'Etapas de producao: separacao, corte, acabamento, colagem, polimento, conferencia, expedicao.';

create table if not exists public.production_records (
  id                 uuid primary key default gen_random_uuid(),
  work_order_id      uuid not null references public.work_orders(id) on delete cascade,
  work_order_item_id uuid references public.work_order_items(id) on delete set null,
  step_code          text not null references public.production_steps(code),
  responsible_id     uuid references public.profiles(id) on delete set null,
  team_id            uuid references public.teams(id) on delete set null,
  status             text not null default 'PENDENTE'
                     check (status in ('PENDENTE','EM_ANDAMENTO','PAUSADO','CONCLUIDO','RETRABALHO')),
  started_at         timestamptz,
  finished_at        timestamptz,
  duration_minutes   integer generated always as (
                       case when started_at is not null and finished_at is not null
                            then (extract(epoch from (finished_at - started_at)) / 60)::integer
                            else null end
                     ) stored,
  is_rework          boolean not null default false,
  rework_reason      text,
  notes              text,
  is_demo            boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references public.profiles(id),
  updated_by         uuid references public.profiles(id)
);

comment on table public.production_records is
  'Apontamento de producao por etapa, com responsavel, inicio, termino e retrabalho.';

create index if not exists idx_production_wo on public.production_records(work_order_id);
create index if not exists idx_production_step_status on public.production_records(step_code, status);

create or replace function public.tg_production_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_step text;
begin
  select label into v_step from public.production_steps where code = new.step_code;

  if tg_op = 'INSERT' then
    insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
    values (new.work_order_id, 'PRODUCAO', 'Etapa de producao iniciada', v_step, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.work_order_history (work_order_id, event_type, title, description, from_value, to_value, created_by)
    values (new.work_order_id, 'PRODUCAO', 'Etapa ' || coalesce(v_step, new.step_code),
            case when new.is_rework then 'Retrabalho: ' || coalesce(new.rework_reason, '') else null end,
            old.status, new.status, auth.uid());
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_production_history on public.production_records;
create trigger trg_production_history after insert or update on public.production_records
  for each row execute function public.tg_production_history();

-- -------------------------------------------------------------------------
-- Instalacao
-- -------------------------------------------------------------------------
create table if not exists public.installations (
  id              uuid primary key default gen_random_uuid(),
  work_order_id   uuid not null references public.work_orders(id) on delete cascade,
  team_id         uuid references public.teams(id) on delete set null,
  responsible_id  uuid references public.profiles(id) on delete set null,
  scheduled_at    timestamptz,
  started_at      timestamptz,
  finished_at     timestamptz,
  status          text not null default 'AGENDADA'
                  check (status in ('AGENDADA','EM_ANDAMENTO','CONCLUIDA','REAGENDADA','CANCELADA')),
  zip_code        text,
  address         text,
  address_number  text,
  complement      text,
  district        text,
  city            text,
  state           text,
  notes           text,
  -- checklist (secao 22 do escopo)
  check_material      boolean not null default false,
  check_pieces        boolean not null default false,
  check_measures      boolean not null default false,
  check_site_ready    boolean not null default false,
  check_installed     boolean not null default false,
  check_finish        boolean not null default false,
  check_photos        boolean not null default false,
  customer_present    boolean not null default false,
  approved            boolean not null default false,
  approved_at         timestamptz,
  approved_by         uuid references public.profiles(id) on delete set null,
  reschedule_reason   text,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id),
  updated_by      uuid references public.profiles(id)
);

comment on table public.installations is
  'Instalacao em obra: equipe, checklist, fotos antes/depois e aprovacao do cliente.';

create index if not exists idx_installations_wo on public.installations(work_order_id);
create index if not exists idx_installations_status on public.installations(status);
create index if not exists idx_installations_scheduled on public.installations(scheduled_at);

create or replace function public.tg_installation_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' then
    insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
    values (new.work_order_id, 'INSTALACAO', 'Instalacao agendada',
            to_char(new.scheduled_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.work_order_history (work_order_id, event_type, title, from_value, to_value, created_by)
    values (new.work_order_id, 'INSTALACAO', 'Instalacao atualizada', old.status, new.status, auth.uid());
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_installation_history on public.installations;
create trigger trg_installation_history after insert or update on public.installations
  for each row execute function public.tg_installation_history();

select public.attach_audit_trigger('teams');
select public.attach_audit_trigger('work_order_measurements');
select public.attach_audit_trigger('work_order_measurement_items');
select public.attach_audit_trigger('production_records');
select public.attach_audit_trigger('installations');
