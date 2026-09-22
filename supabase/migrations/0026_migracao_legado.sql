-- =========================================================================
-- 0026 - itens antigos -> montagem nova
--
-- Cada item de quote_items / work_order_items vira:
--   ambiente (pelo nome digitado; vazio = "Geral")
--   └─ produto com Quant. 1 (descricao do item; saia -> Borda, frontao -> Rodabanca)
--        ├─ material com o preco antigo (cobranca por m2)  ─┐
--        │    └─ peca com a quantidade e as medidas antigas  ├ mesmo total
--        └─ servico por MT ou UN (cobranca por metro/unidade)┘
-- Acabamento, borda, cor, espessura, cuba, cooktop, recortes, furos e
-- observacoes vao para Especificacoes da peca; a situacao de producao e o
-- apontamento de producao acompanham a peca.
--
-- O total dos itens e conferido documento a documento contra a regra antiga
-- recalculada dos proprios itens; se algum divergir, a migration inteira
-- aborta e nada e gravado. updated_at nao e tocado (o alerta "OS sem
-- movimentacao" continua valendo). As tabelas antigas ficam intactas.
--
-- Idempotente: so migra documento com items_model = 1 e vira a chave para 2.
-- Documento criado pela tela antiga depois disto e migrado ao ser aberto
-- na tela nova (a tela chama migrate_document).
-- =========================================================================

create or replace function public.migrate_document(p_quote_id uuid, p_work_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_model         smallint;
  v_number        text;
  v_is_demo       boolean;
  v_expected      numeric;
  v_got           numeric;
  v_env           uuid;
  v_env_name      text;
  v_item          uuid;
  v_mat           uuid;
  v_specs         text;
  v_prev_bulk     text := coalesce(current_setting('app.bulk_recalc', true), '');
  v_prev_system   text := coalesce(current_setting('app.system_write', true), '');
  v_prev_preserve text := coalesce(current_setting('app.preserve_updated_at', true), '');
  r               record;
begin
  if num_nonnulls(p_quote_id, p_work_order_id) <> 1 then
    raise exception 'Documento não informado';
  end if;

  if p_quote_id is not null then
    select items_model, number, is_demo into v_model, v_number, v_is_demo
      from public.quotes where id = p_quote_id for update;
  else
    select items_model, number, is_demo into v_model, v_number, v_is_demo
      from public.work_orders where id = p_work_order_id for update;
  end if;

  if not found or v_model = 2 then
    return;
  end if;

  if auth.uid() is not null and not (
       (p_quote_id is not null and public.has_perm('quotes.read'))
    or (p_work_order_id is not null and public.has_perm('work_orders.read'))) then
    raise exception 'Você não tem permissão para abrir este documento' using errcode = '42501';
  end if;

  perform set_config('app.bulk_recalc', 'on', true);
  perform set_config('app.system_write', 'on', true);
  perform set_config('app.preserve_updated_at', 'on', true);

  -- regra antiga recalculada dos itens (o total gravado pode estar defasado:
  -- mudar o desconto nao recalculava)
  if p_quote_id is not null then
    select coalesce(sum(total_price), 0) into v_expected from public.quote_items where quote_id = p_quote_id;
  else
    select coalesce(sum(total_price), 0) into v_expected from public.work_order_items where work_order_id = p_work_order_id;
  end if;

  for r in
    select qi.id, qi.sort_order, qi.created_at, qi.description, qi.environment, qi.material_id, qi.color,
           qi.thickness_mm, qi.length_mm, qi.width_mm, qi.quantity, qi.pricing_mode, qi.unit_price,
           qi.finish, qi.edge, qi.notes,
           null::integer as skirt_mm, null::integer as backsplash_mm, 0 as cutouts,
           false as has_sink, null::text as sink_type, 0 as sink_quantity,
           false as has_cooktop, null::text as cooktop_type,
           0 as faucet_holes, 0 as outlet_holes, 0 as extra_holes,
           'PENDENTE'::text as production_status
      from public.quote_items qi
     where p_quote_id is not null and qi.quote_id = p_quote_id
    union all
    select wi.id, wi.sort_order, wi.created_at, wi.description, wi.environment, wi.material_id, wi.color,
           wi.thickness_mm, wi.length_mm, wi.width_mm, wi.quantity, wi.pricing_mode, wi.unit_price,
           wi.finish, wi.edge, wi.notes,
           wi.skirt_mm, wi.backsplash_mm, wi.cutouts,
           wi.has_sink, wi.sink_type, wi.sink_quantity,
           wi.has_cooktop, wi.cooktop_type,
           wi.faucet_holes, wi.outlet_holes, wi.extra_holes,
           wi.production_status
      from public.work_order_items wi
     where p_work_order_id is not null and wi.work_order_id = p_work_order_id
     order by 2, 3
  loop
    v_env_name := coalesce(nullif(btrim(r.environment), ''), 'Geral');
    v_env := null;

    select id into v_env from public.environments e
     where ((p_quote_id is not null and e.quote_id = p_quote_id)
         or (p_work_order_id is not null and e.work_order_id = p_work_order_id))
       and lower(e.name) = lower(v_env_name)
     order by e.number
     limit 1;

    if v_env is null then
      insert into public.environments (quote_id, work_order_id, number, name, sort_order, is_demo)
      select p_quote_id, p_work_order_id, coalesce(max(e.number), 0) + 1, v_env_name,
             coalesce(max(e.number), 0) + 1, v_is_demo
        from public.environments e
       where (p_quote_id is not null and e.quote_id = p_quote_id)
          or (p_work_order_id is not null and e.work_order_id = p_work_order_id)
      returning id into v_env;
    end if;

    v_specs := nullif(concat_ws(' · ',
      'Acabamento: ' || nullif(btrim(r.finish), ''),
      'Borda: ' || nullif(btrim(r.edge), ''),
      'Cor: ' || nullif(btrim(r.color), ''),
      'Espessura: ' || r.thickness_mm || ' mm',
      case when r.has_sink then 'Cuba' || coalesce(' ' || lower(r.sink_type), '')
                                || case when r.sink_quantity > 1 then ' ×' || r.sink_quantity else '' end end,
      case when r.has_cooktop then 'Cooktop' || coalesce(' ' || r.cooktop_type, '') end,
      case when r.cutouts > 0 then r.cutouts || case when r.cutouts = 1 then ' recorte' else ' recortes' end end,
      case when r.faucet_holes > 0 then r.faucet_holes || ' furo(s) de torneira' end,
      case when r.outlet_holes > 0 then r.outlet_holes || ' furo(s) de tomada' end,
      case when r.extra_holes > 0 then r.extra_holes || ' furo(s) extra(s)' end,
      nullif(btrim(r.notes), '')
    ), '');

    insert into public.line_items (
      quote_id, work_order_id, environment_id, description, quantity, unit,
      length_mm, width_mm, edge_mm, backsplash_mm, sort_order,
      legacy_quote_item_id, legacy_work_order_item_id, is_demo
    )
    values (
      p_quote_id, p_work_order_id, v_env, r.description, 1,
      case r.pricing_mode when 'ML' then 'ML' when 'UN' then 'UN' else 'M2' end,
      nullif(r.length_mm, 0), nullif(r.width_mm, 0), r.skirt_mm, r.backsplash_mm, r.sort_order,
      case when p_quote_id is not null then r.id end,
      case when p_work_order_id is not null then r.id end,
      v_is_demo
    )
    returning id into v_item;

    -- material + peca: sempre que houver cobranca por m2, material ou medidas
    if r.pricing_mode = 'M2' or r.material_id is not null or (r.length_mm > 0 and r.width_mm > 0) then
      insert into public.line_item_materials (
        line_item_id, material_id, code, description, thickness_mm, price_per_m2, price_overridden, sort_order
      )
      select v_item, m.id, m.code, coalesce(m.name, 'Material não informado'),
             coalesce(r.thickness_mm, m.thickness_mm),
             case when r.pricing_mode = 'M2' then r.unit_price else 0 end,
             m.id is not null, 1
        from (select 1) as one
        left join public.materials m on m.id = r.material_id
      returning id into v_mat;

      insert into public.line_item_pieces (
        line_item_id, line_item_material_id, number, name, quantity, length_mm, width_mm, waste_pct,
        label_count, specs, production_status, sort_order, legacy_work_order_item_id
      )
      values (
        v_item, v_mat, '1', r.description, r.quantity, r.length_mm, r.width_mm, 0,
        greatest(ceil(r.quantity)::integer, 1), v_specs, r.production_status, 1,
        case when p_work_order_id is not null then r.id end
      );
    end if;

    -- cobranca por metro linear ou unidade vira servico com o mesmo valor
    if r.pricing_mode in ('ML', 'UN') then
      insert into public.line_item_components (
        line_item_id, kind, description, unit, quantity, unit_price, price_overridden, sort_order
      )
      values (
        v_item, 'SERVICO', r.description, r.pricing_mode,
        case when r.pricing_mode = 'ML' then round(r.length_mm / 1000.0 * r.quantity, 4) else r.quantity end,
        r.unit_price, false, 1
      );
    end if;

    perform public.recalc_line_item(v_item);
  end loop;

  -- vira a chave com o total ja calculado (um update so: sem "valor alterado" falso na timeline)
  if p_quote_id is not null then
    update public.quotes
       set items_model = 2,
           subtotal = (select coalesce(sum(total), 0) from public.line_items where quote_id = p_quote_id)
     where id = p_quote_id
    returning subtotal into v_got;
  else
    update public.work_orders
       set items_model = 2,
           products_total = (select coalesce(sum(total), 0) from public.line_items where work_order_id = p_work_order_id)
     where id = p_work_order_id
    returning products_total into v_got;

    update public.production_records pr
       set line_item_id = p.line_item_id, piece_id = p.id
      from public.line_item_pieces p
     where pr.work_order_id = p_work_order_id
       and pr.piece_id is null
       and pr.work_order_item_id is not null
       and p.legacy_work_order_item_id = pr.work_order_item_id;
  end if;

  if v_got is distinct from v_expected then
    raise exception 'A migração do documento % mudaria o total dos itens de % para %. Nada foi gravado.',
      v_number, public.format_currency(v_expected), public.format_currency(v_got);
  end if;

  perform set_config('app.bulk_recalc', v_prev_bulk, true);
  perform set_config('app.system_write', v_prev_system, true);
  perform set_config('app.preserve_updated_at', v_prev_preserve, true);
end;
$fn$;

comment on function public.migrate_document is
  'Converte os itens antigos de um orcamento ou OS para a montagem nova, com o mesmo total. Idempotente.';

revoke all on function public.migrate_document(uuid, uuid) from public, anon;
grant execute on function public.migrate_document(uuid, uuid) to authenticated;

-- ------------------------------------------------------ migra o que existe
do $migrate$
declare
  r record;
begin
  for r in select id from public.quotes where items_model = 1 order by created_at loop
    perform public.migrate_document(r.id, null);
  end loop;

  for r in select id from public.work_orders where items_model = 1 order by created_at loop
    perform public.migrate_document(null, r.id);
  end loop;
end
$migrate$;
