-- =========================================================================
-- 0025 - aprovacao do orcamento com a montagem completa, contas a receber,
--        RT no financeiro e producao por peca
-- =========================================================================

-- -------------------------------------------------------------------------
-- approve_quote: aprova e cria a OS copiando TUDO (ambientes, produtos,
-- materiais, pecas, composicao, RT e anexos). Opcionalmente transforma a
-- fatura em contas a receber da OS. Confere que o total da OS saiu igual ao
-- do orcamento; se nao sair, nada e gravado.
-- -------------------------------------------------------------------------
create or replace function public.approve_quote(
  p_quote_id uuid,
  p_deadline date default null,
  p_generate_receivables boolean default false
)
returns public.work_orders
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_quote        public.quotes;
  v_customer     public.customers;
  v_order        public.work_orders;
  v_count        integer;
  v_item         uuid;
  v_sum          numeric;
  v_installments integer := 0;
  v_category     uuid;
  v_tx           uuid;
  v_title        text;
  r              record;
begin
  if not public.has_perm('quotes.approve') then
    raise exception 'Você não tem permissão para aprovar orçamentos' using errcode = '42501';
  end if;
  if p_generate_receivables and not public.has_perm('financial.write') then
    raise exception 'Você não tem permissão para lançar contas a receber. Aprove sem gerar as parcelas.'
      using errcode = '42501';
  end if;

  perform public.migrate_document(p_quote_id, null);

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

  if p_generate_receivables then
    select coalesce(sum(amount), 0), count(*) into v_sum, v_installments
      from public.quote_installments where quote_id = p_quote_id;
    if v_installments = 0 then
      raise exception 'Monte a fatura (parcelas) antes de gerar as contas a receber.';
    end if;
    if v_sum <> v_quote.total then
      raise exception 'A soma das parcelas (%) é diferente do total do orçamento (%). Ajuste a fatura.',
        public.format_currency(v_sum), public.format_currency(v_quote.total);
    end if;
  end if;

  select * into v_customer from public.customers where id = v_quote.customer_id;

  select left(string_agg(name, ' · ' order by number), 120) into v_title
    from public.environments where quote_id = p_quote_id;

  perform set_config('app.system_write', 'on', true);
  perform set_config('app.bulk_recalc', 'on', true);

  insert into public.work_orders (
    customer_id, quote_id, status_code, priority, title, deadline,
    zip_code, address, address_number, complement, district, city, state,
    products_total, discount, freight, surcharge, notes, internal_notes,
    seller_id, site_details, payment_type, payment_method, payment_terms,
    items_model, is_demo, created_by
  )
  values (
    v_quote.customer_id, v_quote.id,
    (select code from public.work_order_statuses where is_default order by sort_order limit 1),
    'NORMAL', v_title, coalesce(p_deadline, v_quote.delivery_date),
    v_customer.zip_code, v_customer.address, v_customer.address_number, v_customer.complement,
    v_customer.district, v_customer.city, v_customer.state,
    -- ja nasce com o total do orcamento; o recalculo abaixo confere
    v_quote.subtotal, v_quote.discount, v_quote.freight, v_quote.surcharge, v_quote.notes, v_quote.internal_notes,
    v_quote.seller_id, v_quote.site_details, v_quote.payment_type, v_quote.payment_method, v_quote.payment_terms,
    2, v_quote.is_demo, auth.uid()
  )
  returning * into v_order;

  insert into public.environments (id, work_order_id, number, name, description, sort_order, is_demo)
  select public.derive_uuid(e.id, v_order.id), v_order.id, e.number, e.name, e.description, e.sort_order, e.is_demo
    from public.environments e
   where e.quote_id = p_quote_id;

  insert into public.line_items (
    id, work_order_id, environment_id, product_id, code, description, complement, quantity, unit,
    length_mm, width_mm, edge_mm, backsplash_mm, foot_mm, drawing_path, notes, sort_order, is_demo
  )
  select public.derive_uuid(li.id, v_order.id), v_order.id, public.derive_uuid(li.environment_id, v_order.id),
         li.product_id, li.code, li.description, li.complement, li.quantity, li.unit,
         li.length_mm, li.width_mm, li.edge_mm, li.backsplash_mm, li.foot_mm, li.drawing_path, li.notes,
         li.sort_order, li.is_demo
    from public.line_items li
   where li.quote_id = p_quote_id;

  get diagnostics v_count = row_count;

  insert into public.line_item_materials (
    id, line_item_id, material_id, code, description, thickness_mm, price_per_m2, price_overridden, sort_order
  )
  select public.derive_uuid(m.id, v_order.id), public.derive_uuid(m.line_item_id, v_order.id),
         m.material_id, m.code, m.description, m.thickness_mm, m.price_per_m2, m.price_overridden, m.sort_order
    from public.line_item_materials m
    join public.line_items li on li.id = m.line_item_id
   where li.quote_id = p_quote_id;

  insert into public.line_item_pieces (
    id, line_item_id, line_item_material_id, number, name, quantity, length_mm, width_mm,
    waste_pct, label_count, specs, sort_order
  )
  select public.derive_uuid(p.id, v_order.id), public.derive_uuid(p.line_item_id, v_order.id),
         case when p.line_item_material_id is null then null
              else public.derive_uuid(p.line_item_material_id, v_order.id) end,
         p.number, p.name, p.quantity, p.length_mm, p.width_mm, p.waste_pct, p.label_count, p.specs, p.sort_order
    from public.line_item_pieces p
    join public.line_items li on li.id = p.line_item_id
   where li.quote_id = p_quote_id;

  insert into public.line_item_components (
    id, line_item_id, kind, product_id, code, description, unit, quantity, unit_price, price_overridden, notes, sort_order
  )
  select public.derive_uuid(c.id, v_order.id), public.derive_uuid(c.line_item_id, v_order.id),
         c.kind, c.product_id, c.code, c.description, c.unit, c.quantity, c.unit_price, c.price_overridden,
         c.notes, c.sort_order
    from public.line_item_components c
    join public.line_items li on li.id = c.line_item_id
   where li.quote_id = p_quote_id;

  insert into public.technical_reserves (
    work_order_id, professional_name, professional_phone, professional_document, pix_key,
    percentage, amount, notes, is_demo
  )
  select v_order.id, professional_name, professional_phone, professional_document, pix_key,
         percentage, amount, notes, is_demo
    from public.technical_reserves
   where quote_id = p_quote_id;

  insert into public.work_order_attachments (work_order_id, file_name, storage_path, mime_type, size_bytes, kind)
  select v_order.id, file_name, storage_path, mime_type, size_bytes, kind
    from public.quote_attachments
   where quote_id = p_quote_id;

  perform set_config('app.bulk_recalc', 'off', true);

  for v_item in select id from public.line_items where work_order_id = v_order.id loop
    perform public.recalc_line_item(v_item);
  end loop;
  perform public.recalc_document(null, v_order.id);

  select * into v_order from public.work_orders where id = v_order.id;
  if v_order.total_value <> v_quote.total then
    raise exception 'O total da OS (%) saiu diferente do orçamento (%). Nada foi gravado.',
      public.format_currency(v_order.total_value), public.format_currency(v_quote.total);
  end if;

  if p_generate_receivables then
    select id into v_category from public.financial_categories
     where kind = 'RECEITA' and name = 'Venda de serviço' limit 1;

    for r in select * from public.quote_installments where quote_id = p_quote_id order by number loop
      insert into public.financial_transactions (
        description, kind, category_id, work_order_id, customer_id, amount, due_date, status,
        payment_method, installment, installments, is_demo, created_by
      )
      values (
        v_order.number || ' · parcela ' || r.number || '/' || v_installments || ' · ' || coalesce(v_customer.name, ''),
        'RECEITA', v_category, v_order.id, v_quote.customer_id, r.amount, r.due_date, 'PENDENTE',
        r.payment_method, r.number, v_installments, v_quote.is_demo, auth.uid()
      )
      returning id into v_tx;

      update public.quote_installments set financial_transaction_id = v_tx where id = r.id;
    end loop;
  end if;

  update public.quotes
     set status = 'APROVADO', approved_at = now(), approved_by = auth.uid()
   where id = p_quote_id;

  insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
  values (v_order.id, 'CRIACAO', 'Gerada a partir do orçamento',
          v_quote.number || ' aprovado com ' || v_count
            || case when v_count = 1 then ' produto' else ' produtos' end
            || case when p_generate_receivables
                    then ' e ' || v_installments
                         || case when v_installments = 1 then ' parcela lançada' else ' parcelas lançadas' end
                         || ' no financeiro.'
                    else '.' end,
          auth.uid());

  perform set_config('app.system_write', 'off', true);

  select * into v_order from public.work_orders where id = v_order.id;
  return v_order;
