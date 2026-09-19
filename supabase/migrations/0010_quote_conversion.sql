-- =========================================================================
-- 0010 - conversao atomica de orcamento aprovado em Ordem de Servico
-- =========================================================================

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
    raise exception 'Sem permissao para aprovar orcamento' using errcode = '42501';
  end if;

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Orcamento nao encontrado';
  end if;
  if v_quote.status = 'APROVADO' then
    raise exception 'Este orcamento ja foi aprovado';
  end if;
  if v_quote.status in ('CANCELADO', 'RECUSADO') then
    raise exception 'Orcamento % nao pode ser aprovado', v_quote.status;
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

  -- Preserva os itens do orcamento como pecas da OS.
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
  values (v_order.id, 'CRIACAO', 'Gerada a partir do orcamento',
          v_quote.number || ' aprovado com ' || v_count || ' item(ns).', auth.uid());

  -- Recarrega para devolver os totais ja recalculados pelos triggers.
  select * into v_order from public.work_orders where id = v_order.id;
  return v_order;
end;
$fn$;

comment on function public.convert_quote_to_work_order is
  'Aprova o orcamento e cria a OS preservando os itens. Exige a permissao quotes.approve.';
