-- =========================================================================
-- Montagem do orcamento/OS
--   1. calculo conferido com a impressao do sistema antigo (Pia e Balcao)
--   2. quantidade, perda e medidas "quebradas"
--   3. totais do documento, RT, fatura e aprovacao com copia completa
--   4. travas: orcamento aprovado, versao, id de outro produto, legado
--   5. RLS e permissoes por papel (inclui anon)
--   6. duplicar, remover, importar medicao, concluir instalacao
--   7. migracao dos itens antigos (mesmo total, idempotente)
-- Roda inteiro dentro de uma transacao com rollback (scripts/db-test.mjs).
-- =========================================================================

create function public._t_eq(p_label text, p_got numeric, p_expected numeric)
returns void language plpgsql as $$
begin
  if p_got is distinct from p_expected then
    raise exception '% : esperado %, veio %', p_label, p_expected, p_got;
  end if;
end $$;

create function public._t_error(p_label text, p_sql text, p_contains text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(lower(p_contains) in lower(sqlerrm)) = 0 then
      raise exception '% : erro diferente do esperado: %', p_label, sqlerrm;
    end if;
    return;
  end;
  raise exception '% : deveria ter falhado', p_label;
end $$;

create function public._t_as(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
end $$;

-- ------------------------------------------------------------- pessoas
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-000000000001', 'admin@teste.local');
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000002', 'operacional@teste.local'),
  ('a0000000-0000-4000-8000-000000000003', 'financeiro@teste.local'),
  ('a0000000-0000-4000-8000-000000000004', 'producao@teste.local'),
  ('a0000000-0000-4000-8000-000000000005', 'instalacao@teste.local');

select public._t_as('a0000000-0000-4000-8000-000000000001');
update public.profiles set role = 'ADMINISTRADOR' where id = 'a0000000-0000-4000-8000-000000000001';
update public.profiles set role = 'FINANCEIRO' where id = 'a0000000-0000-4000-8000-000000000003';
update public.profiles set role = 'PRODUCAO' where id = 'a0000000-0000-4000-8000-000000000004';
update public.profiles set role = 'INSTALACAO' where id = 'a0000000-0000-4000-8000-000000000005';

-- ------------------------------------------------------------ cadastros
insert into public.customers (id, name) values ('c0000000-0000-4000-8000-000000000001', 'Cliente Teste');

insert into public.materials (id, name, type_code, price_per_m2, code, thickness_mm) values
  ('b0000000-0000-4000-8000-000000000001', 'Gran. Preto São Gabriel', 'GRANITO', 600, '155', 20),
  ('b0000000-0000-4000-8000-000000000002', 'Gran. Amar. Verona', 'GRANITO', 315, '105', 20);

insert into public.products (id, kind, name, unit, price, cost) values
  ('d0000000-0000-4000-8000-000000000001', 'PRODUTO', 'Pia e Balcão', 'M2', 0, null),
  ('d0000000-0000-4000-8000-000000000002', 'ACABAMENTO', 'Acabamento 45°', 'ML', 120, null),
  ('d0000000-0000-4000-8000-000000000003', 'ACABAMENTO', 'Acabamento Reto Simples (Material Escuro)', 'ML', 30, null),
  ('d0000000-0000-4000-8000-000000000004', 'SERVICO', 'Furar e Colar Cuba', 'UN', 150, null),
  ('d0000000-0000-4000-8000-000000000005', 'SERVICO', 'Furo Cooktop', 'UN', 50, null),
  ('d0000000-0000-4000-8000-000000000006', 'SERVICO', 'Instalação de Pia e Balcão', 'ML', 150, null),
  ('d0000000-0000-4000-8000-000000000007', 'REVENDA', 'Cuba Inox nº 2 (56x34x17)', 'PC', 290, null),
  ('d0000000-0000-4000-8000-000000000008', 'INSUMO', 'Cola epóxi', 'UN', 99, 35);

do $$ begin
  perform public._t_eq('codigo automatico do produto',
    (select count(*) from public.products where code is null and id::text like 'd0000000%'), 0);
end $$;

-- =====================================================================
-- 1. Pia e Balcao da impressao
-- =====================================================================
set local role authenticated;

insert into public.quotes (id, customer_id, items_model)
values ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 2);

select public.save_environment('{"id":"f0000000-0000-4000-8000-000000000001","quote_id":"e0000000-0000-4000-8000-000000000001","name":"cozinha"}');

select public.save_line_item($json${
  "id": "10000000-0000-4000-8000-000000000001",
  "environment_id": "f0000000-0000-4000-8000-000000000001",
  "product_id": "d0000000-0000-4000-8000-000000000001",
  "quantity": 1, "unit": "M2",
  "materials": [
    {"id": "11000000-0000-4000-8000-000000000001", "material_id": "b0000000-0000-4000-8000-000000000001",
     "price_per_m2": 1, "price_overridden": false}
  ],
  "pieces": [
    {"id": "12000000-0000-4000-8000-000000000001", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "number": "1",  "quantity": 1, "length_mm": 2100, "width_mm": 600},
    {"id": "12000000-0000-4000-8000-000000000002", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "number": "2",  "quantity": 1, "length_mm": 1800, "width_mm": 600},
    {"id": "12000000-0000-4000-8000-000000000003", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "number": "3",  "quantity": 1, "length_mm": 940,  "width_mm": 600},
    {"id": "12000000-0000-4000-8000-000000000004", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "number": "4",  "quantity": 1, "length_mm": 940,  "width_mm": 200},
    {"id": "12000000-0000-4000-8000-000000000005", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "number": "5",  "quantity": 1, "length_mm": 2700, "width_mm": 150},
    {"id": "12000000-0000-4000-8000-000000000006", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "number": "6",  "quantity": 1, "length_mm": 600,  "width_mm": 100},
    {"id": "12000000-0000-4000-8000-000000000007", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "number": "7",  "quantity": 1, "length_mm": 1200, "width_mm": 100},
    {"id": "12000000-0000-4000-8000-000000000008", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "number": "8",  "quantity": 1, "length_mm": 900,  "width_mm": 60},
    {"id": "12000000-0000-4000-8000-000000000009", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "number": "9",  "quantity": 1, "length_mm": 1200, "width_mm": 60},
    {"id": "12000000-0000-4000-8000-000000000010", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "number": "10", "quantity": 1, "length_mm": 1800, "width_mm": 60},
    {"id": "12000000-0000-4000-8000-000000000011", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "number": "11", "quantity": 2, "length_mm": 940,  "width_mm": 60}
  ],
  "components": [
    {"id": "13000000-0000-4000-8000-000000000001", "kind": "ACABAMENTO", "product_id": "d0000000-0000-4000-8000-000000000002", "quantity": 9.12},
    {"id": "13000000-0000-4000-8000-000000000002", "kind": "ACABAMENTO", "product_id": "d0000000-0000-4000-8000-000000000003", "quantity": 2.7},
    {"id": "13000000-0000-4000-8000-000000000003", "kind": "SERVICO",    "product_id": "d0000000-0000-4000-8000-000000000004", "quantity": 1},
    {"id": "13000000-0000-4000-8000-000000000004", "kind": "SERVICO",    "product_id": "d0000000-0000-4000-8000-000000000005", "quantity": 1},
    {"id": "13000000-0000-4000-8000-000000000005", "kind": "SERVICO",    "product_id": "d0000000-0000-4000-8000-000000000006", "quantity": 4.84},
    {"id": "13000000-0000-4000-8000-000000000006", "kind": "REVENDA",    "product_id": "d0000000-0000-4000-8000-000000000007", "quantity": 1},
    {"id": "13000000-0000-4000-8000-000000000007", "kind": "INSUMO",     "product_id": "d0000000-0000-4000-8000-000000000008", "quantity": 2}
  ]
}$json$::jsonb);

do $$
declare
  v_item public.line_items;
  v_mat  public.line_item_materials;
  v_quote public.quotes;
begin
  select * into v_mat from public.line_item_materials where id = '11000000-0000-4000-8000-000000000001';
  perform public._t_eq('preco do cadastro (cadeado fechado)', v_mat.price_per_m2, 600);
  perform public._t_eq('codigo do material', v_mat.code::numeric, 155);
  perform public._t_eq('Quantidade M2 (impressao: 4,0238)', v_mat.area_with_waste_m2, 4.0238);
  perform public._t_eq('QTD M2 Total', v_mat.total_area_m2, 4.0238);
  perform public._t_eq('Valor do material (impressao: 2.414,28)', v_mat.total_value, 2414.28);

  select * into v_item from public.line_items where id = '10000000-0000-4000-8000-000000000001';
  perform public._t_eq('descricao vem do cadastro', (v_item.description = 'Pia e Balcão')::int, 1);
  perform public._t_eq('Total de Materiais', v_item.materials_total, 2414.28);
  perform public._t_eq('Total de Acabamentos (1.094,40 + 81,00)', v_item.finishes_total, 1175.40);
  perform public._t_eq('Total de Servicos (150 + 50 + 726)', v_item.services_total, 926.00);
  perform public._t_eq('Total de Revendas', v_item.resale_total, 290.00);
  perform public._t_eq('Total de Insumos (custo 35 x 2)', v_item.supplies_total, 70.00);
  perform public._t_eq('Total Geral do Item (impressao: 4.805,68)', v_item.total, 4805.68);
  perform public._t_eq('versao inicial', v_item.version, 1);

  select * into v_quote from public.quotes where id = 'e0000000-0000-4000-8000-000000000001';
  perform public._t_eq('Total dos Produtos', v_quote.subtotal, 4805.68);
  perform public._t_eq('Total do Orcamento', v_quote.total, 4805.68);
end $$;

-- =====================================================================
-- 2. Quant. 2 dobra tudo; perda e medidas quebradas
-- =====================================================================
select public.save_line_item(
  (select jsonb_set(jsonb_set(p, '{quantity}', '2'), '{version}', '1')
     from (select $json${
       "id": "10000000-0000-4000-8000-000000000001",
       "environment_id": "f0000000-0000-4000-8000-000000000001",
       "product_id": "d0000000-0000-4000-8000-000000000001",
       "materials": [{"id": "11000000-0000-4000-8000-000000000001", "material_id": "b0000000-0000-4000-8000-000000000001"}],
       "pieces": [
         {"id": "12000000-0000-4000-8000-000000000001", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "quantity": 1, "length_mm": 2100, "width_mm": 600},
         {"id": "12000000-0000-4000-8000-000000000002", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "quantity": 1, "length_mm": 1800, "width_mm": 600},
         {"id": "12000000-0000-4000-8000-000000000003", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "quantity": 1, "length_mm": 940,  "width_mm": 600},
         {"id": "12000000-0000-4000-8000-000000000004", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "quantity": 1, "length_mm": 940,  "width_mm": 200},
         {"id": "12000000-0000-4000-8000-000000000005", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "quantity": 1, "length_mm": 2700, "width_mm": 150},
         {"id": "12000000-0000-4000-8000-000000000006", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "quantity": 1, "length_mm": 600,  "width_mm": 100},
         {"id": "12000000-0000-4000-8000-000000000007", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "quantity": 1, "length_mm": 1200, "width_mm": 100},
         {"id": "12000000-0000-4000-8000-000000000008", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "quantity": 1, "length_mm": 900,  "width_mm": 60},
         {"id": "12000000-0000-4000-8000-000000000009", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "quantity": 1, "length_mm": 1200, "width_mm": 60},
         {"id": "12000000-0000-4000-8000-000000000010", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "quantity": 1, "length_mm": 1800, "width_mm": 60},
         {"id": "12000000-0000-4000-8000-000000000011", "line_item_material_id": "11000000-0000-4000-8000-000000000001", "quantity": 2, "length_mm": 940,  "width_mm": 60}
       ],
       "components": [
         {"id": "13000000-0000-4000-8000-000000000001", "kind": "ACABAMENTO", "product_id": "d0000000-0000-4000-8000-000000000002", "quantity": 9.12},
         {"id": "13000000-0000-4000-8000-000000000002", "kind": "ACABAMENTO", "product_id": "d0000000-0000-4000-8000-000000000003", "quantity": 2.7},
         {"id": "13000000-0000-4000-8000-000000000003", "kind": "SERVICO",    "product_id": "d0000000-0000-4000-8000-000000000004", "quantity": 1},
         {"id": "13000000-0000-4000-8000-000000000004", "kind": "SERVICO",    "product_id": "d0000000-0000-4000-8000-000000000005", "quantity": 1},
         {"id": "13000000-0000-4000-8000-000000000005", "kind": "SERVICO",    "product_id": "d0000000-0000-4000-8000-000000000006", "quantity": 4.84},
         {"id": "13000000-0000-4000-8000-000000000006", "kind": "REVENDA",    "product_id": "d0000000-0000-4000-8000-000000000007", "quantity": 1},
         {"id": "13000000-0000-4000-8000-000000000007", "kind": "INSUMO",     "product_id": "d0000000-0000-4000-8000-000000000008", "quantity": 2}
       ]
     }$json$::jsonb as p) s));

do $$ begin
  perform public._t_eq('Quant. 2: QTD M2 Total', (select total_area_m2 from public.line_item_materials where id = '11000000-0000-4000-8000-000000000001'), 8.0476);
  perform public._t_eq('Quant. 2: total do item', (select total from public.line_items where id = '10000000-0000-4000-8000-000000000001'), 9611.36);
  perform public._t_eq('Quant. 2: versao', (select version from public.line_items where id = '10000000-0000-4000-8000-000000000001'), 2);
  perform public._t_eq('Quant. 2: total do orcamento', (select total from public.quotes where id = 'e0000000-0000-4000-8000-000000000001'), 9611.36);
end $$;

-- versao velha e recusada
select public._t_error('versao desatualizada',
  $sql$ select public.save_line_item('{"id":"10000000-0000-4000-8000-000000000001","version":1,
        "environment_id":"f0000000-0000-4000-8000-000000000001","description":"x"}'::jsonb) $sql$,
  'alterado por outra pessoa');

-- de volta a Quant. 1 so mudando a quantidade (triggers recalculam materiais e composicao)
reset role;
update public.line_items set quantity = 1 where id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;

do $$ begin
  perform public._t_eq('Quant. 1 pelo trigger', (select total from public.line_items where id = '10000000-0000-4000-8000-000000000001'), 4805.68);
  perform public._t_eq('Quant. 1: orcamento', (select total from public.quotes where id = 'e0000000-0000-4000-8000-000000000001'), 4805.68);
end $$;

-- perda de 7,5% e medidas quebradas: 3 x 1234 x 567 = 2,0990 m2 -> 2,2564 m2; x R$ 457,33 = 1.031,92
insert into public.quotes (id, customer_id, items_model)
values ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 2);
select public.save_environment('{"id":"f0000000-0000-4000-8000-000000000002","quote_id":"e0000000-0000-4000-8000-000000000002","name":"Banheiro"}');
select public.save_line_item($json${
  "id": "10000000-0000-4000-8000-000000000002",
  "environment_id": "f0000000-0000-4000-8000-000000000002",
  "description": "Bancada", "quantity": 1,
  "materials": [{"id": "11000000-0000-4000-8000-000000000002", "material_id": "b0000000-0000-4000-8000-000000000002",
                 "price_per_m2": 457.33, "price_overridden": true}],
  "pieces": [{"id": "12000000-0000-4000-8000-000000000021", "line_item_material_id": "11000000-0000-4000-8000-000000000002",
              "quantity": 3, "length_mm": 1234, "width_mm": 567, "waste_pct": 7.5}]
}$json$::jsonb);

