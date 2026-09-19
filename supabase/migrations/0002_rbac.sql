-- =========================================================================
-- 0002_rbac.sql - perfis, papeis, permissoes e configuracoes da empresa
-- =========================================================================

create table if not exists public.roles (
  code        text primary key,
  label       text not null,
  description text,
  sort_order  integer not null default 0,
  is_system   boolean not null default true
);

comment on table public.roles is 'Papeis de acesso (RBAC). ADMINISTRADOR tem acesso total.';

create table if not exists public.permissions (
  code        text primary key,
  resource    text not null,
  action      text not null,
  label       text not null,
  description text
);

comment on table public.permissions is 'Catalogo de permissoes no formato recurso.acao.';

create table if not exists public.role_permissions (
  role       text not null references public.roles(code) on delete cascade,
  permission text not null references public.permissions(code) on delete cascade,
  primary key (role, permission)
);

-- -------------------------------------------------------------------------
-- Perfis (espelha auth.users)
-- -------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text,
  phone       text,
  job_title   text,
  avatar_url  text,
  role        text not null default 'OPERACIONAL' references public.roles(code),
  active      boolean not null default true,
  is_demo     boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);

comment on table public.profiles is
  'Dados de aplicacao do usuario autenticado. O papel define as permissoes.';

create index if not exists idx_profiles_role on public.profiles(role) where active;

create or replace function public.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'OPERACIONAL')
  )
  on conflict (id) do nothing;
  return new;
end;
$fn$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_handle_new_user();

-- -------------------------------------------------------------------------
-- Funcoes de autorizacao - base de TODAS as policies de RLS
-- -------------------------------------------------------------------------
create or replace function public.current_role_code()
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select p.role from public.profiles p where p.id = auth.uid() and p.active;
$fn$;

comment on function public.current_role_code is
  'Papel do usuario autenticado (null se inativo ou anonimo).';

create or replace function public.has_perm(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role = p.role
    where p.id = auth.uid()
      and p.active
      and rp.permission = p_permission
  );
$fn$;

comment on function public.has_perm is
  'Verificacao de permissao no banco. Base de toda policy de RLS.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(public.current_role_code() = 'ADMINISTRADOR', false);
$fn$;

create or replace function public.my_permissions()
returns setof text
language sql
stable
security definer
set search_path = public
as $fn$
  select rp.permission
  from public.profiles p
  join public.role_permissions rp on rp.role = p.role
  where p.id = auth.uid() and p.active;
$fn$;

-- -------------------------------------------------------------------------
-- Configuracoes da empresa (singleton) - identidade visual e operacao
-- -------------------------------------------------------------------------
create table if not exists public.company_settings (
  id                  boolean primary key default true check (id),
  company_name        text not null default 'MARMORARIA INDEPENDENCIA',
  legal_name          text,
  document            text,
  phone               text,
  whatsapp            text,
  email               text,
  address             text,
  city                text default 'Sao Jose dos Campos',
  state               text default 'SP',
  logo_url            text,
  favicon_url         text,
  primary_color       text not null default '#B4703B',
  secondary_color     text not null default '#2F3437',
  accent_color        text not null default '#3E7C8C',
  default_theme       text not null default 'system'
                      check (default_theme in ('light','dark','system')),
  quote_validity_days integer not null default 15,
  default_waste_pct   numeric(5,2) not null default 10.00,
  low_stock_alert     boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid,
  updated_by          uuid
);

comment on table public.company_settings is
  'Configuracao unica da empresa: identidade visual e parametros operacionais.';

insert into public.company_settings (id) values (true) on conflict (id) do nothing;

select public.attach_audit_trigger('profiles');
select public.attach_audit_trigger('company_settings');
