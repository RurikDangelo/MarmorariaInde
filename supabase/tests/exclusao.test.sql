-- =========================================================================
-- Excluir de vez e reativar (migration 0027)
--   1. excluir orcamento leva montagem, anexos, fatura e RT junto
--   2. trava: orcamento que ja virou OS
--   3. excluir OS: libera chapa, remove titulo pendente, preserva movimento
--   4. trava: OS com titulo pago
--   5. arquivo usado por outro documento nao entra na lista de orfaos
--   6. permissoes: OPERACIONAL e anon nao excluem
--   7. reativar OS: volta para a etapa anterior e registra na timeline
-- Roda inteiro dentro de uma transacao com rollback (scripts/db-test.mjs).
-- =========================================================================

create function public._t_eq(p_label text, p_got numeric, p_expected numeric)
returns void language plpgsql as $$
begin
  if p_got is distinct from p_expected then
    raise exception '% : esperado %, veio %', p_label, p_expected, p_got;
  end if;
end $$;

create function public._t_txt(p_label text, p_got text, p_expected text)
returns void language plpgsql as $$
begin
  if p_got is distinct from p_expected then
    raise exception '% : esperado "%", veio "%"', p_label, p_expected, p_got;
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
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-000000000002', 'operacional@teste.local');

select public._t_as('a0000000-0000-4000-8000-000000000001');
update public.profiles set role = 'ADMINISTRADOR' where id = 'a0000000-0000-4000-8000-000000000001';
update public.profiles set role = 'OPERACIONAL'   where id = 'a0000000-0000-4000-8000-000000000002';

insert into public.customers (id, name) values ('c0000000-0000-4000-8000-000000000001', 'Cliente Teste');
insert into public.materials (id, name, type_code, price_per_m2, code, thickness_mm)
values ('b0000000-0000-4000-8000-000000000001', 'Gran. Preto São Gabriel', 'GRANITO', 600, '155', 20);

set local role authenticated;

-- =====================================================================
-- 1. excluir orcamento
-- =====================================================================
insert into public.quotes (id, customer_id, items_model)
values ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 2);

select public.save_environment('{"id":"f0000000-0000-4000-8000-000000000001","quote_id":"e0000000-0000-4000-8000-000000000001","name":"cozinha"}');

select public.save_line_item($json${
  "id": "10000000-0000-4000-8000-000000000001",
  "environment_id": "f0000000-0000-4000-8000-000000000001",
  "description": "Pia e Balcão", "quantity": 1, "unit": "M2",
  "drawing_path": "orcamentos/e0000000/desenho.png",
  "materials": [
    {"id": "11000000-0000-4000-8000-000000000001", "material_id": "b0000000-0000-4000-8000-000000000001",
     "price_per_m2": 600, "price_overridden": false}
  ],
  "pieces": [
    {"id": "12000000-0000-4000-8000-000000000001", "line_item_material_id": "11000000-0000-4000-8000-000000000001",
     "number": "1", "quantity": 1, "length_mm": 2100, "width_mm": 600}
  ]
}$json$::jsonb);

insert into public.quote_attachments (quote_id, file_name, storage_path)
values ('e0000000-0000-4000-8000-000000000001', 'proposta.pdf', 'orcamentos/e0000000/proposta.pdf');

select public.save_quote_installments('e0000000-0000-4000-8000-000000000001',
  jsonb_build_array(jsonb_build_object('number', 1, 'due_date', (current_date + 30)::text, 'amount', 1000)));

select public.save_technical_reserve('{"quote_id":"e0000000-0000-4000-8000-000000000001","professional_name":"Arq. Teste","percentage":5}');