do $$ begin
  perform public._t_eq('peca: Total M2', (select area_m2 from public.line_item_pieces where id = '12000000-0000-4000-8000-000000000021'), 2.0990);
  perform public._t_eq('peca: Total com Perda', (select area_with_waste_m2 from public.line_item_pieces where id = '12000000-0000-4000-8000-000000000021'), 2.2564);
  perform public._t_eq('cadeado aberto mantem o preco digitado', (select price_per_m2 from public.line_item_materials where id = '11000000-0000-4000-8000-000000000002'), 457.33);
  perform public._t_eq('valor com perda', (select total from public.line_items where id = '10000000-0000-4000-8000-000000000002'), 1031.92);
end $$;

-- duplicar dobra; remover o ambiente zera
select public.duplicate_line_item('10000000-0000-4000-8000-000000000002');
do $$ begin
  perform public._t_eq('duplicar: produtos', (select count(*) from public.line_items where quote_id = 'e0000000-0000-4000-8000-000000000002'), 2);
  perform public._t_eq('duplicar: pecas copiadas', (select count(*) from public.line_item_pieces p join public.line_items li on li.id = p.line_item_id where li.quote_id = 'e0000000-0000-4000-8000-000000000002'), 2);
  perform public._t_eq('duplicar: total', (select total from public.quotes where id = 'e0000000-0000-4000-8000-000000000002'), 2063.84);
