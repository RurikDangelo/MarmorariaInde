-- =========================================================================
-- 0016 - mensagens de erro e de timeline das funcoes de estoque e orcamento
--
-- Essas exceptions chegam ao usuario como toast na tela; precisam estar em
-- portugues correto e dizer o que fazer.
-- =========================================================================

create or replace function public.reserve_stock_item(
  p_stock_item_id uuid,
  p_work_order_id uuid,
  p_notes text default null
)
returns public.stock_items
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_item public.stock_items;
begin
  if not public.has_perm('stock.write') then
    raise exception 'Você não tem permissão para movimentar o estoque' using errcode = '42501';
  end if;

  select * into v_item from public.stock_items where id = p_stock_item_id for update;
  if not found then
    raise exception 'Item de estoque não encontrado';
  end if;
  if v_item.status <> 'DISPONIVEL' then
    raise exception 'O item % não está disponível (situação atual: %)',
      coalesce(v_item.code, v_item.id::text), initcap(v_item.status);
  end if;

  update public.stock_items
     set status = 'RESERVADA',
         reserved_work_order_id = p_work_order_id,
         updated_at = now()
   where id = p_stock_item_id
  returning * into v_item;

  insert into public.stock_movements
    (stock_item_id, material_id, work_order_id, movement_type, quantity, area_m2, unit_cost, total_cost, notes, created_by)
  values (v_item.id, v_item.material_id, p_work_order_id, 'RESERVA', v_item.quantity, v_item.area_m2,
          v_item.unit_cost, v_item.unit_cost, p_notes, auth.uid());

  insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
  values (p_work_order_id, 'MATERIAL', 'Material reservado',
          coalesce(v_item.code, 'Item') || ' reservado para esta OS.', auth.uid());

  return v_item;
end;
$fn$;

create or replace function public.release_stock_item(p_stock_item_id uuid, p_notes text default null)
returns public.stock_items
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_item public.stock_items;
  v_wo uuid;
begin
  if not public.has_perm('stock.write') then
    raise exception 'Você não tem permissão para movimentar o estoque' using errcode = '42501';
  end if;

  select * into v_item from public.stock_items where id = p_stock_item_id for update;
  if not found then
    raise exception 'Item de estoque não encontrado';
  end if;

  v_wo := v_item.reserved_work_order_id;

  update public.stock_items
     set status = 'DISPONIVEL', reserved_work_order_id = null, updated_at = now()
   where id = p_stock_item_id
  returning * into v_item;

  insert into public.stock_movements
    (stock_item_id, material_id, work_order_id, movement_type, quantity, area_m2, notes, created_by)
  values (v_item.id, v_item.material_id, v_wo, 'LIBERACAO', v_item.quantity, v_item.area_m2, p_notes, auth.uid());

  if v_wo is not null then
    insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
    values (v_wo, 'MATERIAL', 'Reserva liberada',
            coalesce(v_item.code, 'Item') || ' voltou para o estoque.', auth.uid());
  end if;

  return v_item;
end;
$fn$;

create or replace function public.consume_stock_item(
  p_stock_item_id uuid,
  p_work_order_id uuid,
  p_used_area_m2 numeric default null,
  p_remnant_length_mm integer default null,
  p_remnant_width_mm integer default null,
  p_notes text default null
)
returns public.stock_items
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_item public.stock_items;
  v_remnant_id uuid;
  v_remnant_code text;
  v_cost numeric(14,2);
begin
  if not public.has_perm('stock.write') then
    raise exception 'Você não tem permissão para movimentar o estoque' using errcode = '42501';
  end if;

  select * into v_item from public.stock_items where id = p_stock_item_id for update;
  if not found then
    raise exception 'Item de estoque não encontrado';
  end if;
  if v_item.status in ('CONSUMIDA','DESCARTADA') then
    raise exception 'Este item já teve baixa (situação: %)', initcap(v_item.status);
  end if;

  v_cost := coalesce(v_item.unit_cost, 0);

  update public.stock_items
     set status = 'CONSUMIDA',
         reserved_work_order_id = coalesce(p_work_order_id, reserved_work_order_id),
         updated_at = now()
   where id = p_stock_item_id
  returning * into v_item;

  insert into public.stock_movements
    (stock_item_id, material_id, work_order_id, movement_type, quantity, area_m2, unit_cost, total_cost, notes, created_by)
  values (v_item.id, v_item.material_id, p_work_order_id, 'CONSUMO', v_item.quantity,
          coalesce(p_used_area_m2, v_item.area_m2), v_item.unit_cost, v_cost, p_notes, auth.uid());

  -- sobra aproveitavel vira um novo item de estoque (retalho)
  if p_remnant_length_mm is not null and p_remnant_width_mm is not null
     and p_remnant_length_mm > 0 and p_remnant_width_mm > 0 then
    v_remnant_code := coalesce(v_item.code, 'CHAPA') || '-R' || substr(gen_random_uuid()::text, 1, 4);

    insert into public.stock_items
      (kind, code, material_id, location_id, supplier, batch, thickness_mm, length_mm, width_mm,
       is_remnant, parent_item_id, quantity, unit, unit_cost, status, notes, created_by, is_demo)
    values ('CHAPA', v_remnant_code,
            v_item.material_id, v_item.location_id, v_item.supplier, v_item.batch, v_item.thickness_mm,
            p_remnant_length_mm, p_remnant_width_mm, true, v_item.id, 1, v_item.unit, v_item.unit_cost,
            'DISPONIVEL', 'Retalho gerado da chapa ' || coalesce(v_item.code, v_item.id::text),
            auth.uid(), v_item.is_demo)
    returning id into v_remnant_id;

    insert into public.stock_movements
      (stock_item_id, material_id, work_order_id, movement_type, quantity, area_m2, unit_cost, notes, created_by)
    values (v_remnant_id, v_item.material_id, p_work_order_id, 'SOBRA', 1,
            round((p_remnant_length_mm::numeric / 1000) * (p_remnant_width_mm::numeric / 1000), 4),
            v_item.unit_cost, 'Retalho aproveitável', auth.uid());
  end if;

  if p_work_order_id is not null then
    insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
    values (p_work_order_id, 'MATERIAL', 'Material consumido',
            coalesce(v_item.code, 'Item') || ' baixado do estoque'
              || case when v_remnant_code is not null
                      then '. Sobra registrada como ' || v_remnant_code || '.'
                      else '.' end,
            auth.uid());
  end if;

  return v_item;
