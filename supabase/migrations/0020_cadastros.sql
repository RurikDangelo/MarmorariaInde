-- =========================================================================
-- 0020 - cadastros da montagem: produtos e servicos, codigo e listas rapidas
--
-- No sistema antigo tudo tinha "Codigo Produto" e a montagem do orcamento
-- puxava de cadastros: o Produto lancado (Pia e Balcao, Soleira...), os
-- Acabamentos (por metro linear), os Servicos, os Produtos para Revenda e os
-- Insumos. Aqui:
--   * public.products (criada na 0003 e nunca usada) vira esse cadastro,
--     separado por "kind";
--   * materials ganha codigo (a busca do antigo e por codigo ou descricao);
--   * lookup_options guarda as listas curtas que a tela deixa cadastrar sem
--     sair dela: nomes de ambiente, validades, previsoes de entrega e formas
--     de pagamento.
-- =========================================================================

-- -------------------------------------------------------------------------
-- tg_set_audit_fields respeita app.preserve_updated_at
--
-- A migracao dos itens antigos (0026) precisa gravar nas OS sem mexer em
-- updated_at; senao o alerta "OS sem movimentacao" some de todas por 7 dias.
-- -------------------------------------------------------------------------
create or replace function public.tg_set_audit_fields()
returns trigger
language plpgsql
as $fn$
begin
  if (tg_op = 'INSERT') then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(new.created_by, auth.uid());
  elsif coalesce(current_setting('app.preserve_updated_at', true), '') = 'on' then
    new.updated_at := old.updated_at;
    new.updated_by := old.updated_by;
    return new;
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$fn$;

-- -------------------------------------------------------------------------
-- Codigo de cadastro (materiais e produtos dividem a mesma numeracao, como
-- o "Codigo Produto" do sistema antigo). Vazio = proximo numero livre.
-- -------------------------------------------------------------------------
create sequence if not exists public.catalog_code_seq start with 1000;

create or replace function public.next_catalog_code()
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_code text;
begin
  loop
    v_code := nextval('public.catalog_code_seq')::text;
    exit when not exists (select 1 from public.materials where code = v_code)
          and not exists (select 1 from public.products where code = v_code);
  end loop;
  return v_code;
end;
$fn$;

create or replace function public.tg_catalog_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  new.code := nullif(btrim(coalesce(new.code, '')), '');
  if new.code is null then
    new.code := public.next_catalog_code();
  end if;
  return new;
end;
$fn$;

revoke all on function public.next_catalog_code() from public, anon, authenticated;
revoke all on sequence public.catalog_code_seq from public, anon, authenticated;

-- ------------------------------------------------------------- materiais
alter table public.materials add column if not exists code text;

create unique index if not exists uq_materials_code on public.materials (code) where code is not null;

drop trigger if exists trg_catalog_code on public.materials;
create trigger trg_catalog_code before insert or update of code on public.materials
  for each row execute function public.tg_catalog_code();

update public.materials m
   set code = public.next_catalog_code()
 where m.code is null;

comment on column public.materials.code is
  'Codigo do material (busca por codigo ou descricao, como no sistema antigo).';

-- ------------------------------------------------ produtos e servicos
alter table public.products add column if not exists code text;
alter table public.products add column if not exists cost numeric(14,2)
  check (cost is null or cost >= 0);

-- dados antigos primeiro, depois as regras novas
update public.products set kind = 'SERVICO' where kind = 'RECORTE';
update public.products set kind = 'REVENDA' where kind = 'ACESSORIO';

alter table public.products drop constraint if exists products_kind_check;
alter table public.products add constraint products_kind_check
  check (kind in ('PRODUTO', 'ACABAMENTO', 'SERVICO', 'REVENDA', 'INSUMO'));

alter table public.products drop constraint if exists products_unit_check;
alter table public.products add constraint products_unit_check
  check (unit in ('M2', 'ML', 'UN', 'PC', 'KG', 'L'));

create unique index if not exists uq_products_code on public.products (code) where code is not null;
create index if not exists idx_products_kind on public.products (kind) where active;
create index if not exists idx_products_name_trgm on public.products using gin (name gin_trgm_ops);

drop trigger if exists trg_catalog_code on public.products;
create trigger trg_catalog_code before insert or update of code on public.products
  for each row execute function public.tg_catalog_code();

update public.products p
   set code = public.next_catalog_code()
 where p.code is null;

comment on table public.products is
  'Produtos e servicos da montagem: PRODUTO (o que se vende: pia, bancada, soleira), '
  'ACABAMENTO (por metro linear), SERVICO, REVENDA (cuba, torneira) e INSUMO (custo, nao compoe o total).';
comment on column public.products.price is 'Valor de venda por unidade.';
comment on column public.products.cost is 'Custo por unidade (insumos e margem).';

