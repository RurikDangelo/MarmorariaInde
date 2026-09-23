-- =========================================================================
-- 0027 — Excluir de vez e reativar documentos
--
-- Cancelar continua sendo o caminho normal (a OS some do Kanban e o histórico
-- fica). Esta migration acrescenta:
--
--   • excluir uma OS ou um orçamento do banco, com o que pendura neles
--     (ambientes, produtos, peças, anexos, medições, produção, instalações);
--   • reativar uma OS cancelada, devolvendo a etapa anterior ao cancelamento;
--   • permissão própria "Excluir orçamentos" (quotes.delete), espelhando a que
--     já existia para OS.
--
-- Trava o que não pode sumir sem querer:
--   • OS com dinheiro já recebido (lançamento PAGO) não é excluída;
--   • orçamento que já virou OS não é excluído (exclua a OS primeiro);
--   • títulos ainda não pagos vão junto; os pagos e os movimentos de estoque
--     ficam no financeiro/estoque sem o vínculo (a FK já era "set null");
--   • chapas reservadas para a OS voltam a ficar disponíveis;
--   • a exclusão fica em audit_logs com a linha inteira do documento e o motivo
--     informado na tela (o mesmo vale para os títulos e as chapas envolvidos).
--
-- As funções devolvem os arquivos que ficaram órfãos no Storage, para a tela
-- apagá-los depois (arquivo usado por outro documento não é apagado).
-- =========================================================================

-- ---------------------------------------------------------------- permissão
insert into public.permissions (code, resource, action, label)
values ('quotes.delete', 'quotes', 'delete', 'Excluir orçamentos')
on conflict (code) do update set label = excluded.label;

-- quem já podia excluir OS passa a poder excluir orçamento
insert into public.role_permissions (role, permission)
select role, 'quotes.delete' from public.role_permissions where permission = 'work_orders.delete'
on conflict do nothing;

drop policy if exists quotes_delete on public.quotes;
create policy quotes_delete on public.quotes
  for delete to authenticated using (public.has_perm('quotes.delete'));

-- ------------------------------------------------- motivo junto da auditoria
-- Mesmo gatilho de 0006, agora anexando o motivo informado na tela
-- (app.audit_note vale so dentro da transacao que o define).
create or replace function public.tg_write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_changes jsonb;
  v_id uuid;
  v_note text;
begin
  if tg_op = 'DELETE' then
    v_changes := to_jsonb(old);
    v_id := (to_jsonb(old)->>'id')::uuid;
  elsif tg_op = 'INSERT' then
    v_changes := to_jsonb(new);
    v_id := (to_jsonb(new)->>'id')::uuid;
  else
    select coalesce(jsonb_object_agg(key, jsonb_build_object('de', o.value, 'para', n.value)), '{}'::jsonb)
      into v_changes
      from jsonb_each(to_jsonb(old)) o
      join jsonb_each(to_jsonb(new)) n using (key)
     where o.value is distinct from n.value
       and key not in ('updated_at','updated_by');
    v_id := (to_jsonb(new)->>'id')::uuid;
    if v_changes = '{}'::jsonb then
      return coalesce(new, old);
    end if;
  end if;

  v_note := nullif(btrim(coalesce(current_setting('app.audit_note', true), '')), '');
  if v_note is not null then
    v_changes := v_changes || jsonb_build_object('motivo', v_note);
  end if;

  insert into public.audit_logs (table_name, record_id, action, actor_id, changes)
  values (tg_table_name, v_id, tg_op, auth.uid(), v_changes);

  return coalesce(new, old);
end;
$fn$;

