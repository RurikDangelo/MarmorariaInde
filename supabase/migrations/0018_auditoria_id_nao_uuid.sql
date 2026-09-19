-- =========================================================================
-- 0018 - auditoria nao pode assumir que todo id e uuid
--
-- BUG EM PRODUCAO: salvar as cores da empresa falhava com
--     invalid input syntax for type uuid: "true"
--
-- tg_write_audit_log fazia (to_jsonb(new)->>'id')::uuid em qualquer tabela.
-- company_settings e um singleton com "id boolean primary key default true",
-- entao o cast tentava converter 'true' em uuid e derrubava o UPDATE inteiro
-- — o trigger e AFTER, mas a exception aborta a transacao do mesmo jeito.
--
-- Agora o cast e tolerante: id que nao for uuid entra como null em record_id
-- (a linha continua identificavel pelo snapshot em changes).
-- =========================================================================

create or replace function public.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
as $fn$
begin
  return p_value::uuid;
exception
  when others then
    return null;
end;
$fn$;

comment on function public.try_uuid is
  'Cast tolerante para uuid: devolve null em vez de erro quando o texto nao e um uuid.';

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
    v_id := public.try_uuid(to_jsonb(old)->>'id');
  elsif tg_op = 'INSERT' then
    v_changes := to_jsonb(new);
    v_id := public.try_uuid(to_jsonb(new)->>'id');
  else
    select coalesce(jsonb_object_agg(key, jsonb_build_object('de', o.value, 'para', n.value)), '{}'::jsonb)
      into v_changes
      from jsonb_each(to_jsonb(old)) o
      join jsonb_each(to_jsonb(new)) n using (key)
     where o.value is distinct from n.value
       and key not in ('updated_at','updated_by');
    v_id := public.try_uuid(to_jsonb(new)->>'id');
    if v_changes = '{}'::jsonb then
      return coalesce(new, old);
    end if;
  end if;

  insert into public.audit_logs (table_name, record_id, action, actor_id, changes)
  values (tg_table_name, v_id, tg_op, auth.uid(), v_changes);

  return coalesce(new, old);
end;
$fn$;