do $$
declare v_out jsonb;
begin
  v_out := public.delete_quote('e0000000-0000-4000-8000-000000000001', 'orçamento duplicado');

  perform public._t_eq('orcamento excluido',
    (select count(*) from public.quotes where id = 'e0000000-0000-4000-8000-000000000001'), 0);
  perform public._t_eq('ambientes foram junto',
    (select count(*) from public.environments where quote_id = 'e0000000-0000-4000-8000-000000000001'), 0);
  perform public._t_eq('produtos foram junto',
    (select count(*) from public.line_items where quote_id = 'e0000000-0000-4000-8000-000000000001'), 0);
  perform public._t_eq('pecas foram junto',
    (select count(*) from public.line_item_pieces where line_item_id = '10000000-0000-4000-8000-000000000001'), 0);
  perform public._t_eq('fatura foi junto',
    (select count(*) from public.quote_installments where quote_id = 'e0000000-0000-4000-8000-000000000001'), 0);
  perform public._t_eq('RT foi junto',
    (select count(*) from public.technical_reserves where quote_id = 'e0000000-0000-4000-8000-000000000001'), 0);
  perform public._t_eq('anexo foi junto',
    (select count(*) from public.quote_attachments where quote_id = 'e0000000-0000-4000-8000-000000000001'), 0);

  perform public._t_eq('arquivos orfaos devolvidos', jsonb_array_length(v_out->'files'), 2);
  perform public._t_eq('auditoria registrou a exclusao',
    (select count(*) from public.audit_logs
      where table_name = 'quotes' and record_id = 'e0000000-0000-4000-8000-000000000001' and action = 'DELETE'), 1);
  perform public._t_txt('auditoria guardou o motivo',
    (select changes->>'motivo' from public.audit_logs
      where record_id = 'e0000000-0000-4000-8000-000000000001' and action = 'DELETE'), 'orçamento duplicado');
end $$;

-- =====================================================================
-- 2. orcamento que virou OS nao e excluido
-- =====================================================================
insert into public.quotes (id, customer_id, items_model)
values ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 2);
insert into public.work_orders (id, customer_id, status_code, quote_id)
values ('a1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'NOVA',
        'e0000000-0000-4000-8000-000000000002');

select public._t_error('orcamento que virou OS',
  $$select public.delete_quote('e0000000-0000-4000-8000-000000000002')$$, 'já virou');

do $$ begin
  perform public._t_eq('orcamento que virou OS continua la',
    (select count(*) from public.quotes where id = 'e0000000-0000-4000-8000-000000000002'), 1);
end $$;

-- =====================================================================
-- 3. excluir OS
-- =====================================================================
insert into public.work_orders (id, customer_id, status_code)
values ('a2000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'CORTE');

select public.save_environment('{"id":"f0000000-0000-4000-8000-000000000002","work_order_id":"a2000000-0000-4000-8000-000000000001","name":"cozinha"}');

select public.save_line_item($json${
  "id": "10000000-0000-4000-8000-000000000002",
  "environment_id": "f0000000-0000-4000-8000-000000000002",
  "description": "Bancada", "quantity": 1, "unit": "M2",
  "materials": [
    {"id": "11000000-0000-4000-8000-000000000002", "material_id": "b0000000-0000-4000-8000-000000000001",
     "price_per_m2": 600, "price_overridden": false}
  ],
  "pieces": [
    {"id": "12000000-0000-4000-8000-000000000002", "line_item_material_id": "11000000-0000-4000-8000-000000000002",
     "number": "1", "quantity": 1, "length_mm": 1200, "width_mm": 600}
  ]
}$json$::jsonb);

insert into public.work_order_attachments (work_order_id, file_name, storage_path)
values ('a2000000-0000-4000-8000-000000000001', 'foto.jpg', 'ordens/a2000000/foto.jpg');
insert into public.work_order_photos (work_order_id, storage_path)
values ('a2000000-0000-4000-8000-000000000001', 'ordens/a2000000/antes.jpg');
insert into public.work_order_measurements (id, work_order_id, status)
values ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'AGENDADA');
insert into public.installations (work_order_id, status)
values ('a2000000-0000-4000-8000-000000000001', 'AGENDADA');
insert into public.production_records (work_order_id, step_code, status)
values ('a2000000-0000-4000-8000-000000000001', 'CORTE', 'EM_ANDAMENTO');

insert into public.stock_items (id, material_id, kind, status, length_mm, width_mm, thickness_mm, reserved_work_order_id)
values ('a4000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'CHAPA', 'RESERVADA',
        3200, 1900, 20, 'a2000000-0000-4000-8000-000000000001');