-- ------------------------------------------------------ excluir ordem de serviço
create or replace function public.delete_work_order(p_work_order_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_number   text;
  v_paid     numeric;
  v_files    text[];
  v_sketches text[];
  v_result   jsonb;
begin
  if not public.has_perm('work_orders.delete') then
    raise exception 'Você não tem permissão para excluir ordens de serviço' using errcode = '42501';
  end if;

  select number into v_number from public.work_orders where id = p_work_order_id for update;

  if v_number is null then
    raise exception 'Ordem de serviço não encontrada';
  end if;

  -- dinheiro que ja entrou nao pode sumir do financeiro
  select coalesce(sum(amount), 0) into v_paid
    from public.financial_transactions
   where work_order_id = p_work_order_id and status = 'PAGO';

  if v_paid > 0 then
    raise exception 'A % tem % já baixado no financeiro. Cancele a OS ou remova os lançamentos antes de excluir.',
      v_number, public.format_currency(v_paid);
  end if;

  -- arquivos da OS (anexos, fotos e desenhos dos produtos)
  select coalesce(array_agg(path), '{}') into v_files from (
    select storage_path as path from public.work_order_attachments where work_order_id = p_work_order_id
    union
    select storage_path from public.work_order_photos where work_order_id = p_work_order_id
    union
    select drawing_path from public.line_items
     where work_order_id = p_work_order_id and drawing_path is not null
  ) t;

  select coalesce(array_agg(sketch_path), '{}') into v_sketches
    from public.work_order_measurements
   where work_order_id = p_work_order_id and sketch_path is not null;

  -- o gatilho de auditoria grava a linha inteira; aqui vai o porque
  perform set_config('app.audit_note', coalesce(p_reason, ''), true);

  -- chapas reservadas voltam para a prateleira
  update public.stock_items
     set status = 'DISPONIVEL', reserved_work_order_id = null
   where reserved_work_order_id = p_work_order_id and status = 'RESERVADA';

  -- titulos ainda nao pagos somem junto; os pagos ja foram barrados acima
  delete from public.financial_transactions where work_order_id = p_work_order_id;

  delete from public.work_orders where id = p_work_order_id;

  perform set_config('app.audit_note', '', true);

  -- arquivo que outro documento ainda usa nao pode ser apagado do Storage
  select jsonb_build_object(
    'number', v_number,
    'files', coalesce(jsonb_agg(jsonb_build_object('bucket', bucket, 'path', path)) filter (where path is not null), '[]'::jsonb)
  ) into v_result
    from (
      select 'os-arquivos' as bucket, p as path from unnest(v_files) p
       where not exists (select 1 from public.work_order_attachments where storage_path = p)
         and not exists (select 1 from public.work_order_photos where storage_path = p)
         and not exists (select 1 from public.quote_attachments where storage_path = p)
         and not exists (select 1 from public.line_items where drawing_path = p)
      union all
      select 'medicoes', p from unnest(v_sketches) p
       where not exists (select 1 from public.work_order_measurements where sketch_path = p)
    ) t;

  return v_result;
end;
$fn$;

comment on function public.delete_work_order is
  'Exclui a OS e tudo que pendura nela. Recusa se houver lancamento pago. Devolve os arquivos orfaos do Storage.';

revoke all on function public.delete_work_order(uuid, text) from public, anon;
grant execute on function public.delete_work_order(uuid, text) to authenticated;

-- ---------------------------------------------------------- excluir orçamento
create or replace function public.delete_quote(p_quote_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_number text;
  v_wo     text;
  v_files  text[];
  v_result jsonb;
begin
  if not public.has_perm('quotes.delete') then
    raise exception 'Você não tem permissão para excluir orçamentos' using errcode = '42501';
  end if;

  select number into v_number from public.quotes where id = p_quote_id for update;

  if v_number is null then
    raise exception 'Orçamento não encontrado';
  end if;

  select number into v_wo from public.work_orders where quote_id = p_quote_id limit 1;
  if v_wo is not null then
    raise exception 'O orçamento % já virou a %. Exclua a OS antes.', v_number, v_wo;
  end if;

  select coalesce(array_agg(path), '{}') into v_files from (
    select storage_path as path from public.quote_attachments where quote_id = p_quote_id
    union
    select drawing_path from public.line_items where quote_id = p_quote_id and drawing_path is not null
  ) t;

  -- o gatilho de auditoria grava a linha inteira; aqui vai o porque
  perform set_config('app.audit_note', coalesce(p_reason, ''), true);
  delete from public.quotes where id = p_quote_id;
  perform set_config('app.audit_note', '', true);

  select jsonb_build_object(
    'number', v_number,
    'files', coalesce(jsonb_agg(jsonb_build_object('bucket', 'os-arquivos', 'path', path)) filter (where path is not null), '[]'::jsonb)
  ) into v_result
    from unnest(v_files) path
   where not exists (select 1 from public.quote_attachments where storage_path = path)
     and not exists (select 1 from public.work_order_attachments where storage_path = path)
     and not exists (select 1 from public.work_order_photos where storage_path = path)
     and not exists (select 1 from public.line_items where drawing_path = path);

  return v_result;
end;
$fn$;

comment on function public.delete_quote is
  'Exclui o orcamento e a montagem dele. Recusa se ja tiver virado OS. Devolve os arquivos orfaos do Storage.';

revoke all on function public.delete_quote(uuid, text) from public, anon;
grant execute on function public.delete_quote(uuid, text) to authenticated;

-- ------------------------------------------------------------- reativar a OS
create or replace function public.reactivate_work_order(p_work_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_number    text;
  v_cancelled timestamptz;
  v_status    text;
begin
  if not public.has_perm('work_orders.write') then
    raise exception 'Você não tem permissão para reativar ordens de serviço' using errcode = '42501';
  end if;

  select number, cancelled_at into v_number, v_cancelled
    from public.work_orders where id = p_work_order_id for update;

  if v_number is null then
    raise exception 'Ordem de serviço não encontrada';
  end if;

  if v_cancelled is null then
    return (select status_code from public.work_orders where id = p_work_order_id);
  end if;

  -- etapa antes do cancelamento: a timeline guarda o rotulo de cada mudanca
  select s.code into v_status
    from public.work_order_history h
    join public.work_order_statuses s on s.label = h.from_value
   where h.work_order_id = p_work_order_id
     and h.event_type = 'STATUS'
     and h.to_value = (select label from public.work_order_statuses where code = 'CANCELADA')
     and s.code <> 'CANCELADA'
   order by h.created_at desc
   limit 1;

  v_status := coalesce(v_status, 'NOVA');

  update public.work_orders
     set cancelled_at = null,
         cancel_reason = null,
         status_code = v_status
   where id = p_work_order_id;

  insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
  values (p_work_order_id, 'REATIVACAO', 'OS reativada',
          'Cancelamento desfeito; a OS voltou para ' ||
            (select label from public.work_order_statuses where code = v_status) || '.',
          auth.uid());

  return v_status;
end;
$fn$;

comment on function public.reactivate_work_order is
  'Desfaz o cancelamento da OS e devolve a etapa que ela tinha antes.';

revoke all on function public.reactivate_work_order(uuid) from public, anon;
grant execute on function public.reactivate_work_order(uuid) to authenticated;