end;
$fn$;

comment on function public.approve_quote is
  'Aprova o orcamento e cria a OS com a montagem completa. Exige quotes.approve (e financial.write para gerar as parcelas).';

-- Mesma assinatura das migrations 0010/0016 (o db:push --all reaplica as
-- antigas antes desta): agora so repassa para approve_quote.
create or replace function public.convert_quote_to_work_order(
  p_quote_id uuid,
  p_deadline date default null
)
returns public.work_orders
language plpgsql
security definer
set search_path = public
as $fn$
begin
  return public.approve_quote(p_quote_id, p_deadline, false);
end;
$fn$;

comment on function public.convert_quote_to_work_order is
  'Compatibilidade: aprova sem gerar contas a receber. Use approve_quote.';

-- -------------------------------------------------------------------------
-- Parcelas direto da OS (OS criada sem orcamento, ou aprovada sem gerar).
-- p_installments = [{ due_date, amount, payment_method, notes }]
-- -------------------------------------------------------------------------
create or replace function public.generate_work_order_receivables(p_work_order_id uuid, p_installments jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_order    public.work_orders;
  v_customer text;
  v_category uuid;
  v_total    integer;
  v_count    integer;
begin
  if not public.has_perm('financial.write') then
    raise exception 'Você não tem permissão para lançar contas a receber' using errcode = '42501';
  end if;

  select * into v_order from public.work_orders where id = p_work_order_id;
  if not found then
    raise exception 'Ordem de serviço não encontrada';
  end if;
  if v_order.cancelled_at is not null then
    raise exception 'OS cancelada não recebe lançamentos';
  end if;

  if jsonb_typeof(coalesce(p_installments, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_installments, '[]'::jsonb)) = 0 then
    raise exception 'Informe ao menos uma parcela';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_installments) e
     where nullif(e->>'due_date', '') is null or coalesce(nullif(e->>'amount', '')::numeric, 0) <= 0
  ) then
    raise exception 'Informe vencimento e valor maior que zero em todas as parcelas';
  end if;

  select name into v_customer from public.customers where id = v_order.customer_id;
  select id into v_category from public.financial_categories
   where kind = 'RECEITA' and name = 'Venda de serviço' limit 1;
  v_total := jsonb_array_length(p_installments);

  insert into public.financial_transactions (
    description, kind, category_id, work_order_id, customer_id, amount, due_date, status,
    payment_method, installment, installments, notes, is_demo, created_by
  )
  select v_order.number || ' · parcela ' || t.ord || '/' || v_total || ' · ' || coalesce(v_customer, ''),
         'RECEITA', v_category, v_order.id, v_order.customer_id,
         round((e->>'amount')::numeric, 2), (e->>'due_date')::date, 'PENDENTE',
         nullif(e->>'payment_method', ''), t.ord::integer, v_total, nullif(btrim(e->>'notes'), ''),
         v_order.is_demo, auth.uid()
    from jsonb_array_elements(p_installments) with ordinality as t(e, ord);

  get diagnostics v_count = row_count;

  insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
  values (v_order.id, 'PAGAMENTO', 'Parcelas lançadas no financeiro',
          v_count || case when v_count = 1 then ' conta a receber criada.' else ' contas a receber criadas.' end,
          auth.uid());

  return v_count;
