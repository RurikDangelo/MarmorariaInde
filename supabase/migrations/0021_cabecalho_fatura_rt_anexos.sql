-- =========================================================================
-- 0021 - cabecalho do orcamento/OS no padrao do sistema antigo, fatura,
--        reserva tecnica (RT) e anexos do orcamento
--
-- items_model marca qual montagem o documento usa:
--   1 = itens antigos (quote_items / work_order_items), intocados
--   2 = montagem nova (ambientes > produtos > materiais, pecas e composicao)
-- O default continua 1 enquanto o codigo antigo estiver no ar; o codigo novo
-- grava 2 e a 0026 migra o que ja existe.
-- =========================================================================

-- -------------------------------------------------------------- orcamento
alter table public.quotes
  add column if not exists seller_id uuid references public.profiles(id) on delete set null,
  add column if not exists site_details text,
  add column if not exists payment_type text not null default 'A_VISTA'
    check (payment_type in ('A_VISTA', 'A_PRAZO')),
  add column if not exists payment_method text
    check (payment_method in ('DINHEIRO','PIX','DEBITO','CREDITO','BOLETO','TRANSFERENCIA','CHEQUE','OUTRO')),
  add column if not exists payment_terms text,
  add column if not exists validity_days integer check (validity_days is null or validity_days between 0 and 365),
  add column if not exists delivery_term text,
  add column if not exists delivery_days integer check (delivery_days is null or delivery_days between 0 and 365),
  add column if not exists delivery_date date,
  add column if not exists freight numeric(14,2) not null default 0 check (freight >= 0),
  add column if not exists items_model smallint not null default 1 check (items_model in (1, 2));

comment on column public.quotes.subtotal  is 'Total dos Produtos (soma dos itens).';
comment on column public.quotes.surcharge is 'Outras Despesas.';
comment on column public.quotes.freight   is 'Frete.';
comment on column public.quotes.site_details is 'Dados da Obra.';
comment on column public.quotes.seller_id is 'Vendedor.';
comment on column public.quotes.items_model is '1 = itens antigos, 2 = montagem por ambientes/produtos.';

create index if not exists idx_quotes_seller on public.quotes(seller_id);

-- --------------------------------------------------------------------- OS
alter table public.work_orders
  add column if not exists seller_id uuid references public.profiles(id) on delete set null,
  add column if not exists site_details text,
  add column if not exists payment_type text not null default 'A_VISTA'
    check (payment_type in ('A_VISTA', 'A_PRAZO')),
  add column if not exists payment_method text
    check (payment_method in ('DINHEIRO','PIX','DEBITO','CREDITO','BOLETO','TRANSFERENCIA','CHEQUE','OUTRO')),
  add column if not exists payment_terms text,
  add column if not exists freight numeric(14,2) not null default 0 check (freight >= 0),
  add column if not exists surcharge numeric(14,2) not null default 0 check (surcharge >= 0),
  add column if not exists products_total numeric(14,2) not null default 0,
  add column if not exists items_model smallint not null default 1 check (items_model in (1, 2));

comment on column public.work_orders.products_total is 'Total dos Produtos (soma dos itens da montagem).';
comment on column public.work_orders.surcharge is 'Outras Despesas.';
comment on column public.work_orders.freight   is 'Frete.';

-- -------------------------------------------------------------------------
-- Totais: Produtos + Frete + Outras Despesas - Desconto.
-- Aritmetica pura sobre colunas gravadas: mover a OS no Kanban nao soma nada.
-- So vale para a montagem nova; o legado segue com os triggers da 0004.
-- -------------------------------------------------------------------------
create or replace function public.tg_quote_totals()
returns trigger
language plpgsql
as $fn$
begin
  if new.items_model = 2 then
    new.total := round(coalesce(new.subtotal, 0) + coalesce(new.freight, 0)
                       + coalesce(new.surcharge, 0) - coalesce(new.discount, 0), 2);
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_quote_totals on public.quotes;
create trigger trg_quote_totals before insert or update on public.quotes
  for each row execute function public.tg_quote_totals();