end $$;

select public.delete_environment('f0000000-0000-4000-8000-000000000002');
do $$ begin
  perform public._t_eq('remover ambiente: total', (select total from public.quotes where id = 'e0000000-0000-4000-8000-000000000002'), 0);
  perform public._t_eq('remover ambiente: produtos', (select count(*) from public.line_items where quote_id = 'e0000000-0000-4000-8000-000000000002'), 0);
end $$;

-- id de linha de outro produto nunca e aceito
select public.save_environment('{"id":"f0000000-0000-4000-8000-000000000003","quote_id":"e0000000-0000-4000-8000-000000000002","name":"Lavabo"}');
select public._t_error('material de outro produto',
  $sql$ select public.save_line_item('{"environment_id":"f0000000-0000-4000-8000-000000000003","description":"Invasor",
        "materials":[{"id":"11000000-0000-4000-8000-000000000001","description":"x","price_per_m2":1}]}'::jsonb) $sql$,
  'outro produto');
select public._t_error('peca apontando material fora do produto',
  $sql$ select public.save_line_item('{"environment_id":"f0000000-0000-4000-8000-000000000003","description":"Invasor",
        "pieces":[{"id":"12000000-0000-4000-8000-000000000099","line_item_material_id":"11000000-0000-4000-8000-000000000001","quantity":1,"length_mm":10,"width_mm":10}]}'::jsonb) $sql$,
  'não está neste produto');

