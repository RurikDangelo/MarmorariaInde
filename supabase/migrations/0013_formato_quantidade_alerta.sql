-- =========================================================================
-- 0013 - formatacao de quantidade nos alertas
--
-- to_char(5.000, 'FM999999990.999') devolve "5." — o FM tira os zeros mas
-- deixa o separador decimal orfao. O alerta de estoque saia como
-- "Disponível: 5. UN · mínimo: 8. UN". Helper dedicado resolve.
-- =========================================================================

create or replace function public.format_quantity(p_value numeric)
returns text
language sql
immutable
as $fn$
  select case
           when p_value is null then '0'
           when p_value = trunc(p_value) then trim(to_char(p_value, 'FM999G999G990'))
           else trim(to_char(p_value, 'FM999G999G990D999'))
         end;
$fn$;

comment on function public.format_quantity is
  'Quantidade legivel em pt-BR: 5 -> "5", 5.5 -> "5,5", 1250 -> "1.250".';

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
         wo.number || ' atrasada',
         'Prazo venceu em ' || to_char(wo.deadline, 'DD/MM/YYYY') || ' · ' || c.name,
         'work_order', wo.id, '/os/' || wo.id
    from public.work_orders wo
    join public.customers c on c.id = wo.customer_id
   where wo.deadline < v_today
     and wo.finished_at is null and wo.cancelled_at is null
  on conflict do nothing;

  -- OS proxima do vencimento (3 dias)
  insert into tmp_alerts
  select 'os_vencendo:' || wo.id, 'OS_VENCENDO', 'ATENCAO',
         wo.number || ' vence em breve',
         'Prazo: ' || to_char(wo.deadline, 'DD/MM/YYYY') || ' · ' || c.name,
         'work_order', wo.id, '/os/' || wo.id
    from public.work_orders wo
    join public.customers c on c.id = wo.customer_id
   where wo.deadline between v_today and v_today + 3
     and wo.finished_at is null and wo.cancelled_at is null
  on conflict do nothing;

  -- OS parada ha mais de 7 dias
  insert into tmp_alerts
  select 'os_parada:' || wo.id, 'OS_PARADA', 'ATENCAO',
         wo.number || ' sem movimentação',
         'Sem atualização desde ' || to_char(wo.updated_at, 'DD/MM/YYYY'),
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
         'Disponível: '
           || public.format_quantity(coalesce(sum(si.quantity) filter (where si.status = 'DISPONIVEL'), 0))
           || ' ' || m.unit
           || ' · mínimo: ' || public.format_quantity(m.min_quantity) || ' ' || m.unit,
         'material', m.id, '/estoque'
    from public.materials m
    left join public.stock_items si on si.material_id = m.id
   where m.active and m.min_quantity > 0
   group by m.id, m.name, m.min_quantity, m.unit
  having coalesce(sum(si.quantity) filter (where si.status = 'DISPONIVEL'), 0) < m.min_quantity
  on conflict do nothing;

  -- Pagamento vencido
  insert into tmp_alerts
  select 'pagamento_vencido:' || t.id, 'PAGAMENTO_VENCIDO', 'CRITICO',
         case when t.kind = 'RECEITA' then 'Recebimento vencido' else 'Pagamento vencido' end,
         t.description || ' · venceu em ' || to_char(t.due_date, 'DD/MM/YYYY')
           || ' · R$ ' || trim(to_char(t.amount, 'FM999G999G990D00')),
         'financial_transaction', t.id, '/financeiro'
    from public.financial_transactions t
   where t.status = 'PENDENTE' and t.due_date < v_today
  on conflict do nothing;

  -- Medicao pendente
  insert into tmp_alerts
  select 'medicao_pendente:' || m.id, 'MEDICAO_PENDENTE', 'ATENCAO',
         'Medição pendente na ' || wo.number,
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
         'Instalação sem equipe na ' || wo.number,
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
         'Plano de ação atrasado',
         ap.title || ' · prazo ' || to_char(ap.due_date, 'DD/MM/YYYY'),
         'action_plan', ap.id, '/planos-de-acao'
    from public.action_plans ap
   where ap.due_date < v_today and ap.status in ('ABERTO','EM_ANDAMENTO')
  on conflict do nothing;

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