create or replace function public.tg_work_order_totals()
returns trigger
language plpgsql
as $fn$
begin
  if new.items_model = 2 then
    new.total_value := round(coalesce(new.products_total, 0) + coalesce(new.freight, 0)
                             + coalesce(new.surcharge, 0) - coalesce(new.discount, 0), 2);
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_work_order_totals on public.work_orders;
create trigger trg_work_order_totals before insert or update on public.work_orders
  for each row execute function public.tg_work_order_totals();

-- -------------------------------------------------------------------------
-- Orcamento aprovado e o que foi vendido.
--   * entrar ou sair de APROVADO so pela funcao de aprovacao;
--   * depois de aprovado, cliente, valores e prazos nao mudam mais.
-- As funcoes internas (aprovacao, migracao) ligam app.system_write durante a
-- propria transacao. Scripts do banco (seed, migrations) rodam sem usuario.
-- A API nao consegue ligar esse flag: PostgREST so expoe o schema public.
-- -------------------------------------------------------------------------
create or replace function public.tg_quote_status_guard()
returns trigger
language plpgsql
as $fn$
begin
  if auth.uid() is null or coalesce(current_setting('app.system_write', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'APROVADO' then
      raise exception 'Um orçamento só fica aprovado pelo botão "Aprovar e gerar OS".'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status and (new.status = 'APROVADO' or old.status = 'APROVADO') then
    raise exception 'Um orçamento só fica aprovado pelo botão "Aprovar e gerar OS", e depois de aprovado não volta atrás.'
      using errcode = '42501';
  end if;

  if old.status = 'APROVADO' and (
       new.customer_id, new.subtotal, new.discount, new.surcharge, new.freight, new.total,
       new.issue_date, new.valid_until, new.delivery_date, new.payment_type, new.payment_method, new.payment_terms
     ) is distinct from (
       old.customer_id, old.subtotal, old.discount, old.surcharge, old.freight, old.total,
       old.issue_date, old.valid_until, old.delivery_date, old.payment_type, old.payment_method, old.payment_terms
     ) then
    raise exception 'Este orçamento já foi aprovado e não pode ser alterado. Faça as mudanças na OS.'
      using errcode = '42501';
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_quote_status_guard on public.quotes;
create trigger trg_quote_status_guard before insert or update on public.quotes
  for each row execute function public.tg_quote_status_guard();

-- -------------------------------------------------------------------------
-- Fatura do orcamento: parcelas (Titulo, Vencimento, Valor, Especie).
-- Na aprovacao viram contas a receber da OS.
-- -------------------------------------------------------------------------
create table if not exists public.quote_installments (
  id             uuid primary key default gen_random_uuid(),
  quote_id       uuid not null references public.quotes(id) on delete cascade,
  number         integer not null check (number > 0),
  due_date       date not null,
  amount         numeric(14,2) not null check (amount >= 0),
  payment_method text check (payment_method in ('DINHEIRO','PIX','DEBITO','CREDITO','BOLETO','TRANSFERENCIA','CHEQUE','OUTRO')),
  notes          text,
  financial_transaction_id uuid references public.financial_transactions(id) on delete set null,
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles(id),
  updated_by     uuid references public.profiles(id),
  constraint quote_installments_number_key unique (quote_id, number) deferrable initially immediate
);

comment on table public.quote_installments is
  'Fatura do orcamento. Na aprovacao cada parcela pode virar uma conta a receber da OS.';

select public.attach_audit_trigger('quote_installments');

-- -------------------------------------------------------------------------
-- RT (reserva tecnica): comissao do arquiteto/designer que indicou a venda.
-- E custo da marmoraria, nao entra no total cobrado do cliente.
-- -------------------------------------------------------------------------
create table if not exists public.technical_reserves (
  id                    uuid primary key default gen_random_uuid(),
  quote_id              uuid references public.quotes(id) on delete cascade,
  work_order_id         uuid references public.work_orders(id) on delete cascade,
  professional_name     text not null check (btrim(professional_name) <> ''),
  professional_phone    text,
  professional_document text,
  pix_key               text,
  percentage            numeric(5,2) check (percentage is null or percentage between 0 and 100),
  amount                numeric(14,2) not null default 0 check (amount >= 0),
  notes                 text,
  financial_transaction_id uuid references public.financial_transactions(id) on delete set null,
  is_demo               boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references public.profiles(id),
  updated_by            uuid references public.profiles(id),
  constraint technical_reserves_owner_check check (num_nonnulls(quote_id, work_order_id) = 1)
);

comment on table public.technical_reserves is
  'RT do profissional que indicou a venda. Com percentual, o valor acompanha o total do documento.';

create index if not exists idx_technical_reserves_quote on public.technical_reserves(quote_id);
create index if not exists idx_technical_reserves_wo on public.technical_reserves(work_order_id);

select public.attach_audit_trigger('technical_reserves');

-- O valor da RT com percentual acompanha o total do documento.
create or replace function public.tg_document_total_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_table_name = 'quotes' then
    update public.technical_reserves r
       set amount = round(new.total * r.percentage / 100, 2)
     where r.quote_id = new.id
       and r.percentage is not null
       and r.financial_transaction_id is null
       and r.amount is distinct from round(new.total * r.percentage / 100, 2);
  else
    update public.technical_reserves r
       set amount = round(new.total_value * r.percentage / 100, 2)
     where r.work_order_id = new.id
       and r.percentage is not null
       and r.financial_transaction_id is null
       and r.amount is distinct from round(new.total_value * r.percentage / 100, 2);
  end if;
  return null;
end;
$fn$;

drop trigger if exists trg_quote_total_changed on public.quotes;
create trigger trg_quote_total_changed after update on public.quotes
  for each row when (old.total is distinct from new.total)
  execute function public.tg_document_total_changed();

drop trigger if exists trg_work_order_total_changed on public.work_orders;
create trigger trg_work_order_total_changed after update on public.work_orders
  for each row when (old.total_value is distinct from new.total_value)
  execute function public.tg_document_total_changed();

-- -------------------------------------------------------------------------
-- Arquivos anexos do orcamento. Os arquivos ficam no bucket os-arquivos, na
-- pasta orcamentos/<numero>/, para a OS gerada enxergar os mesmos arquivos
-- sem copiar nada.
-- -------------------------------------------------------------------------
create table if not exists public.quote_attachments (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references public.quotes(id) on delete cascade,
  file_name    text not null,
  storage_path text not null,
  mime_type    text,
  size_bytes   bigint,
  kind         text not null default 'DOCUMENTO'
               check (kind in ('DOCUMENTO','CROQUI','PROJETO','COMPROVANTE','CONTRATO','OUTRO')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles(id),
  updated_by   uuid references public.profiles(id)
);

create index if not exists idx_quote_attachments_quote on public.quote_attachments(quote_id);

select public.attach_audit_trigger('quote_attachments');
select public.apply_standard_rls('quote_attachments', 'quotes');

drop policy if exists storage_orcamentos_read on storage.objects;
drop policy if exists storage_orcamentos_write on storage.objects;
drop policy if exists storage_orcamentos_update on storage.objects;
drop policy if exists storage_orcamentos_delete on storage.objects;

create policy storage_orcamentos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'os-arquivos' and (storage.foldername(name))[1] = 'orcamentos'
         and public.has_perm('quotes.read'));
create policy storage_orcamentos_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'os-arquivos' and (storage.foldername(name))[1] = 'orcamentos'
              and public.has_perm('quotes.write'));
create policy storage_orcamentos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'os-arquivos' and (storage.foldername(name))[1] = 'orcamentos'
         and public.has_perm('quotes.write'));
create policy storage_orcamentos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'os-arquivos' and (storage.foldername(name))[1] = 'orcamentos'
         and public.has_perm('quotes.write'));

-- Parcelas e RT so mudam pelas funcoes de gravacao (0024), que validam o
-- documento; pela API e somente leitura.
alter table public.quote_installments enable row level security;
drop policy if exists quote_installments_select on public.quote_installments;
create policy quote_installments_select on public.quote_installments
  for select to authenticated using (public.has_perm('quotes.read'));

alter table public.technical_reserves enable row level security;
drop policy if exists technical_reserves_select on public.technical_reserves;
create policy technical_reserves_select on public.technical_reserves
  for select to authenticated
  using ((quote_id is not null and public.has_perm('quotes.read'))
         or (work_order_id is not null and public.has_perm('work_orders.read')));

select public.attach_audit_log_trigger('quotes');
select public.attach_audit_log_trigger('technical_reserves');

revoke all on all tables in schema public from anon;