-- =====================================================================
-- 3. Frete, outras despesas, desconto, RT, fatura e aprovacao
-- =====================================================================
update public.quotes set freight = 100, surcharge = 50, discount = 55.68
 where id = 'e0000000-0000-4000-8000-000000000001';

select public.save_technical_reserve('{"quote_id":"e0000000-0000-4000-8000-000000000001","professional_name":"Arq. Teste","percentage":10}');

select public.save_quote_installments('e0000000-0000-4000-8000-000000000001',
  '[{"due_date":"2026-09-22","amount":2450,"payment_method":"PIX"},{"due_date":"2026-10-22","amount":2450,"payment_method":"BOLETO"}]');

do $$ begin
  perform public._t_eq('Total do Orcamento com frete/outras/desconto', (select total from public.quotes where id = 'e0000000-0000-4000-8000-000000000001'), 4900.00);
  perform public._t_eq('RT 10% acompanha o total', (select amount from public.technical_reserves where quote_id = 'e0000000-0000-4000-8000-000000000001'), 490.00);
end $$;

select public._t_error('aprovar pela tela de status', $sql$
  update public.quotes set status = 'APROVADO' where id = 'e0000000-0000-4000-8000-000000000001' $sql$,
  'Aprovar e gerar OS');

select public.approve_quote('e0000000-0000-4000-8000-000000000001', null, true);

