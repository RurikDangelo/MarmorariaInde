-- =========================================================================
-- 0015 - textos de trigger e de erro em portugues correto
--
-- As mensagens escritas pelos triggers aparecem na timeline da OS e as
-- exceptions viram toast na tela. Todas estavam em ASCII. Alem disso, a
-- mudanca de valor gravava o numero cru ("3016.00"); agora grava moeda.
-- =========================================================================

create or replace function public.format_currency(p_value numeric)
returns text
language sql
immutable
as $fn$
  select 'R$ ' || translate(trim(to_char(coalesce(p_value, 0), 'FM999,999,999,990.00')), ',.', '.,');
$fn$;

comment on function public.format_currency is
  'Moeda em pt-BR: 5626 -> "R$ 5.626,00".';

-- -------------------------------------------------------- timeline da OS
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
            'Ordem de serviço ' || new.number || ' criada.', auth.uid());
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
    values (new.id, 'PRIORIDADE', 'Prioridade alterada', initcap(old.priority), initcap(new.priority), auth.uid());
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into public.work_order_history (work_order_id, event_type, title, from_value, to_value, created_by)
    values (new.id, 'RESPONSAVEL', 'Responsável alterado',
            coalesce((select full_name from public.profiles where id = old.assigned_to), 'sem responsável'),
            coalesce((select full_name from public.profiles where id = new.assigned_to), 'sem responsável'),
            auth.uid());
  end if;

  if new.deadline is distinct from old.deadline then
    insert into public.work_order_history (work_order_id, event_type, title, from_value, to_value, created_by)
    values (new.id, 'PRAZO', 'Prazo alterado',
            coalesce(to_char(old.deadline, 'DD/MM/YYYY'), 'sem prazo'),
            coalesce(to_char(new.deadline, 'DD/MM/YYYY'), 'sem prazo'), auth.uid());
  end if;

  if new.total_value is distinct from old.total_value then
    insert into public.work_order_history (work_order_id, event_type, title, from_value, to_value, created_by)
    values (new.id, 'VALOR', 'Valor atualizado',
            public.format_currency(old.total_value), public.format_currency(new.total_value), auth.uid());
  end if;

  if new.cancelled_at is not null and old.cancelled_at is null then
    insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
    values (new.id, 'CANCELAMENTO', 'OS cancelada', new.cancel_reason, auth.uid());
  end if;

  return new;
end;
$fn$;

-- ------------------------------------------------------------- medicao
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
  values (new.work_order_id, 'MEDICAO', 'Medição atualizada',
          'Revisão ' || new.revision, v_changes, auth.uid());

  return new;
end;
$fn$;

create or replace function public.tg_measurement_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.work_order_history
    (work_order_id, event_type, title, description, created_by)
  values (new.work_order_id, 'MEDICAO', 'Medição registrada',
          'Medição criada para a OS.', auth.uid());
  return new;
end;
$fn$;

-- ------------------------------------------------------------ producao
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
    values (new.work_order_id, 'PRODUCAO', 'Etapa de produção iniciada', v_step, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.work_order_history (work_order_id, event_type, title, description, from_value, to_value, created_by)
    values (new.work_order_id, 'PRODUCAO', 'Etapa · ' || coalesce(v_step, new.step_code),
            case when new.is_rework then 'Retrabalho: ' || coalesce(new.rework_reason, '') else null end,
            initcap(replace(old.status, '_', ' ')), initcap(replace(new.status, '_', ' ')), auth.uid());
  end if;
  return new;
end;
$fn$;

-- ---------------------------------------------------------- instalacao
create or replace function public.tg_installation_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' then
    insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
    values (new.work_order_id, 'INSTALACAO', 'Instalação agendada',
            coalesce(to_char(new.scheduled_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
                     'sem data definida'), auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.work_order_history (work_order_id, event_type, title, from_value, to_value, created_by)
    values (new.work_order_id, 'INSTALACAO', 'Instalação atualizada',
            initcap(replace(old.status, '_', ' ')), initcap(replace(new.status, '_', ' ')), auth.uid());
  end if;
  return new;
end;
$fn$;

-- ---------------------------------------------------------- financeiro
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
    values (v_wo, 'PAGAMENTO', 'Pagamento recebido', new.description,
            public.format_currency(new.amount), auth.uid());
  end if;

  return null;
end;
$fn$;

-- ------------------------------------------- protecao de papel (mensagem)
create or replace function public.tg_protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active)
     and not public.has_perm('users.write') then
    raise exception 'Somente administradores podem alterar o papel ou a situação do usuário'
      using errcode = '42501';
  end if;
  return new;
end;
$fn$;