end;
$fn$;

-- -------------------------------------------------------------------------
-- RT da OS -> conta a pagar
-- -------------------------------------------------------------------------
create or replace function public.launch_technical_reserve(p_reserve_id uuid, p_due_date date)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_reserve  public.technical_reserves;
  v_number   text;
  v_is_demo  boolean;
  v_category uuid;
  v_tx       uuid;
begin
  if not public.has_perm('financial.write') then
    raise exception 'Você não tem permissão para lançar contas a pagar' using errcode = '42501';
  end if;

  select * into v_reserve from public.technical_reserves where id = p_reserve_id for update;
  if not found then
    raise exception 'RT não encontrada';
  end if;
  if v_reserve.work_order_id is null then
    raise exception 'A RT é lançada no financeiro depois que o orçamento vira OS';
  end if;
  if v_reserve.financial_transaction_id is not null then
    raise exception 'Esta RT já foi lançada no financeiro';
  end if;
  if v_reserve.amount <= 0 then
    raise exception 'A RT está com valor zero';
  end if;
  if p_due_date is null then
    raise exception 'Informe o vencimento';
  end if;

  select number, is_demo into v_number, v_is_demo from public.work_orders where id = v_reserve.work_order_id;
  select id into v_category from public.financial_categories
   where kind = 'DESPESA' and name = 'Reserva técnica (RT)' limit 1;

  insert into public.financial_transactions (
    description, kind, category_id, work_order_id, amount, due_date, status, notes, is_demo, created_by
  )
  values (
    'RT · ' || v_reserve.professional_name || ' · ' || v_number, 'DESPESA', v_category, v_reserve.work_order_id,
    v_reserve.amount, p_due_date, 'PENDENTE',
    nullif(concat_ws(' · ', 'PIX: ' || v_reserve.pix_key, v_reserve.professional_document, v_reserve.notes), ''),
    v_is_demo, auth.uid()
  )
  returning id into v_tx;

  update public.technical_reserves set financial_transaction_id = v_tx where id = p_reserve_id;

  insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
  values (v_reserve.work_order_id, 'PAGAMENTO', 'RT lançada no financeiro',
          v_reserve.professional_name || ' · ' || public.format_currency(v_reserve.amount), auth.uid());

  return v_tx;
end;
$fn$;

-- -------------------------------------------------------------------------
-- Producao aponta a peca da montagem
-- -------------------------------------------------------------------------
alter table public.production_records
  add column if not exists line_item_id uuid references public.line_items(id) on delete set null,
  add column if not exists piece_id uuid references public.line_item_pieces(id) on delete set null;

create index if not exists idx_production_piece on public.production_records(piece_id);

-- ---------------------------------------------------------------- acesso
do $grants$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.approve_quote(uuid, date, boolean)',
    'public.convert_quote_to_work_order(uuid, date)',
    'public.generate_work_order_receivables(uuid, jsonb)',
    'public.launch_technical_reserve(uuid, date)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;
end
$grants$;