do $$
declare
  v_quote public.quotes;
  v_os    public.work_orders;
begin
  select * into v_quote from public.quotes where id = 'e0000000-0000-4000-8000-000000000001';
  select * into v_os from public.work_orders where quote_id = v_quote.id;
  perform public._t_eq('orcamento aprovado', (v_quote.status = 'APROVADO')::int, 1);
  perform public._t_eq('OS: total igual ao orcamento', v_os.total_value, 4900.00);
  perform public._t_eq('OS: Total dos Produtos', v_os.products_total, 4805.68);
  perform public._t_eq('OS: frete', v_os.freight, 100);
  perform public._t_eq('OS: outras despesas', v_os.surcharge, 50);
  perform public._t_eq('OS: desconto', v_os.discount, 55.68);
  perform public._t_eq('OS: montagem nova', v_os.items_model, 2);
  perform public._t_eq('OS: titulo com os ambientes', (v_os.title = 'cozinha')::int, 1);
  perform public._t_eq('OS: ambientes', (select count(*) from public.environments where work_order_id = v_os.id), 1);
  perform public._t_eq('OS: produtos', (select count(*) from public.line_items where work_order_id = v_os.id), 1);
  perform public._t_eq('OS: pecas', (select count(*) from public.line_item_pieces p join public.line_items li on li.id = p.line_item_id where li.work_order_id = v_os.id), 11);
  perform public._t_eq('OS: composicao', (select count(*) from public.line_item_components c join public.line_items li on li.id = c.line_item_id where li.work_order_id = v_os.id), 7);
  perform public._t_eq('OS: RT copiada', (select amount from public.technical_reserves where work_order_id = v_os.id), 490.00);
  perform public._t_eq('OS: contas a receber', (select count(*) from public.financial_transactions where work_order_id = v_os.id and kind = 'RECEITA' and status = 'PENDENTE'), 2);
  perform public._t_eq('OS: valor a receber', (select sum(amount) from public.financial_transactions where work_order_id = v_os.id), 4900.00);
  perform public._t_eq('parcelas vinculadas', (select count(*) from public.quote_installments where quote_id = v_quote.id and financial_transaction_id is not null), 2);
  perform public._t_eq('timeline da aprovacao', (select count(*) from public.work_order_history where work_order_id = v_os.id and title = 'Gerada a partir do orçamento'), 1);
  perform public._t_eq('sem valor negativo na timeline', (select count(*) from public.work_order_history where work_order_id = v_os.id and event_type = 'VALOR'), 0);
