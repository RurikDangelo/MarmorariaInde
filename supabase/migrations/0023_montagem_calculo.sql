-- =========================================================================
-- 0023 - calculo da montagem
--
-- Regras (conferidas com a impressao do sistema antigo):
--   peca      Total M2          = round(Qtd x C x L, 4)                (coluna gerada)
--             Total com Perda   = round(Total M2 x (1 + %Perda), 4)    (coluna gerada)
--   material  Quantidade M2     = soma do Total com Perda das pecas
--             QTD M2 Total      = round(Quantidade M2 x Quant. do produto, 4)
--             Valor Total       = round(QTD M2 Total x Valor por M2, 2)
--   composicao Qtd total        = round(Qtd x Quant. do produto, 4)
--             Valor             = round(Qtd total x Valor unitario, 2)
--   produto   Total Geral       = materiais + acabamentos + servicos + revendas
--   documento Total dos Produtos = soma dos produtos (0021 soma frete/outras/desconto)
--
-- Recalculo por triggers que so disparam quando muda uma coluna de ENTRADA
-- (medidas, preco, quantidade), entao o proprio recalculo nunca se repete.
-- As funcoes de gravacao em lote ligam app.bulk_recalc e recalculam uma vez
-- no final.
-- =========================================================================

create or replace function public.recalc_line_item(p_line_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_qty numeric;
begin
  select quantity into v_qty from public.line_items where id = p_line_item_id;
  if not found then
    return; -- produto ja apagado (delete em cascata)
  end if;

  -- materiais: m2 das pecas (1 unidade) e totais pela quantidade do produto
  with sums as (
    select m.id,
           m.price_per_m2,
           coalesce(sum(p.area_m2), 0)            as area,
           coalesce(sum(p.area_with_waste_m2), 0) as area_ww
      from public.line_item_materials m
      left join public.line_item_pieces p on p.line_item_material_id = m.id
     where m.line_item_id = p_line_item_id
     group by m.id, m.price_per_m2
  ), calc as (
    select id, area, area_ww,
           round(area_ww * v_qty, 4) as total_area,
           round(round(area_ww * v_qty, 4) * price_per_m2, 2) as total_value
      from sums
  )
  update public.line_item_materials m
     set area_m2 = c.area,
         area_with_waste_m2 = c.area_ww,
         total_area_m2 = c.total_area,
         total_value = c.total_value
    from calc c
   where m.id = c.id
     and (m.area_m2, m.area_with_waste_m2, m.total_area_m2, m.total_value)
         is distinct from (c.area, c.area_ww, c.total_area, c.total_value);

  update public.line_item_components c
     set total_quantity = round(c.quantity * v_qty, 4),
         total_value = round(round(c.quantity * v_qty, 4) * c.unit_price, 2)
   where c.line_item_id = p_line_item_id
     and (c.total_quantity, c.total_value)
         is distinct from (round(c.quantity * v_qty, 4), round(round(c.quantity * v_qty, 4) * c.unit_price, 2));

  with t as (
    select
      coalesce((select sum(total_area_m2) from public.line_item_materials where line_item_id = p_line_item_id), 0) as area,
      coalesce((select sum(total_value)   from public.line_item_materials where line_item_id = p_line_item_id), 0) as mat,
      coalesce((select sum(total_value) from public.line_item_components
                 where line_item_id = p_line_item_id and kind = 'ACABAMENTO'), 0) as fin,
      coalesce((select sum(total_value) from public.line_item_components
                 where line_item_id = p_line_item_id and kind = 'SERVICO'), 0) as srv,
      coalesce((select sum(total_value) from public.line_item_components
                 where line_item_id = p_line_item_id and kind = 'REVENDA'), 0) as rev,
      coalesce((select sum(total_value) from public.line_item_components
                 where line_item_id = p_line_item_id and kind = 'INSUMO'), 0) as ins
  )
  update public.line_items li
     set materials_area_m2 = t.area,
         materials_total = t.mat,
         finishes_total = t.fin,
         services_total = t.srv,
         resale_total = t.rev,
         supplies_total = t.ins,
         total = t.mat + t.fin + t.srv + t.rev
    from t
   where li.id = p_line_item_id
     and (li.materials_area_m2, li.materials_total, li.finishes_total, li.services_total,
          li.resale_total, li.supplies_total, li.total)
         is distinct from (t.area, t.mat, t.fin, t.srv, t.rev, t.ins, t.mat + t.fin + t.srv + t.rev);
end;
$fn$;

comment on function public.recalc_line_item is
  'Recalcula m2 e valores dos materiais, da composicao e os totais do produto.';

create or replace function public.recalc_document(p_quote_id uuid, p_work_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_quote_id is not null then
    update public.quotes q
       set subtotal = s.total
      from (select coalesce(sum(total), 0) as total from public.line_items where quote_id = p_quote_id) s
     where q.id = p_quote_id
       and q.items_model = 2
       and q.subtotal is distinct from s.total;
  end if;

  if p_work_order_id is not null then
    update public.work_orders w
       set products_total = s.total
      from (select coalesce(sum(total), 0) as total from public.line_items where work_order_id = p_work_order_id) s
     where w.id = p_work_order_id
       and w.items_model = 2
       and w.products_total is distinct from s.total;
  end if;
end;
$fn$;

comment on function public.recalc_document is
  'Atualiza o Total dos Produtos do orcamento/OS; o total final sai do trigger da 0021.';

revoke all on function public.recalc_line_item(uuid) from public, anon, authenticated;
revoke all on function public.recalc_document(uuid, uuid) from public, anon, authenticated;

-- ------------------------------------------------------------- triggers
create or replace function public.tg_line_item_child_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if coalesce(current_setting('app.bulk_recalc', true), '') = 'on' then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.line_item_id is distinct from old.line_item_id then
    perform public.recalc_line_item(old.line_item_id);
  end if;
  perform public.recalc_line_item(coalesce(new.line_item_id, old.line_item_id));
  return null;
end;
$fn$;

drop trigger if exists trg_li_pieces_changed on public.line_item_pieces;
drop trigger if exists trg_li_pieces_updated on public.line_item_pieces;
create trigger trg_li_pieces_changed after insert or delete on public.line_item_pieces
  for each row execute function public.tg_line_item_child_changed();
create trigger trg_li_pieces_updated
  after update of quantity, length_mm, width_mm, waste_pct, line_item_material_id, line_item_id
  on public.line_item_pieces
  for each row execute function public.tg_line_item_child_changed();

drop trigger if exists trg_li_materials_changed on public.line_item_materials;
drop trigger if exists trg_li_materials_updated on public.line_item_materials;
create trigger trg_li_materials_changed after insert or delete on public.line_item_materials
  for each row execute function public.tg_line_item_child_changed();
create trigger trg_li_materials_updated after update of price_per_m2, line_item_id on public.line_item_materials
  for each row execute function public.tg_line_item_child_changed();

drop trigger if exists trg_li_components_changed on public.line_item_components;
drop trigger if exists trg_li_components_updated on public.line_item_components;
create trigger trg_li_components_changed after insert or delete on public.line_item_components
  for each row execute function public.tg_line_item_child_changed();
create trigger trg_li_components_updated
  after update of quantity, unit_price, kind, line_item_id on public.line_item_components
  for each row execute function public.tg_line_item_child_changed();

-- Quantidade do produto muda: recalcula materiais e composicao.
create or replace function public.tg_line_item_quantity_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if coalesce(current_setting('app.bulk_recalc', true), '') = 'on' then
    return null;
  end if;
  perform public.recalc_line_item(new.id);
  return null;
end;
$fn$;

drop trigger if exists trg_line_item_quantity on public.line_items;
create trigger trg_line_item_quantity after update of quantity on public.line_items
  for each row when (old.quantity is distinct from new.quantity)
  execute function public.tg_line_item_quantity_changed();

-- Total do produto muda (ou produto entra/sai): atualiza o documento.
create or replace function public.tg_line_item_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if coalesce(current_setting('app.bulk_recalc', true), '') = 'on' then
    return null;
  end if;
  if tg_op = 'DELETE' then
    perform public.recalc_document(old.quote_id, old.work_order_id);
  else
    perform public.recalc_document(new.quote_id, new.work_order_id);
  end if;
  return null;
end;
$fn$;

drop trigger if exists trg_line_item_document on public.line_items;
drop trigger if exists trg_line_item_document_total on public.line_items;
create trigger trg_line_item_document after insert or delete on public.line_items
  for each row execute function public.tg_line_item_document();
create trigger trg_line_item_document_total after update on public.line_items
  for each row when (old.total is distinct from new.total)
  execute function public.tg_line_item_document();

-- -------------------------------------------------------------------------
-- Legado: documento ja migrado para a montagem nova nao aceita mais escrita
-- nos itens antigos (tela antiga ainda aberta em algum computador).
-- Delete em cascata (documento apagado) e scripts sem usuario passam.
-- -------------------------------------------------------------------------
create or replace function public.tg_legacy_items_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_model smallint;
begin
  if auth.uid() is null or coalesce(current_setting('app.system_write', true), '') = 'on' then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'quote_items' then
    select items_model into v_model from public.quotes where id = coalesce(new.quote_id, old.quote_id);
  else
    select items_model into v_model from public.work_orders where id = coalesce(new.work_order_id, old.work_order_id);
  end if;

  if v_model = 2 then
    raise exception 'Este documento foi atualizado para a nova montagem (ambientes e produtos). Recarregue a página.'
      using errcode = '55000';
  end if;

  return coalesce(new, old);
end;
$fn$;

drop trigger if exists trg_legacy_items_guard on public.quote_items;
create trigger trg_legacy_items_guard before insert or update or delete on public.quote_items
  for each row execute function public.tg_legacy_items_guard();

drop trigger if exists trg_legacy_items_guard on public.work_order_items;
create trigger trg_legacy_items_guard before insert or update or delete on public.work_order_items
  for each row execute function public.tg_legacy_items_guard();
