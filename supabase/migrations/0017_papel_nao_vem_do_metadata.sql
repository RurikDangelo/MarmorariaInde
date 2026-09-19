-- =========================================================================
-- 0017 - o papel do usuario NAO pode vir do metadata do Auth
--
-- A versao anterior fazia:
--     coalesce(new.raw_user_meta_data->>'role', ...)
--
-- raw_user_meta_data e controlado por quem chama signUp(). Enquanto o
-- autocadastro estava desligado isso era inofensivo, mas basta liga-lo para
-- que qualquer pessoa consiga criar a propria conta como ADMINISTRADOR:
--
--     supabase.auth.signUp({ email, password,
--       options: { data: { role: 'ADMINISTRADOR' } } })
--
-- Agora todo usuario nasce OPERACIONAL (exceto o primeiro do sistema, que
-- precisa ser administrador para conseguir configurar o resto). Elevar o
-- papel passa obrigatoriamente por quem tem users.write, sob RLS e sob o
-- trigger tg_protect_profile_role.
-- =========================================================================

create or replace function public.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_is_first boolean;
begin
  select not exists (select 1 from public.profiles) into v_is_first;

  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    -- o nome pode vir do metadata: e apenas identificacao, nao da privilegio
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.email,
    case when v_is_first then 'ADMINISTRADOR' else 'OPERACIONAL' end
  )
  on conflict (id) do nothing;

  return new;
end;
$fn$;

comment on function public.tg_handle_new_user is
  'Cria o profile ao nascer o usuario no Auth. O primeiro usuario do sistema vira '
  'ADMINISTRADOR; os demais entram como OPERACIONAL. O papel nunca vem do metadata.';