end $$;

-- orcamento aprovado fica travado
select public._t_error('produto em orcamento aprovado', $sql$
  select public.save_environment('{"quote_id":"e0000000-0000-4000-8000-000000000001","name":"Sala"}') $sql$, 'aprovado');
select public._t_error('desconto em orcamento aprovado', $sql$
  update public.quotes set discount = 0 where id = 'e0000000-0000-4000-8000-000000000001' $sql$, 'aprovado');
select public._t_error('voltar aprovado para rascunho', $sql$
  update public.quotes set status = 'RASCUNHO' where id = 'e0000000-0000-4000-8000-000000000001' $sql$, 'não volta atrás');
select public._t_error('aprovar duas vezes', $sql$
  select public.approve_quote('e0000000-0000-4000-8000-000000000001') $sql$, 'já foi aprovado');

-- a OS continua editavel e o desconto recalcula o total (antes nao recalculava)
update public.work_orders set discount = 0 where quote_id = 'e0000000-0000-4000-8000-000000000001';
do $$ begin
  perform public._t_eq('OS: desconto recalcula o total', (select total_value from public.work_orders where quote_id = 'e0000000-0000-4000-8000-000000000001'), 4955.68);
end $$;

-- RT da OS vira conta a pagar
select public.launch_technical_reserve(
  (select r.id from public.technical_reserves r join public.work_orders w on w.id = r.work_order_id
    where w.quote_id = 'e0000000-0000-4000-8000-000000000001'),
  '2026-11-10');
do $$ begin
  perform public._t_eq('RT lancada como despesa', (select count(*) from public.financial_transactions f
     join public.work_orders w on w.id = f.work_order_id
    where w.quote_id = 'e0000000-0000-4000-8000-000000000001' and f.kind = 'DESPESA'), 1);
end $$;

-- =====================================================================
-- 5. RLS e permissoes por papel
-- =====================================================================
reset role;
insert into public.production_steps (code, label, sort_order) values ('CORTE', 'Corte', 20) on conflict do nothing;
select public._t_as('a0000000-0000-4000-8000-000000000002'); -- operacional
set local role authenticated;

do $$ begin
  perform public._t_eq('operacional le a montagem', (select count(*) from public.line_items where quote_id = 'e0000000-0000-4000-8000-000000000001'), 1);
  perform public._t_eq('operacional le as pecas', (select count(*) from public.line_item_pieces p join public.line_items li on li.id = p.line_item_id where li.quote_id = 'e0000000-0000-4000-8000-000000000001'), 11);
end $$;

select public._t_error('operacional nao grava pela API', $sql$
  insert into public.environments (quote_id, number, name) values ('e0000000-0000-4000-8000-000000000002', 9, 'x') $sql$,
  'permission denied');
select public._t_error('operacional nao altera m2 pela API', $sql$
  update public.line_item_materials set total_value = 1 $sql$, 'permission denied');
select public._t_error('operacional nao grava pela funcao', $sql$
  select public.save_environment('{"quote_id":"e0000000-0000-4000-8000-000000000002","name":"x"}') $sql$, 'permissão');

select public._t_as('a0000000-0000-4000-8000-000000000003'); -- financeiro
do $$ begin
  perform public._t_eq('financeiro le a montagem', (select count(*) from public.line_items where quote_id = 'e0000000-0000-4000-8000-000000000001'), 1);
end $$;
select public._t_error('financeiro nao grava montagem', $sql$
  select public.save_environment('{"quote_id":"e0000000-0000-4000-8000-000000000002","name":"x"}') $sql$, 'permissão');

select public._t_as('a0000000-0000-4000-8000-000000000004'); -- producao
select public.set_piece_status(
  (select p.id from public.line_item_pieces p join public.line_items li on li.id = p.line_item_id
     join public.work_orders w on w.id = li.work_order_id
    where w.quote_id = 'e0000000-0000-4000-8000-000000000001' order by p.sort_order limit 1),
  'EM_PRODUCAO');
do $$ begin
  perform public._t_eq('producao aponta a peca', (select count(*) from public.line_item_pieces p join public.line_items li on li.id = p.line_item_id
     join public.work_orders w on w.id = li.work_order_id
    where w.quote_id = 'e0000000-0000-4000-8000-000000000001' and p.production_status = 'EM_PRODUCAO'), 1);