end;
$fn$;

create or replace function public.register_stock_loss(
  p_stock_item_id uuid,
  p_reason text,
  p_notes text default null,
  p_work_order_id uuid default null,
  p_discard boolean default false
)
returns public.stock_items
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_item public.stock_items;
  v_reason_label text;
begin
  if not public.has_perm('stock.write') then
    raise exception 'Você não tem permissão para movimentar o estoque' using errcode = '42501';
  end if;
  if p_reason is null then
    raise exception 'Informe o motivo da perda';
  end if;

  v_reason_label := case p_reason
    when 'QUEBRA'            then 'quebra'
    when 'ERRO_CORTE'        then 'erro de corte'
    when 'DEFEITO'           then 'defeito do material'
    when 'MEDICAO_INCORRETA' then 'medição incorreta'
    when 'TRANSPORTE'        then 'transporte'
    when 'RETRABALHO'        then 'retrabalho'
    else 'outro'
  end;

  select * into v_item from public.stock_items where id = p_stock_item_id for update;
  if not found then
    raise exception 'Item de estoque não encontrado';
  end if;

  update public.stock_items
     set status = case when p_discard then 'DESCARTADA' else 'DANIFICADA' end,
         updated_at = now()
   where id = p_stock_item_id
  returning * into v_item;

  insert into public.stock_movements
    (stock_item_id, material_id, work_order_id, movement_type, quantity, area_m2,
     unit_cost, total_cost, loss_reason, notes, created_by)
  values (v_item.id, v_item.material_id, p_work_order_id,
          case when p_discard then 'DESCARTE' else 'PERDA' end,
          v_item.quantity, v_item.area_m2, v_item.unit_cost, coalesce(v_item.unit_cost, 0),
          p_reason, p_notes, auth.uid());

  if p_work_order_id is not null then
    insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
    values (p_work_order_id, 'MATERIAL', 'Perda registrada',
            coalesce(v_item.code, 'Item') || ' — motivo: ' || v_reason_label
              || ' · custo ' || public.format_currency(v_item.unit_cost), auth.uid());
  end if;

  return v_item;
end;
$fn$;

-- --------------------------------------------- conversao de orcamento
create or replace function public.convert_quote_to_work_order(
  p_quote_id uuid,
  p_deadline date default null
)
returns public.work_orders
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_quote    public.quotes;
  v_customer public.customers;
  v_order    public.work_orders;
  v_count    integer;
begin
  if not public.has_perm('quotes.approve') then
    raise exception 'Você não tem permissão para aprovar orçamentos' using errcode = '42501';
  end if;

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Orçamento não encontrado';
  end if;
  if v_quote.status = 'APROVADO' then
    raise exception 'Este orçamento já foi aprovado';
  end if;
  if v_quote.status in ('CANCELADO', 'RECUSADO') then
    raise exception 'Orçamento % não pode ser aprovado', lower(v_quote.status);
  end if;

  select * into v_customer from public.customers where id = v_quote.customer_id;

  insert into public.work_orders (
    customer_id, quote_id, status_code, priority, deadline,
    zip_code, address, address_number, complement, district, city, state,
    discount, notes, created_by
  )
  values (
    v_quote.customer_id, v_quote.id,
    (select code from public.work_order_statuses where is_default order by sort_order limit 1),
    'NORMAL', p_deadline,
    v_customer.zip_code, v_customer.address, v_customer.address_number, v_customer.complement,
    v_customer.district, v_customer.city, v_customer.state,
    v_quote.discount, v_quote.notes, auth.uid()
  )
  returning * into v_order;

  insert into public.work_order_items (
    work_order_id, sort_order, description, environment, material_id, color, thickness_mm,
    length_mm, width_mm, quantity, pricing_mode, unit_price, finish, edge, notes, created_by
  )
  select
    v_order.id, qi.sort_order, qi.description, qi.environment, qi.material_id, qi.color, qi.thickness_mm,
    qi.length_mm, qi.width_mm, qi.quantity, qi.pricing_mode, qi.unit_price, qi.finish, qi.edge, qi.notes, auth.uid()
  from public.quote_items qi
  where qi.quote_id = v_quote.id;

  get diagnostics v_count = row_count;

  update public.quotes
     set status = 'APROVADO',
         approved_at = now(),
         approved_by = auth.uid()
   where id = v_quote.id;

  insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
  values (v_order.id, 'CRIACAO', 'Gerada a partir do orçamento',
          v_quote.number || ' aprovado com ' || v_count
            || case when v_count = 1 then ' item.' else ' itens.' end, auth.uid());

  select * into v_order from public.work_orders where id = v_order.id;
  return v_order;
end;
$fn$;