insert into public.stock_movements (stock_item_id, work_order_id, movement_type)
values ('a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'RESERVA');

insert into public.financial_transactions (description, kind, amount, due_date, status, work_order_id)
values ('Entrada da OS', 'RECEITA', 500, current_date + 5, 'PENDENTE', 'a2000000-0000-4000-8000-000000000001');

do $$
declare v_out jsonb;
begin
  v_out := public.delete_work_order('a2000000-0000-4000-8000-000000000001', 'OS de teste');

  perform public._t_eq('OS excluida',
    (select count(*) from public.work_orders where id = 'a2000000-0000-4000-8000-000000000001'), 0);
  perform public._t_eq('montagem foi junto',
    (select count(*) from public.line_items where work_order_id = 'a2000000-0000-4000-8000-000000000001'), 0);
  perform public._t_eq('medicao foi junto',
    (select count(*) from public.work_order_measurements where id = 'a3000000-0000-4000-8000-000000000001'), 0);
  perform public._t_eq('producao foi junto',
    (select count(*) from public.production_records where work_order_id = 'a2000000-0000-4000-8000-000000000001'), 0);
  perform public._t_eq('titulo pendente foi junto',
    (select count(*) from public.financial_transactions where work_order_id = 'a2000000-0000-4000-8000-000000000001'), 0);

  perform public._t_txt('chapa voltou para disponivel',
    (select status from public.stock_items where id = 'a4000000-0000-4000-8000-000000000001'), 'DISPONIVEL');
  perform public._t_eq('chapa sem reserva',
    (select count(*) from public.stock_items
      where id = 'a4000000-0000-4000-8000-000000000001' and reserved_work_order_id is null), 1);
  perform public._t_eq('movimento de estoque continua no historico',
    (select count(*) from public.stock_movements
      where stock_item_id = 'a4000000-0000-4000-8000-000000000001' and work_order_id is null), 1);

  perform public._t_eq('arquivos orfaos da OS', jsonb_array_length(v_out->'files'), 2);
  perform public._t_eq('auditoria registrou a OS',
    (select count(*) from public.audit_logs
      where table_name = 'work_orders' and record_id = 'a2000000-0000-4000-8000-000000000001' and action = 'DELETE'), 1);
end $$;

-- =====================================================================
-- 4. OS com dinheiro recebido nao e excluida
-- =====================================================================
insert into public.work_orders (id, customer_id, status_code)
values ('a2000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'NOVA');
insert into public.financial_transactions (description, kind, amount, due_date, status, paid_at, work_order_id)
values ('Entrada paga', 'RECEITA', 800, current_date, 'PAGO', now(), 'a2000000-0000-4000-8000-000000000002');

select public._t_error('OS com titulo pago',
  $$select public.delete_work_order('a2000000-0000-4000-8000-000000000002')$$, 'já baixado');

do $$ begin
  perform public._t_eq('OS com pagamento continua la',
    (select count(*) from public.work_orders where id = 'a2000000-0000-4000-8000-000000000002'), 1);
  perform public._t_eq('titulo pago intacto',
    (select count(*) from public.financial_transactions
      where work_order_id = 'a2000000-0000-4000-8000-000000000002'), 1);
end $$;

-- =====================================================================
-- 5. arquivo usado pela OS nao entra na lista de orfaos do orcamento
-- =====================================================================
insert into public.quotes (id, customer_id, items_model)
values ('e0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 2);
select public.save_environment('{"id":"f0000000-0000-4000-8000-000000000003","quote_id":"e0000000-0000-4000-8000-000000000003","name":"cozinha"}');
select public.save_line_item($json${
  "id": "10000000-0000-4000-8000-000000000003",
  "environment_id": "f0000000-0000-4000-8000-000000000003",
  "description": "Bancada", "quantity": 1, "unit": "M2",
  "drawing_path": "compartilhado/desenho.png",
  "materials": [], "pieces": []
}$json$::jsonb);

insert into public.work_orders (id, customer_id, status_code)
values ('a2000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'NOVA');
select public.save_environment('{"id":"f0000000-0000-4000-8000-000000000004","work_order_id":"a2000000-0000-4000-8000-000000000003","name":"cozinha"}');
select public.save_line_item($json${
  "id": "10000000-0000-4000-8000-000000000004",
  "environment_id": "f0000000-0000-4000-8000-000000000004",
  "description": "Bancada", "quantity": 1, "unit": "M2",
  "drawing_path": "compartilhado/desenho.png",
  "materials": [], "pieces": []
}$json$::jsonb);

do $$
declare v_out jsonb;
begin
  v_out := public.delete_quote('e0000000-0000-4000-8000-000000000003');
  perform public._t_eq('desenho usado pela OS nao vira orfao', jsonb_array_length(v_out->'files'), 0);
end $$;

-- =====================================================================
-- 6. permissoes
-- =====================================================================
insert into public.work_orders (id, customer_id, status_code)
values ('a2000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'NOVA');
insert into public.quotes (id, customer_id, items_model)
values ('e0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 2);

select public._t_as('a0000000-0000-4000-8000-000000000002');

select public._t_error('OPERACIONAL nao exclui OS',
  $$select public.delete_work_order('a2000000-0000-4000-8000-000000000004')$$, 'permissão');
select public._t_error('OPERACIONAL nao exclui orcamento',
  $$select public.delete_quote('e0000000-0000-4000-8000-000000000004')$$, 'permissão');
select public._t_error('OPERACIONAL nao reativa OS',
  $$select public.reactivate_work_order('a2000000-0000-4000-8000-000000000004')$$, 'permissão');

delete from public.work_orders where id = 'a2000000-0000-4000-8000-000000000004';
delete from public.quotes where id = 'e0000000-0000-4000-8000-000000000004';

do $$ begin
  perform public._t_eq('RLS barra o delete direto da OS',
    (select count(*) from public.work_orders where id = 'a2000000-0000-4000-8000-000000000004'), 1);
  perform public._t_eq('RLS barra o delete direto do orcamento',
    (select count(*) from public.quotes where id = 'e0000000-0000-4000-8000-000000000004'), 1);
end $$;

set local role anon;
select public._t_error('anon nao executa exclusao',
  $$select public.delete_work_order('a2000000-0000-4000-8000-000000000004')$$, 'permission denied');
set local role authenticated;
select public._t_as('a0000000-0000-4000-8000-000000000001');

-- =====================================================================
-- 7. reativar a OS cancelada
-- =====================================================================
insert into public.work_orders (id, customer_id, status_code)
values ('a2000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'NOVA');

update public.work_orders set status_code = 'ACABAMENTO' where id = 'a2000000-0000-4000-8000-000000000005';
update public.work_orders
   set status_code = 'CANCELADA', cancelled_at = now(), cancel_reason = 'cliente desistiu'
 where id = 'a2000000-0000-4000-8000-000000000005';

do $$
declare v_status text;
begin
  v_status := public.reactivate_work_order('a2000000-0000-4000-8000-000000000005');

  perform public._t_txt('reativar devolve a etapa anterior', v_status, 'ACABAMENTO');
  perform public._t_eq('OS reativada sem cancelamento',
    (select count(*) from public.work_orders
      where id = 'a2000000-0000-4000-8000-000000000005'
        and cancelled_at is null and cancel_reason is null and status_code = 'ACABAMENTO'), 1);
  perform public._t_eq('timeline registra a reativacao',
    (select count(*) from public.work_order_history
      where work_order_id = 'a2000000-0000-4000-8000-000000000005' and event_type = 'REATIVACAO'), 1);

  -- chamar de novo em OS que nao esta cancelada nao muda nada
  perform public._t_txt('reativar OS ativa nao muda a etapa',
    public.reactivate_work_order('a2000000-0000-4000-8000-000000000005'), 'ACABAMENTO');
end $$;

-- OS cancelada sem historico de etapa volta para a primeira
insert into public.work_orders (id, customer_id, status_code, cancelled_at, cancel_reason)
values ('a2000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'CANCELADA', now(), 'teste');

do $$ begin
  perform public._t_txt('sem historico volta para NOVA',
    public.reactivate_work_order('a2000000-0000-4000-8000-000000000006'), 'NOVA');
end $$;