end $$;
select public._t_error('situacao de producao em peca de orcamento', $sql$
  select public.set_piece_status('12000000-0000-4000-8000-000000000001', 'PRONTO') $sql$, 'não encontrada nesta OS');
select public._t_error('producao nao altera a montagem', $sql$
  select public.delete_line_item('10000000-0000-4000-8000-000000000001') $sql$, 'permissão');

reset role;
set local role anon;
select public._t_error('anon nao executa gravacao', $sql$
  select public.save_line_item('{}'::jsonb) $sql$, 'permission denied');
select public._t_error('anon nao le a montagem', $sql$
  select count(*) from public.line_items $sql$, 'permission denied');

-- =====================================================================
-- 6. Medicao importada e instalacao concluida por quem instala
-- =====================================================================
reset role;
insert into public.work_order_measurements (id, work_order_id, status)
select 'a1000000-0000-4000-8000-000000000001', id, 'APROVADA' from public.work_orders
 where quote_id = 'e0000000-0000-4000-8000-000000000001';
insert into public.work_order_measurement_items (measurement_id, environment, description, length_mm, width_mm, quantity, thickness_mm)
values ('a1000000-0000-4000-8000-000000000001', 'Cozinha', 'Frontão extra', 2400, 100, 1, 20),
       ('a1000000-0000-4000-8000-000000000001', 'Área gourmet', 'Bancada churrasqueira', 2800, 700, 1, null);

select public._t_as('a0000000-0000-4000-8000-000000000001');
set local role authenticated;
select public.import_measurement('a1000000-0000-4000-8000-000000000001');
do $$ begin
  perform public._t_eq('medicao: produtos novos', (select count(*) from public.line_items li join public.work_orders w on w.id = li.work_order_id where w.quote_id = 'e0000000-0000-4000-8000-000000000001'), 3);
  perform public._t_eq('medicao: ambiente existente reaproveitado (sem diferenciar maiusculas)', (select count(*) from public.environments e join public.work_orders w on w.id = e.work_order_id where w.quote_id = 'e0000000-0000-4000-8000-000000000001'), 2);
end $$;

reset role;
insert into public.installations (id, work_order_id, status)
select 'a2000000-0000-4000-8000-000000000001', id, 'AGENDADA' from public.work_orders
 where quote_id = 'e0000000-0000-4000-8000-000000000001';

select public._t_as('a0000000-0000-4000-8000-000000000005'); -- instalacao
set local role authenticated;
select public.finish_installation('a2000000-0000-4000-8000-000000000001');
reset role;
do $$ begin
  perform public._t_eq('instalacao finaliza a OS', (select count(*) from public.work_orders where quote_id = 'e0000000-0000-4000-8000-000000000001' and status_code = 'FINALIZADA' and finished_at is not null), 1);
  perform public._t_eq('pecas instaladas', (select count(*) from public.line_item_pieces p join public.line_items li on li.id = p.line_item_id join public.work_orders w on w.id = li.work_order_id where w.quote_id = 'e0000000-0000-4000-8000-000000000001' and p.production_status <> 'INSTALADO'), 0);
end $$;

-- =====================================================================
-- 7. Migracao do legado (mesmo total, idempotente, guarda do legado)
--    Roda como a migration roda em producao: sem usuario logado.
-- =====================================================================
select set_config('request.jwt.claims', '', true);

insert into public.quotes (id, customer_id, discount, surcharge)
values ('e0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000001', 10, 5);

insert into public.quote_items (quote_id, sort_order, description, environment, material_id, length_mm, width_mm, quantity, pricing_mode, unit_price, finish, edge)
values
  ('e0000000-0000-4000-8000-000000000009', 1, 'Bancada da pia', 'Cozinha', 'b0000000-0000-4000-8000-000000000001', 2400, 600, 1, 'M2', 620, 'Polido', 'Boleada'),
  ('e0000000-0000-4000-8000-000000000009', 2, 'Soleira', 'cozinha', 'b0000000-0000-4000-8000-000000000002', 800, 150, 24, 'ML', 45.50, null, null),
  ('e0000000-0000-4000-8000-000000000009', 3, 'Furo extra', null, null, 0, 0, 3, 'UN', 99.90, null, null),
  ('e0000000-0000-4000-8000-000000000009', 4, 'Peitoril', 'Sala', null, 1234, 567, 24, 'M2', 620.50, null, null);

-- documento "parado" ha meses: a migracao nao pode mexer no updated_at
alter table public.quotes disable trigger trg_audit_fields;
update public.quotes set updated_at = '2026-01-10 10:00:00-03' where id = 'e0000000-0000-4000-8000-000000000009';
alter table public.quotes enable trigger trg_audit_fields;

