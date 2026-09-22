-- =========================================================================
-- 0024 - gravacao da montagem
--
-- Toda escrita em ambientes, produtos, materiais, pecas e composicao passa
-- por estas funcoes (SECURITY DEFINER, permissao checada na primeira linha,
-- como o resto do sistema). Elas garantem o que a API sozinha nao garante:
-- o produto inteiro grava numa transacao so, um id de outro produto nunca e
-- aceito, o preco "com cadeado" vem do cadastro e os totais saem certos.
-- =========================================================================

-- Id derivado e estavel (copia de documento, duplicar produto). Formato v4.
create or replace function public.derive_uuid(p_source uuid, p_salt uuid)
returns uuid
language sql
immutable
as $fn$
  select (substr(h, 1, 12) || '4' || substr(h, 14, 3) || '8' || substr(h, 18, 15))::uuid
    from (select md5(p_source::text || ':' || p_salt::text) as h) s;
$fn$;

-- -------------------------------------------------------------------------
-- O documento pode ser alterado por quem esta chamando?
-- -------------------------------------------------------------------------
create or replace function public.assert_document_writable(p_quote_id uuid, p_work_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_status    text;
  v_cancelled timestamptz;
  v_finished  timestamptz;
begin
  if num_nonnulls(p_quote_id, p_work_order_id) <> 1 then
    raise exception 'Documento não informado';
  end if;

  if p_quote_id is not null then
    if not public.has_perm('quotes.write') then
      raise exception 'Você não tem permissão para alterar orçamentos' using errcode = '42501';
    end if;
    select status into v_status from public.quotes where id = p_quote_id;
    if not found then
      raise exception 'Orçamento não encontrado';
    end if;
    if v_status = 'APROVADO' then
      raise exception 'Este orçamento já foi aprovado e não pode ser alterado. Faça as mudanças na OS.'
        using errcode = '42501';
    end if;
    if v_status in ('CANCELADO', 'RECUSADO') then
      raise exception 'Orçamento %: volte a situação para Rascunho ou Enviado para alterar.', lower(v_status)
        using errcode = '42501';
    end if;
  else
    if not public.has_perm('work_orders.write') then
      raise exception 'Você não tem permissão para alterar ordens de serviço' using errcode = '42501';
    end if;
    select cancelled_at, finished_at into v_cancelled, v_finished
      from public.work_orders where id = p_work_order_id;
    if not found then
      raise exception 'Ordem de serviço não encontrada';
    end if;
    if v_cancelled is not null then
      raise exception 'OS cancelada não pode ser alterada' using errcode = '42501';
    end if;
    if v_finished is not null then
      raise exception 'OS finalizada: mude a etapa para reabrir antes de alterar os produtos'
        using errcode = '42501';
    end if;
  end if;
end;
$fn$;

-- -------------------------------------------------------------------------
-- Ambientes
-- -------------------------------------------------------------------------
create or replace function public.save_environment(p_environment jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id          uuid := nullif(p_environment->>'id', '')::uuid;
  v_quote       uuid := nullif(p_environment->>'quote_id', '')::uuid;
  v_wo          uuid := nullif(p_environment->>'work_order_id', '')::uuid;
  v_name        text := btrim(coalesce(p_environment->>'name', ''));
  v_description text := nullif(btrim(coalesce(p_environment->>'description', '')), '');
  v_number      integer := nullif(p_environment->>'number', '')::integer;
  v_existing    public.environments;
begin
  if v_id is not null then
    select * into v_existing from public.environments where id = v_id;
    if found then
      v_quote := v_existing.quote_id;
      v_wo := v_existing.work_order_id;
    end if;
  end if;

  perform public.assert_document_writable(v_quote, v_wo);
  perform public.migrate_document(v_quote, v_wo);

  if v_name = '' then
    raise exception 'Informe o nome do ambiente';
  end if;

  if v_number is null then
    if v_existing.id is not null then
      v_number := v_existing.number;
    else
      select coalesce(max(number), 0) + 1 into v_number
        from public.environments
       where (v_quote is not null and quote_id = v_quote)
          or (v_wo is not null and work_order_id = v_wo);
    end if;
  end if;

  begin
    if v_existing.id is null then
      insert into public.environments (id, quote_id, work_order_id, number, name, description, sort_order)
      values (coalesce(v_id, gen_random_uuid()), v_quote, v_wo, v_number, v_name, v_description, v_number)
      returning id into v_id;
    else
      update public.environments
         set number = v_number, name = v_name, description = v_description, sort_order = v_number
       where id = v_id;
    end if;
  exception
    when unique_violation then
      raise exception 'Já existe um ambiente com o número % neste documento', v_number;
  end;

  if v_wo is not null then
    insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
    values (v_wo, 'ITEM', case when v_existing.id is null then 'Ambiente incluído' else 'Ambiente alterado' end,
            v_number || ' - ' || v_name, auth.uid());
  end if;

  return v_id;
end;
$fn$;

create or replace function public.delete_environment(p_environment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_env public.environments;
begin
  select * into v_env from public.environments where id = p_environment_id;
  if not found then
    return;
  end if;

  perform public.assert_document_writable(v_env.quote_id, v_env.work_order_id);

  delete from public.environments where id = p_environment_id;

  if v_env.work_order_id is not null then
    insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
    values (v_env.work_order_id, 'ITEM', 'Ambiente removido', v_env.number || ' - ' || v_env.name, auth.uid());
  end if;
end;
$fn$;

-- -------------------------------------------------------------------------
-- Produto com materiais, pecas e composicao, numa transacao so.
--
-- p_item = {
--   id, version, environment_id, product_id, code, description, complement,
--   quantity, unit, length_mm, width_mm, edge_mm, backsplash_mm, foot_mm,
--   drawing_path, notes,
--   materials:  [{ id, material_id, code, description, thickness_mm, price_per_m2, price_overridden }],
--   pieces:     [{ id, line_item_material_id, number, name, quantity, length_mm, width_mm,
--                  waste_pct, label_count, specs }],
--   components: [{ id, kind, product_id, code, description, unit, quantity, unit_price,
--                  price_overridden, notes }]
-- }
-- Ids de linhas novas podem vir do navegador (a peca aponta o material novo
-- antes de ele existir no banco). Ambiente novo digitado na propria edicao do
-- produto vem com environment_id novo + environment_name + quote_id ou
-- work_order_id, e e criado na mesma transacao.
-- -------------------------------------------------------------------------
create or replace function public.save_line_item(p_item jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id          uuid := coalesce(nullif(p_item->>'id', '')::uuid, gen_random_uuid());
  v_version     integer := nullif(p_item->>'version', '')::integer;
  v_env         public.environments;
  v_new_env     uuid;
  v_current     public.line_items;
  v_is_new      boolean;
  v_product     public.products;
  v_description text;
  v_materials   jsonb := coalesce(p_item->'materials', '[]'::jsonb);
  v_pieces      jsonb := coalesce(p_item->'pieces', '[]'::jsonb);
  v_components  jsonb := coalesce(p_item->'components', '[]'::jsonb);
  v_ids         uuid[];
begin
  if jsonb_typeof(v_materials) <> 'array' or jsonb_typeof(v_pieces) <> 'array'
     or jsonb_typeof(v_components) <> 'array' then
    raise exception 'Dados do produto inválidos';
  end if;

  select * into v_env from public.environments where id = nullif(p_item->>'environment_id', '')::uuid;
  if not found then
    -- ambiente novo digitado na propria edicao do produto: cria junto
    if btrim(coalesce(p_item->>'environment_name', '')) = '' then
      raise exception 'Selecione o ambiente do produto';
    end if;
    v_new_env := public.save_environment(jsonb_build_object(
      'id', nullif(p_item->>'environment_id', ''),
      'quote_id', nullif(p_item->>'quote_id', ''),
      'work_order_id', nullif(p_item->>'work_order_id', ''),
      'name', p_item->>'environment_name'
    ));
    select * into v_env from public.environments where id = v_new_env;
  end if;

  perform public.assert_document_writable(v_env.quote_id, v_env.work_order_id);
  perform public.migrate_document(v_env.quote_id, v_env.work_order_id);

  select * into v_current from public.line_items where id = v_id for update;
  v_is_new := not found;

  if not v_is_new then
    if v_current.quote_id is distinct from v_env.quote_id
       or v_current.work_order_id is distinct from v_env.work_order_id then
      raise exception 'Este produto pertence a outro documento' using errcode = '42501';
    end if;
    if v_version is not null and v_version <> v_current.version then
      raise exception 'Este produto foi alterado por outra pessoa enquanto você editava. Feche e abra de novo para ver a versão atual.'
        using errcode = '40001';
    end if;
  end if;

  if nullif(p_item->>'product_id', '') is not null then
    select * into v_product from public.products where id = (p_item->>'product_id')::uuid;
  end if;

  v_description := coalesce(nullif(btrim(p_item->>'description'), ''), v_product.name);
  if v_description is null then
    raise exception 'Informe o produto';
  end if;

  -- linhas de outro produto nunca sao aceitas
  select array_agg(x.id) into v_ids from (
    select nullif(e->>'id', '')::uuid as id from jsonb_array_elements(v_materials) e
    union all
    select nullif(e->>'id', '')::uuid from jsonb_array_elements(v_pieces) e
    union all
    select nullif(e->>'id', '')::uuid from jsonb_array_elements(v_components) e
  ) x;

  if exists (select 1 from unnest(coalesce(v_ids, '{}')) i where i is null) then
    raise exception 'Dados do produto inválidos (linha sem identificador)';
  end if;

  if exists (select 1 from public.line_item_materials where id = any(v_ids) and line_item_id <> v_id)
     or exists (select 1 from public.line_item_pieces where id = any(v_ids) and line_item_id <> v_id)
     or exists (select 1 from public.line_item_components where id = any(v_ids) and line_item_id <> v_id) then
    raise exception 'Dados de outro produto não podem ser gravados aqui' using errcode = '42501';
  end if;

  perform set_config('app.bulk_recalc', 'on', true);

  if v_is_new then
    insert into public.line_items (
      id, quote_id, work_order_id, environment_id, product_id, code, description, complement,
      quantity, unit, length_mm, width_mm, edge_mm, backsplash_mm, foot_mm, drawing_path, notes, sort_order
    )
    values (
      v_id, v_env.quote_id, v_env.work_order_id, v_env.id, v_product.id,
      coalesce(v_product.code, nullif(btrim(p_item->>'code'), '')), v_description,
      nullif(btrim(p_item->>'complement'), ''),
      coalesce(nullif(p_item->>'quantity', '')::numeric, 1),
      coalesce(nullif(p_item->>'unit', ''), v_product.unit, 'M2'),
      nullif(p_item->>'length_mm', '')::integer, nullif(p_item->>'width_mm', '')::integer,
      nullif(p_item->>'edge_mm', '')::integer, nullif(p_item->>'backsplash_mm', '')::integer,
      nullif(p_item->>'foot_mm', '')::integer,
      nullif(p_item->>'drawing_path', ''), nullif(btrim(p_item->>'notes'), ''),
      coalesce((select max(sort_order) + 1 from public.line_items where environment_id = v_env.id), 1)
    );
  else
    update public.line_items
       set environment_id = v_env.id,
           product_id = v_product.id,
           code = coalesce(v_product.code, nullif(btrim(p_item->>'code'), '')),
           description = v_description,
           complement = nullif(btrim(p_item->>'complement'), ''),
           quantity = coalesce(nullif(p_item->>'quantity', '')::numeric, 1),
           unit = coalesce(nullif(p_item->>'unit', ''), v_product.unit, 'M2'),
           length_mm = nullif(p_item->>'length_mm', '')::integer,
           width_mm = nullif(p_item->>'width_mm', '')::integer,
           edge_mm = nullif(p_item->>'edge_mm', '')::integer,
           backsplash_mm = nullif(p_item->>'backsplash_mm', '')::integer,
           foot_mm = nullif(p_item->>'foot_mm', '')::integer,
           drawing_path = nullif(p_item->>'drawing_path', ''),
           notes = nullif(btrim(p_item->>'notes'), ''),
           version = version + 1
     where id = v_id;
  end if;

  -- ------------------------------------------------------------ materiais
  delete from public.line_item_materials m
   where m.line_item_id = v_id
     and not exists (select 1 from jsonb_array_elements(v_materials) e where (e->>'id')::uuid = m.id);

  insert into public.line_item_materials (
    id, line_item_id, material_id, code, description, thickness_mm, price_per_m2, price_overridden, sort_order
  )
  select s.id, v_id, s.material_id,
         coalesce(m.code, s.code),
         coalesce(m.name, s.description, 'Material não informado'),
         coalesce(s.thickness_mm, m.thickness_mm),
         case when m.id is not null and not s.price_overridden then coalesce(m.price_per_m2, 0)
              else s.price_per_m2 end,
         s.price_overridden and m.id is not null,
         s.ord
    from (
      select (e->>'id')::uuid as id,
             nullif(e->>'material_id', '')::uuid as material_id,
             nullif(btrim(e->>'code'), '') as code,
             nullif(btrim(e->>'description'), '') as description,
             nullif(e->>'thickness_mm', '')::integer as thickness_mm,
             coalesce(nullif(e->>'price_per_m2', '')::numeric, 0) as price_per_m2,
             coalesce((e->>'price_overridden')::boolean, false) as price_overridden,
             t.ord::integer as ord
        from jsonb_array_elements(v_materials) with ordinality as t(e, ord)
    ) s
    left join public.materials m on m.id = s.material_id
  on conflict (id) do update
     set material_id = excluded.material_id,
         code = excluded.code,
         description = excluded.description,
         thickness_mm = excluded.thickness_mm,
         price_per_m2 = excluded.price_per_m2,
         price_overridden = excluded.price_overridden,
         sort_order = excluded.sort_order
   where public.line_item_materials.line_item_id = excluded.line_item_id;

  -- ---------------------------------------------------------------- pecas
  if exists (
    select 1 from jsonb_array_elements(v_pieces) e
     where nullif(e->>'line_item_material_id', '') is not null
       and not exists (select 1 from public.line_item_materials m
                        where m.id = (e->>'line_item_material_id')::uuid and m.line_item_id = v_id)
  ) then
    raise exception 'Uma das peças aponta para um material que não está neste produto';
  end if;

  delete from public.line_item_pieces p
   where p.line_item_id = v_id
     and not exists (select 1 from jsonb_array_elements(v_pieces) e where (e->>'id')::uuid = p.id);

  insert into public.line_item_pieces (
    id, line_item_id, line_item_material_id, number, name, quantity, length_mm, width_mm,
    waste_pct, label_count, specs, sort_order
  )
  select (e->>'id')::uuid, v_id,
         nullif(e->>'line_item_material_id', '')::uuid,
         nullif(btrim(e->>'number'), ''),
         nullif(btrim(e->>'name'), ''),
         coalesce(nullif(e->>'quantity', '')::numeric, 1),
         coalesce(nullif(e->>'length_mm', '')::integer, 0),
         coalesce(nullif(e->>'width_mm', '')::integer, 0),
         coalesce(nullif(e->>'waste_pct', '')::numeric, 0),
         coalesce(nullif(e->>'label_count', '')::integer, 1),
         nullif(btrim(e->>'specs'), ''),
         t.ord::integer
    from jsonb_array_elements(v_pieces) with ordinality as t(e, ord)
  on conflict (id) do update
     set line_item_material_id = excluded.line_item_material_id,
         number = excluded.number,
         name = excluded.name,
         quantity = excluded.quantity,
         length_mm = excluded.length_mm,
         width_mm = excluded.width_mm,
         waste_pct = excluded.waste_pct,
         label_count = excluded.label_count,
         specs = excluded.specs,
         sort_order = excluded.sort_order
   where public.line_item_pieces.line_item_id = excluded.line_item_id;

  -- ----------------------------------------------------------- composicao
  delete from public.line_item_components c
   where c.line_item_id = v_id
     and not exists (select 1 from jsonb_array_elements(v_components) e where (e->>'id')::uuid = c.id);

  insert into public.line_item_components (
    id, line_item_id, kind, product_id, code, description, unit, quantity, unit_price,
    price_overridden, notes, sort_order
  )
  select s.id, v_id, s.kind, s.product_id,
         coalesce(pr.code, s.code),
         coalesce(s.description, pr.name, 'Item'),
         coalesce(s.unit, pr.unit, 'UN'),
         s.quantity,
         case when pr.id is not null and not s.price_overridden
              then coalesce(case when s.kind = 'INSUMO' then coalesce(pr.cost, pr.price) else pr.price end, 0)
              else s.unit_price end,
         s.price_overridden and pr.id is not null,
         s.notes,
         s.ord
    from (
      select (e->>'id')::uuid as id,
             e->>'kind' as kind,
             nullif(e->>'product_id', '')::uuid as product_id,
             nullif(btrim(e->>'code'), '') as code,
             nullif(btrim(e->>'description'), '') as description,
             nullif(e->>'unit', '') as unit,
             coalesce(nullif(e->>'quantity', '')::numeric, 0) as quantity,
             coalesce(nullif(e->>'unit_price', '')::numeric, 0) as unit_price,
             coalesce((e->>'price_overridden')::boolean, false) as price_overridden,
             nullif(btrim(e->>'notes'), '') as notes,
             t.ord::integer as ord
        from jsonb_array_elements(v_components) with ordinality as t(e, ord)
    ) s
    left join public.products pr on pr.id = s.product_id
  on conflict (id) do update
     set kind = excluded.kind,
         product_id = excluded.product_id,
         code = excluded.code,
         description = excluded.description,
         unit = excluded.unit,
         quantity = excluded.quantity,
         unit_price = excluded.unit_price,
         price_overridden = excluded.price_overridden,
         notes = excluded.notes,
         sort_order = excluded.sort_order
   where public.line_item_components.line_item_id = excluded.line_item_id;

  perform set_config('app.bulk_recalc', 'off', true);
  perform public.recalc_line_item(v_id);
  perform public.recalc_document(v_env.quote_id, v_env.work_order_id);

  if v_env.work_order_id is not null then
    insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
    values (v_env.work_order_id, 'ITEM', case when v_is_new then 'Produto incluído' else 'Produto alterado' end,
            v_env.name || ' · ' || v_description, auth.uid());
  end if;

  return jsonb_build_object('id', v_id, 'version', (select version from public.line_items where id = v_id));
end;
$fn$;

create or replace function public.delete_line_item(p_line_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_item public.line_items;
begin
  select * into v_item from public.line_items where id = p_line_item_id;
  if not found then
    return;
  end if;

  perform public.assert_document_writable(v_item.quote_id, v_item.work_order_id);

  delete from public.line_items where id = p_line_item_id;

  if v_item.work_order_id is not null then
    insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
    values (v_item.work_order_id, 'ITEM', 'Produto removido', v_item.description, auth.uid());
  end if;
end;
$fn$;

create or replace function public.duplicate_line_item(p_line_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_item public.line_items;
  v_new  uuid := gen_random_uuid();
begin
  select * into v_item from public.line_items where id = p_line_item_id;
  if not found then
    raise exception 'Produto não encontrado';
  end if;

  perform public.assert_document_writable(v_item.quote_id, v_item.work_order_id);

  perform set_config('app.bulk_recalc', 'on', true);

  insert into public.line_items (
    id, quote_id, work_order_id, environment_id, product_id, code, description, complement, quantity, unit,
    length_mm, width_mm, edge_mm, backsplash_mm, foot_mm, drawing_path, notes, sort_order, is_demo
  )
  select v_new, quote_id, work_order_id, environment_id, product_id, code, description, complement, quantity, unit,
         length_mm, width_mm, edge_mm, backsplash_mm, foot_mm, drawing_path, notes,
         (select max(sort_order) + 1 from public.line_items where environment_id = v_item.environment_id), is_demo
    from public.line_items where id = p_line_item_id;

  insert into public.line_item_materials (
    id, line_item_id, material_id, code, description, thickness_mm, price_per_m2, price_overridden, sort_order
  )
  select public.derive_uuid(m.id, v_new), v_new, m.material_id, m.code, m.description, m.thickness_mm,
         m.price_per_m2, m.price_overridden, m.sort_order
    from public.line_item_materials m where m.line_item_id = p_line_item_id;

  insert into public.line_item_pieces (
    id, line_item_id, line_item_material_id, number, name, quantity, length_mm, width_mm,
    waste_pct, label_count, specs, sort_order
  )
  select public.derive_uuid(p.id, v_new), v_new,
         case when p.line_item_material_id is null then null else public.derive_uuid(p.line_item_material_id, v_new) end,
         p.number, p.name, p.quantity, p.length_mm, p.width_mm, p.waste_pct, p.label_count, p.specs, p.sort_order
    from public.line_item_pieces p where p.line_item_id = p_line_item_id;

  insert into public.line_item_components (
    id, line_item_id, kind, product_id, code, description, unit, quantity, unit_price, price_overridden, notes, sort_order
  )
  select public.derive_uuid(c.id, v_new), v_new, c.kind, c.product_id, c.code, c.description, c.unit, c.quantity,
         c.unit_price, c.price_overridden, c.notes, c.sort_order
    from public.line_item_components c where c.line_item_id = p_line_item_id;

  perform set_config('app.bulk_recalc', 'off', true);
  perform public.recalc_line_item(v_new);
  perform public.recalc_document(v_item.quote_id, v_item.work_order_id);

  if v_item.work_order_id is not null then
    insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
    values (v_item.work_order_id, 'ITEM', 'Produto duplicado', v_item.description, auth.uid());
  end if;

  return v_new;
end;
$fn$;

-- -------------------------------------------------------------------------
-- Situacao de producao da peca (quem aponta producao nao precisa poder
-- editar a OS inteira).
-- -------------------------------------------------------------------------
create or replace function public.set_piece_status(p_piece_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_work_order uuid;
begin
  if not (public.has_perm('production.write') or public.has_perm('work_orders.write')) then
    raise exception 'Você não tem permissão para apontar produção' using errcode = '42501';
  end if;
  if p_status not in ('PENDENTE','EM_PRODUCAO','PRONTO','INSTALADO','RETRABALHO') then
    raise exception 'Situação de peça inválida';
  end if;

  select li.work_order_id into v_work_order
    from public.line_item_pieces p
    join public.line_items li on li.id = p.line_item_id
   where p.id = p_piece_id;

  if v_work_order is null then
    raise exception 'Peça não encontrada nesta OS';
  end if;

  update public.line_item_pieces set production_status = p_status where id = p_piece_id;
end;
$fn$;

-- -------------------------------------------------------------------------
-- Medicao aprovada -> produtos e pecas da OS (sem material: a oficina ou o
-- escritorio escolhe o material na montagem).
-- -------------------------------------------------------------------------
create or replace function public.import_measurement(p_measurement_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_work_order uuid;
  v_env        uuid;
  v_env_name   text;
  v_item       uuid;
  v_count      integer := 0;
  r            record;
begin
  select work_order_id into v_work_order from public.work_order_measurements where id = p_measurement_id;
  if v_work_order is null then
    raise exception 'Medição não encontrada';
  end if;

  perform public.assert_document_writable(null, v_work_order);
  perform public.migrate_document(null, v_work_order);

  if not exists (select 1 from public.work_order_measurement_items where measurement_id = p_measurement_id) then
    raise exception 'Nenhuma medida registrada para importar';
  end if;

  perform set_config('app.bulk_recalc', 'on', true);

  for r in
    select * from public.work_order_measurement_items
     where measurement_id = p_measurement_id
     order by sort_order, created_at
  loop
    v_env_name := coalesce(nullif(btrim(r.environment), ''), 'Geral');

    select id into v_env from public.environments
     where work_order_id = v_work_order and lower(name) = lower(v_env_name)
     order by number limit 1;

    if v_env is null then
      insert into public.environments (work_order_id, number, name, sort_order)
      select v_work_order, coalesce(max(number), 0) + 1, v_env_name, coalesce(max(number), 0) + 1
        from public.environments where work_order_id = v_work_order
      returning id into v_env;
    end if;

    insert into public.line_items (work_order_id, environment_id, description, quantity, unit, length_mm, width_mm, notes, sort_order)
    values (v_work_order, v_env, r.description, 1, 'M2', nullif(r.length_mm, 0), nullif(r.width_mm, 0), r.notes,
            coalesce((select max(sort_order) + 1 from public.line_items where environment_id = v_env), 1))
    returning id into v_item;

    insert into public.line_item_pieces (line_item_id, number, name, quantity, length_mm, width_mm, waste_pct, label_count, specs, sort_order)
    values (v_item, '1', r.description, r.quantity, r.length_mm, r.width_mm, 0,
            greatest(ceil(r.quantity)::integer, 1),
            case when r.thickness_mm is not null then 'Espessura: ' || r.thickness_mm || ' mm' end, 1);

    v_env := null;
    v_count := v_count + 1;
  end loop;

  perform set_config('app.bulk_recalc', 'off', true);
  perform public.recalc_document(null, v_work_order);

  insert into public.work_order_history (work_order_id, event_type, title, description, created_by)
  values (v_work_order, 'MEDICAO', 'Medidas importadas para os produtos',
          v_count || case when v_count = 1 then ' medida virou produto da OS. Escolha o material na montagem.'
                          else ' medidas viraram produtos da OS. Escolha o material na montagem.' end,
          auth.uid());

  return v_count;
end;
$fn$;

-- -------------------------------------------------------------------------
-- Fatura do orcamento (substitui as parcelas de uma vez)
-- -------------------------------------------------------------------------
create or replace function public.save_quote_installments(p_quote_id uuid, p_installments jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer;
begin
  perform public.assert_document_writable(p_quote_id, null);

  if jsonb_typeof(coalesce(p_installments, '[]'::jsonb)) <> 'array' then
    raise exception 'Parcelas inválidas';
  end if;

  if exists (
    select 1 from jsonb_array_elements(coalesce(p_installments, '[]'::jsonb)) e
     where nullif(e->>'due_date', '') is null
        or coalesce(nullif(e->>'amount', '')::numeric, -1) < 0
  ) then
    raise exception 'Informe vencimento e valor de todas as parcelas';
  end if;

  delete from public.quote_installments where quote_id = p_quote_id;

  insert into public.quote_installments (quote_id, number, due_date, amount, payment_method, notes)
  select p_quote_id, t.ord::integer, (e->>'due_date')::date, round((e->>'amount')::numeric, 2),
         nullif(e->>'payment_method', ''), nullif(btrim(e->>'notes'), '')
    from jsonb_array_elements(coalesce(p_installments, '[]'::jsonb)) with ordinality as t(e, ord);

  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

-- -------------------------------------------------------------------------
-- RT (reserva tecnica)
-- -------------------------------------------------------------------------
create or replace function public.assert_technical_reserve_writable(p_quote_id uuid, p_work_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_status text;
  v_cancelled timestamptz;
begin
  if p_quote_id is not null then
    if not public.has_perm('quotes.write') then
      raise exception 'Você não tem permissão para alterar orçamentos' using errcode = '42501';
    end if;
    select status into v_status from public.quotes where id = p_quote_id;
    if not found then
      raise exception 'Orçamento não encontrado';
    end if;
    if v_status in ('APROVADO', 'CANCELADO') then
      raise exception 'A RT de um orçamento %: altere na OS.', lower(v_status) using errcode = '42501';
    end if;
  elsif p_work_order_id is not null then
    if not public.has_perm('work_orders.write') then
      raise exception 'Você não tem permissão para alterar ordens de serviço' using errcode = '42501';
    end if;
    select cancelled_at into v_cancelled from public.work_orders where id = p_work_order_id;
    if not found then
      raise exception 'Ordem de serviço não encontrada';
    end if;
    if v_cancelled is not null then
      raise exception 'OS cancelada não pode ser alterada' using errcode = '42501';
    end if;
  else
    raise exception 'Documento não informado';
  end if;
end;
$fn$;

create or replace function public.save_technical_reserve(p_reserve jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id       uuid := nullif(p_reserve->>'id', '')::uuid;
  v_existing public.technical_reserves;
  v_quote    uuid := nullif(p_reserve->>'quote_id', '')::uuid;
  v_wo       uuid := nullif(p_reserve->>'work_order_id', '')::uuid;
  v_pct      numeric := nullif(p_reserve->>'percentage', '')::numeric;
  v_amount   numeric := coalesce(nullif(p_reserve->>'amount', '')::numeric, 0);
  v_total    numeric;
begin
  if v_id is not null then
    select * into v_existing from public.technical_reserves where id = v_id;
    if found then
      v_quote := v_existing.quote_id;
      v_wo := v_existing.work_order_id;
      if v_existing.financial_transaction_id is not null then
        raise exception 'Esta RT já foi lançada no financeiro; altere pelo lançamento.';
      end if;
    end if;
  end if;

  perform public.assert_technical_reserve_writable(v_quote, v_wo);

  if btrim(coalesce(p_reserve->>'professional_name', '')) = '' then
    raise exception 'Informe o profissional da RT';
  end if;

  if v_pct is not null then
    if v_quote is not null then
      select total into v_total from public.quotes where id = v_quote;
    else
      select total_value into v_total from public.work_orders where id = v_wo;
    end if;
    v_amount := round(coalesce(v_total, 0) * v_pct / 100, 2);
  end if;

  if v_existing.id is null then
    insert into public.technical_reserves (
      id, quote_id, work_order_id, professional_name, professional_phone, professional_document, pix_key,
      percentage, amount, notes
    )
    values (
      coalesce(v_id, gen_random_uuid()), v_quote, v_wo, btrim(p_reserve->>'professional_name'),
      nullif(btrim(p_reserve->>'professional_phone'), ''), nullif(btrim(p_reserve->>'professional_document'), ''),
      nullif(btrim(p_reserve->>'pix_key'), ''), v_pct, v_amount, nullif(btrim(p_reserve->>'notes'), '')
    )
    returning id into v_id;
  else
    update public.technical_reserves
       set professional_name = btrim(p_reserve->>'professional_name'),
           professional_phone = nullif(btrim(p_reserve->>'professional_phone'), ''),
           professional_document = nullif(btrim(p_reserve->>'professional_document'), ''),
           pix_key = nullif(btrim(p_reserve->>'pix_key'), ''),
           percentage = v_pct,
           amount = v_amount,
           notes = nullif(btrim(p_reserve->>'notes'), '')
     where id = v_id;
  end if;

  return v_id;
end;
$fn$;

create or replace function public.delete_technical_reserve(p_reserve_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_existing public.technical_reserves;
begin
  select * into v_existing from public.technical_reserves where id = p_reserve_id;
  if not found then
    return;
  end if;
  perform public.assert_technical_reserve_writable(v_existing.quote_id, v_existing.work_order_id);
  if v_existing.financial_transaction_id is not null then
    raise exception 'Esta RT já foi lançada no financeiro; cancele o lançamento primeiro.';
  end if;
  delete from public.technical_reserves where id = p_reserve_id;
end;
$fn$;

-- -------------------------------------------------------------------------
-- Concluir instalacao: quem instala finaliza a OS e marca as pecas, mesmo
-- sem poder editar a OS inteira (antes isso nao gravava em silencio).
-- -------------------------------------------------------------------------
create or replace function public.finish_installation(p_installation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_installation public.installations;
  v_now timestamptz := now();
begin
  if not public.has_perm('installations.write') then
    raise exception 'Você não tem permissão para registrar instalações' using errcode = '42501';
  end if;

  select * into v_installation from public.installations where id = p_installation_id for update;
  if not found then
    raise exception 'Instalação não encontrada';
  end if;

  update public.installations
     set status = 'CONCLUIDA', finished_at = v_now, approved = true, approved_at = v_now
   where id = p_installation_id;

  update public.work_orders
     set status_code = 'FINALIZADA', finished_at = v_now
   where id = v_installation.work_order_id
     and cancelled_at is null;

  update public.line_item_pieces p
     set production_status = 'INSTALADO'
    from public.line_items li
   where li.id = p.line_item_id
     and li.work_order_id = v_installation.work_order_id
     and p.production_status <> 'RETRABALHO';

  perform set_config('app.system_write', 'on', true);
  update public.work_order_items
     set production_status = 'INSTALADO'
   where work_order_id = v_installation.work_order_id
     and production_status <> 'RETRABALHO';
  perform set_config('app.system_write', 'off', true);
end;
$fn$;

-- ---------------------------------------------------------------- acesso
do $grants$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.save_environment(jsonb)',
    'public.delete_environment(uuid)',
    'public.save_line_item(jsonb)',
    'public.delete_line_item(uuid)',
    'public.duplicate_line_item(uuid)',
    'public.set_piece_status(uuid, text)',
    'public.import_measurement(uuid)',
    'public.save_quote_installments(uuid, jsonb)',
    'public.save_technical_reserve(jsonb)',
    'public.delete_technical_reserve(uuid)',
    'public.finish_installation(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;

  foreach v_fn in array array[
    'public.assert_document_writable(uuid, uuid)',
    'public.assert_technical_reserve_writable(uuid, uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', v_fn);
  end loop;
end
$grants$;
