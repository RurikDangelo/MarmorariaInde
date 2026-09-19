-- =========================================================================
-- 0011 - bootstrap do primeiro administrador e RLS na tabela de controle
-- =========================================================================

-- O primeiro usuario criado no Auth vira ADMINISTRADOR; os demais entram
-- como OPERACIONAL ate um administrador ajustar o papel.
create or replace function public.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_is_first boolean;
  v_role     text;
begin
  select not exists (select 1 from public.profiles) into v_is_first;

  v_role := coalesce(new.raw_user_meta_data->>'role', case when v_is_first then 'ADMINISTRADOR' else 'OPERACIONAL' end);

  if not exists (select 1 from public.roles where code = v_role) then
    v_role := 'OPERACIONAL';
  end if;

  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.email,
    v_role
  )
  on conflict (id) do nothing;

  return new;
end;
$fn$;

comment on function public.tg_handle_new_user is
  'Cria o profile ao nascer o usuario no Auth. O primeiro usuario do sistema vira ADMINISTRADOR.';

-- Tabela de controle de migrations: ninguem acessa pela API.
create table if not exists public.schema_migrations (
  version    text primary key,
  applied_at timestamptz not null default now()
);

alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