-- -------------------------------------------------------------------------
-- Listas rapidas (cadastradas pela propria tela de orcamento/OS)
-- -------------------------------------------------------------------------
create table if not exists public.lookup_options (
  id            uuid primary key default gen_random_uuid(),
  list          text not null check (list in ('AMBIENTE', 'VALIDADE', 'PREVISAO_ENTREGA', 'FORMA_PAGAMENTO')),
  label         text not null check (btrim(label) <> ''),
  days          integer check (days is null or days between 0 and 365),
  business_days boolean not null default false,
  installments  text check (installments is null or installments ~ '^\d{1,3}(/\d{1,3}){0,23}$'),
  sort_order    integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id),
  updated_by    uuid references public.profiles(id)
);

comment on table public.lookup_options is
  'Listas curtas da montagem: nomes de ambiente, validades (dias), previsoes de entrega '
  '(dias corridos ou uteis) e formas de pagamento (dias das parcelas, ex.: 0/30/60).';
comment on column public.lookup_options.installments is
  'Forma de pagamento: dias de cada parcela contados da emissao, separados por barra. 0 = a vista/entrada.';

create unique index if not exists uq_lookup_options_label on public.lookup_options (list, lower(label));
create index if not exists idx_lookup_options_list on public.lookup_options (list, sort_order) where active;

select public.attach_audit_trigger('lookup_options');

insert into public.lookup_options (list, label, sort_order) values
  ('AMBIENTE', 'Cozinha', 10),
  ('AMBIENTE', 'Banheiro', 20),
  ('AMBIENTE', 'Banheiro social', 30),
  ('AMBIENTE', 'Banheiro suíte', 40),
  ('AMBIENTE', 'Lavabo', 50),
  ('AMBIENTE', 'Área de serviço', 60),
  ('AMBIENTE', 'Lavanderia', 70),
  ('AMBIENTE', 'Área gourmet', 80),
  ('AMBIENTE', 'Churrasqueira', 90),
  ('AMBIENTE', 'Sala', 100),
  ('AMBIENTE', 'Quarto', 110),
  ('AMBIENTE', 'Varanda', 120),
  ('AMBIENTE', 'Escada', 130),
  ('AMBIENTE', 'Soleiras e peitoris', 140),
  ('AMBIENTE', 'Hall de entrada', 150),
  ('AMBIENTE', 'Fachada', 160),
  ('AMBIENTE', 'Piscina', 170)
on conflict (list, lower(label)) do nothing;

insert into public.lookup_options (list, label, days, sort_order) values
  ('VALIDADE', '7 dias', 7, 10),
  ('VALIDADE', '10 dias', 10, 20),
  ('VALIDADE', '15 dias', 15, 30),
  ('VALIDADE', '30 dias', 30, 40)
on conflict (list, lower(label)) do nothing;

insert into public.lookup_options (list, label, days, business_days, sort_order) values
  ('PREVISAO_ENTREGA', '10 dias úteis', 10, true, 10),
  ('PREVISAO_ENTREGA', '15 dias úteis', 15, true, 20),
  ('PREVISAO_ENTREGA', '20 dias úteis', 20, true, 30),
  ('PREVISAO_ENTREGA', '30 dias', 30, false, 40)
on conflict (list, lower(label)) do nothing;

insert into public.lookup_options (list, label, installments, sort_order) values
  ('FORMA_PAGAMENTO', 'À vista', '0', 10),
  ('FORMA_PAGAMENTO', '50% de entrada + 50% em 30 dias', '0/30', 20),
  ('FORMA_PAGAMENTO', 'Entrada + 30/60 dias', '0/30/60', 30),
  ('FORMA_PAGAMENTO', '30/60/90 dias', '30/60/90', 40),
  ('FORMA_PAGAMENTO', 'Entrada + 30/60/90 dias', '0/30/60/90', 50)
on conflict (list, lower(label)) do nothing;

-- Leitura para qualquer usuario ativo. Quem monta orcamento/OS pode incluir
-- um item novo na lista sem sair da tela; editar e remover e de quem cuida
-- dos cadastros.
alter table public.lookup_options enable row level security;
drop policy if exists lookup_options_select on public.lookup_options;
drop policy if exists lookup_options_insert on public.lookup_options;
drop policy if exists lookup_options_update on public.lookup_options;
drop policy if exists lookup_options_delete on public.lookup_options;

create policy lookup_options_select on public.lookup_options
  for select to authenticated
  using (public.current_role_code() is not null);

create policy lookup_options_insert on public.lookup_options
  for insert to authenticated
  with check (
    public.has_perm('quotes.write') or public.has_perm('work_orders.write')
    or public.has_perm('stock.write') or public.has_perm('settings.write')
  );

create policy lookup_options_update on public.lookup_options
  for update to authenticated
  using (public.has_perm('stock.write') or public.has_perm('settings.write'))
  with check (public.has_perm('stock.write') or public.has_perm('settings.write'));

create policy lookup_options_delete on public.lookup_options
  for delete to authenticated
  using (public.has_perm('stock.write') or public.has_perm('settings.write'));

-- ---------------------------------------------------- categoria da RT
insert into public.financial_categories (name, kind, color) values
  ('Reserva técnica (RT)', 'DESPESA', 'muted')
on conflict (name, kind) do nothing;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
