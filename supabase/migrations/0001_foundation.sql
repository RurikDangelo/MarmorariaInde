-- =========================================================================
-- 0001_foundation.sql - extensoes, helpers de auditoria e numeracao
-- =========================================================================
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- -------------------------------------------------------------------------
-- updated_at + created_by/updated_by automaticos
-- -------------------------------------------------------------------------
create or replace function public.tg_set_audit_fields()
returns trigger
language plpgsql
as $fn$
begin
  if (tg_op = 'INSERT') then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$fn$;

comment on function public.tg_set_audit_fields is
  'Preenche created_at/created_by/updated_at/updated_by automaticamente.';

-- Aplica o trigger de auditoria em uma tabela (usado pelas migrations seguintes).
create or replace function public.attach_audit_trigger(p_table text)
returns void
language plpgsql
as $fn$
begin
  execute format(
    'drop trigger if exists trg_audit_fields on public.%I', p_table);
  execute format(
    'create trigger trg_audit_fields before insert or update on public.%I '
    'for each row execute function public.tg_set_audit_fields()', p_table);
end;
$fn$;

-- -------------------------------------------------------------------------
-- Numeracao de documentos (OS-2026-0001, ORC-2026-0001) com reset anual
-- -------------------------------------------------------------------------
create table if not exists public.document_counters (
  prefix      text    not null,
  year        integer not null,
  last_number integer not null default 0,
  primary key (prefix, year)
);

comment on table public.document_counters is
  'Contador sequencial por prefixo e ano para numeracao de documentos.';

create or replace function public.next_document_number(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_year integer := extract(year from (now() at time zone 'America/Sao_Paulo'));
  v_next integer;
begin
  insert into public.document_counters as dc (prefix, year, last_number)
  values (p_prefix, v_year, 1)
  on conflict (prefix, year) do update set last_number = dc.last_number + 1
  returning dc.last_number into v_next;

  return p_prefix || '-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
end;
$fn$;
