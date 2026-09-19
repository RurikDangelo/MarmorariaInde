-- =========================================================================
-- 0012 - acentuacao correta nos textos de catalogo e ajuste dos alertas
--
-- Os catalogos foram semeados em ASCII. Como esses textos aparecem direto na
-- interface (colunas do Kanban, etapas de producao, papeis, categorias), eles
-- precisam sair em portugues correto.
-- =========================================================================

-- ---------------------------------------------------------------- papeis
update public.roles set label = 'Produção',   description = 'Apontamento de produção e acompanhamento das OS'   where code = 'PRODUCAO';
update public.roles set label = 'Medição',    description = 'Registro e conferência de medições em campo'        where code = 'MEDICAO';
update public.roles set label = 'Instalação', description = 'Execução e checklist de instalação'                 where code = 'INSTALACAO';
update public.roles set description = 'Acesso total ao sistema, inclusive usuários e configurações'              where code = 'ADMINISTRADOR';
update public.roles set description = 'Gestão operacional completa, sem administração de usuários'               where code = 'GESTOR';
update public.roles set description = 'Contas a pagar, a receber e fluxo de caixa'                               where code = 'FINANCEIRO';
update public.roles set description = 'Chapas, insumos, reservas, consumo e perdas'                              where code = 'ESTOQUE';
update public.roles set description = 'Consulta das informações operacionais'                                    where code = 'OPERACIONAL';

-- ------------------------------------------------------------ permissoes
update public.permissions set label = 'Ver orçamentos'                    where code = 'quotes.read';
update public.permissions set label = 'Criar e editar orçamentos'         where code = 'quotes.write';
update public.permissions set label = 'Aprovar orçamento e gerar OS'      where code = 'quotes.approve';
update public.permissions set label = 'Ver ordens de serviço'             where code = 'work_orders.read';
update public.permissions set label = 'Criar e editar ordens de serviço'  where code = 'work_orders.write';
update public.permissions set label = 'Excluir ordens de serviço'         where code = 'work_orders.delete';
update public.permissions set label = 'Ver medições'                      where code = 'measurements.read';
update public.permissions set label = 'Registrar e editar medições'       where code = 'measurements.write';
update public.permissions set label = 'Ver produção'                      where code = 'production.read';
update public.permissions set label = 'Apontar produção'                  where code = 'production.write';
update public.permissions set label = 'Ver instalações'                   where code = 'installations.read';
update public.permissions set label = 'Registrar instalações'             where code = 'installations.write';
update public.permissions set label = 'Ver usuários'                      where code = 'users.read';
update public.permissions set label = 'Gerenciar usuários e papéis'       where code = 'users.write';
update public.permissions set label = 'Ver configurações'                 where code = 'settings.read';
update public.permissions set label = 'Alterar configurações'             where code = 'settings.write';
update public.permissions set label = 'Ver planos de ação'                where code = 'action_plans.read';
update public.permissions set label = 'Gerenciar planos de ação'          where code = 'action_plans.write';
update public.permissions set label = 'Ver relatórios'                    where code = 'reports.read';
update public.permissions set label = 'Ver logs de auditoria'             where code = 'audit.read';

-- -------------------------------------------------------- etapas da OS
update public.work_order_statuses set label = 'Medição',              description = 'Aguardando ou em medição no cliente'    where code = 'MEDICAO';
update public.work_order_statuses set                                 description = 'Material a separar, reservar ou comprar' where code = 'AGUARDANDO_MATERIAL';
update public.work_order_statuses set                                 description = 'Chapa em corte'                          where code = 'CORTE';
update public.work_order_statuses set label = 'Conferência',          description = 'Conferência de qualidade das peças'      where code = 'CONFERENCIA';
update public.work_order_statuses set label = 'Expedição',            description = 'Peças separadas e carregadas'            where code = 'EXPEDICAO';
update public.work_order_statuses set label = 'Instalação',           description = 'Equipe em obra'                          where code = 'INSTALACAO';
update public.work_order_statuses set                                 description = 'Serviço concluído e aprovado'            where code = 'FINALIZADA';
update public.work_order_statuses set                                 description = 'OS criada, aguardando planejamento'      where code = 'NOVA';

-- --------------------------------------------------- etapas de producao
update public.production_steps set label = 'Separação de material' where code = 'SEPARACAO';
update public.production_steps set label = 'Conferência'           where code = 'CONFERENCIA';
update public.production_steps set label = 'Expedição'             where code = 'EXPEDICAO';

-- ------------------------------------------------- tipos de material
update public.material_types set label = 'Mármore'             where code = 'MARMORE';
update public.material_types set label = 'Superfície especial' where code = 'SUPERFICIE';
update public.material_types set label = 'Cola / adesivo'      where code = 'COLA';

-- ------------------------------------------------ categorias financeiras
update public.financial_categories set name = 'Venda de serviço'       where name = 'Venda de servico';
update public.financial_categories set name = 'Folha e mão de obra'    where name = 'Folha e mao de obra';
update public.financial_categories set name = 'Manutenção de máquinas' where name = 'Manutencao de maquinas';

-- --------------------------------------------------------- localizacoes
update public.stock_locations set name = 'Pátio de chapas'     where name = 'Patio de chapas';
update public.stock_locations set name = 'Galpão de produção'  where name = 'Galpao de producao';

-- =========================================================================
-- refresh_alerts: textos em portugues correto, sem "OS" duplicado no titulo
-- (o numero ja comeca com "OS-") e com quantidades formatadas de forma legivel.
-- =========================================================================
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
         'Disponível: ' || trim(to_char(coalesce(sum(si.quantity) filter (where si.status = 'DISPONIVEL'), 0), 'FM999999990.999'))
           || ' ' || m.unit
           || ' · mínimo: ' || trim(to_char(m.min_quantity, 'FM999999990.999')) || ' ' || m.unit,
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
           || ' · ' || to_char(t.amount, 'L999G999G990D00'),
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