do $$
declare
  v_before public.quotes;
  v_after  public.quotes;
begin
  select * into v_before from public.quotes where id = 'e0000000-0000-4000-8000-000000000009';
  perform public.migrate_document('e0000000-0000-4000-8000-000000000009', null);
  select * into v_after from public.quotes where id = 'e0000000-0000-4000-8000-000000000009';
  perform public._t_eq('legado: chave virou', v_after.items_model, 2);
  perform public._t_eq('legado: mesmo subtotal', v_after.subtotal, v_before.subtotal);
  perform public._t_eq('legado: mesmo total', v_after.total, v_before.total);
  perform public._t_eq('legado: updated_at preservado', (v_after.updated_at = v_before.updated_at)::int, 1);
  perform public._t_eq('legado: produtos', (select count(*) from public.line_items where quote_id = v_after.id), 4);
  perform public._t_eq('legado: ambientes (Cozinha/cozinha juntos, Geral, Sala)', (select count(*) from public.environments where quote_id = v_after.id), 3);
  perform public.migrate_document('e0000000-0000-4000-8000-000000000009', null);
  perform public._t_eq('legado: rodar de novo nao duplica', (select count(*) from public.line_items where quote_id = v_after.id), 4);
  perform public._t_eq('legado: especificacoes da peca', (select count(*) from public.line_item_pieces p join public.line_items li on li.id = p.line_item_id
     where li.quote_id = v_after.id and p.specs like 'Acabamento: Polido · Borda: Boleada%'), 1);
end $$;

-- OS legada com producao apontada
insert into public.work_orders (id, customer_id, status_code, discount)
values ('e1000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000001', 'CORTE', 20);
insert into public.work_order_items (id, work_order_id, description, environment, material_id, length_mm, width_mm, quantity, pricing_mode, unit_price, skirt_mm, has_sink, sink_type, sink_quantity, production_status)
values ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000009', 'Bancada', 'Cozinha',
        'b0000000-0000-4000-8000-000000000001', 1500, 600, 1, 'M2', 600, 40, true, 'Embutir', 1, 'PRONTO');
insert into public.production_records (work_order_id, work_order_item_id, step_code, status)
values ('e1000000-0000-4000-8000-000000000009', 'e2000000-0000-4000-8000-000000000001', 'CORTE', 'CONCLUIDO');

do $$
declare
  v_before public.work_orders;
  v_after  public.work_orders;
begin
  select * into v_before from public.work_orders where id = 'e1000000-0000-4000-8000-000000000009';
  perform public.migrate_document(null, 'e1000000-0000-4000-8000-000000000009');
  select * into v_after from public.work_orders where id = 'e1000000-0000-4000-8000-000000000009';
  perform public._t_eq('OS legada: mesmo total', v_after.total_value, v_before.total_value);
  perform public._t_eq('OS legada: Total dos Produtos', v_after.products_total, 540.00);
  perform public._t_eq('OS legada: situacao da peca', (select count(*) from public.line_item_pieces p join public.line_items li on li.id = p.line_item_id
     where li.work_order_id = v_after.id and p.production_status = 'PRONTO'), 1);
  perform public._t_eq('OS legada: saia vira Borda', (select edge_mm from public.line_items where work_order_id = v_after.id), 40);
  perform public._t_eq('OS legada: apontamento aponta a peca', (select count(*) from public.production_records where work_order_id = v_after.id and piece_id is not null), 1);
end $$;

select public._t_as('a0000000-0000-4000-8000-000000000001');
set local role authenticated;
select public._t_error('tela antiga nao grava em documento migrado', $sql$
  insert into public.quote_items (quote_id, description) values ('e0000000-0000-4000-8000-000000000009', 'x') $sql$,
  'Recarregue a página');

-- a funcao antiga (tela antiga no ar) agora aprova com a montagem completa
select public.convert_quote_to_work_order('e0000000-0000-4000-8000-000000000009', null);
do $$ begin
  perform public._t_eq('funcao antiga copia a montagem', (select count(*) from public.line_items li join public.work_orders w on w.id = li.work_order_id where w.quote_id = 'e0000000-0000-4000-8000-000000000009'), 4);
  perform public._t_eq('funcao antiga: total igual', (select w.total_value - q.total from public.work_orders w join public.quotes q on q.id = w.quote_id where q.id = 'e0000000-0000-4000-8000-000000000009'), 0);
end $$;

reset role;
