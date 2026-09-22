-- =========================================================================
-- 0022 - tabelas da montagem (mesma estrutura do sistema antigo)
--
--   Ambiente (1 - Cozinha)
--     └─ Produto lancado (Pia e Balcao, Quant. 1, Unid. M2)
--          ├─ Materiais   (Gran. Preto Sao Gabriel, Valor por M2)
--          │    └─ Pecas  (Peca 1: 1 Pc 2,10 x 0,60, % Perda)
--          └─ Composicao  (Acabamentos, Servicos, Revendas, Insumos)
--
-- Cada linha pertence a um orcamento OU a uma OS (quote_id XOR work_order_id).
-- Na aprovacao o orcamento inteiro e copiado para a OS (0025).
--
-- Medidas em milimetros. A composicao vale para 1 unidade do produto e e
-- multiplicada pela Quant. do produto. Tudo que e calculado (m2 e valores)
-- e mantido pelo banco (0023); a API so le estas tabelas — gravar e sempre
-- pelas funcoes da 0024.
-- =========================================================================

-- -------------------------------------------------------------- ambientes
create table if not exists public.environments (
  id            uuid primary key default gen_random_uuid(),
  quote_id      uuid references public.quotes(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete cascade,
  number        integer not null check (number > 0),
  name          text not null check (btrim(name) <> ''),
  description   text,
  sort_order    integer not null default 0,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id),
  updated_by    uuid references public.profiles(id),
  constraint environments_owner_check check (num_nonnulls(quote_id, work_order_id) = 1),
  constraint environments_quote_number_key unique (quote_id, number) deferrable initially immediate,
  constraint environments_wo_number_key unique (work_order_id, number) deferrable initially immediate,
  constraint environments_id_quote_key unique (id, quote_id),
  constraint environments_id_wo_key unique (id, work_order_id)
);

comment on table public.environments is
  'Ambientes do orcamento/OS (Cozinha, Banheiro...). Item nº, Nome do Ambiente e Descricao.';

create index if not exists idx_environments_quote on public.environments(quote_id);
create index if not exists idx_environments_wo on public.environments(work_order_id);

-- ------------------------------------------------------ produtos lancados
create table if not exists public.line_items (
  id              uuid primary key default gen_random_uuid(),
  quote_id        uuid references public.quotes(id) on delete cascade,
  work_order_id   uuid references public.work_orders(id) on delete cascade,
  environment_id  uuid not null,
  product_id      uuid references public.products(id) on delete set null,
  code            text,
  description     text not null check (btrim(description) <> ''),
  complement      text,
  quantity        numeric(10,2) not null default 1 check (quantity > 0),
  unit            text not null default 'M2' check (unit in ('M2','ML','UN','PC','KG','L')),
  length_mm       integer check (length_mm is null or length_mm >= 0),
  width_mm        integer check (width_mm is null or width_mm >= 0),
  edge_mm         integer check (edge_mm is null or edge_mm >= 0),
  backsplash_mm   integer check (backsplash_mm is null or backsplash_mm >= 0),
  foot_mm         integer check (foot_mm is null or foot_mm >= 0),
  drawing_path    text,
  notes           text,
  sort_order      integer not null default 0,
  version         integer not null default 1,
  -- mantidos pelo banco (0023), ja multiplicados pela quantidade
  materials_area_m2 numeric(14,4) not null default 0,
  materials_total   numeric(14,2) not null default 0,
  finishes_total    numeric(14,2) not null default 0,
  services_total    numeric(14,2) not null default 0,
  resale_total      numeric(14,2) not null default 0,
  supplies_total    numeric(14,2) not null default 0,
  total             numeric(14,2) not null default 0,
  legacy_quote_item_id      uuid unique,
  legacy_work_order_item_id uuid unique,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id),
  updated_by      uuid references public.profiles(id),
  constraint line_items_owner_check check (num_nonnulls(quote_id, work_order_id) = 1),
  -- o ambiente precisa ser do mesmo documento (MATCH SIMPLE ignora o dono nulo)
  constraint line_items_env_quote_fk foreign key (environment_id, quote_id)
    references public.environments (id, quote_id) on delete cascade,
  constraint line_items_env_wo_fk foreign key (environment_id, work_order_id)
    references public.environments (id, work_order_id) on delete cascade
);

comment on table public.line_items is
  'Produto lancado no ambiente (grade "Produtos" do sistema antigo). Totais mantidos pelo banco.';
comment on column public.line_items.edge_mm is 'Borda (altura da saia).';
comment on column public.line_items.backsplash_mm is 'Rodabanca (altura).';
comment on column public.line_items.foot_mm is 'Pe (altura).';
comment on column public.line_items.total is
  'Total Geral do Item = materiais + acabamentos + servicos + revendas (insumos nao compoem).';
comment on column public.line_items.version is 'Aumenta a cada gravacao; protege contra edicao simultanea.';

create index if not exists idx_line_items_quote on public.line_items(quote_id);
create index if not exists idx_line_items_wo on public.line_items(work_order_id);
create index if not exists idx_line_items_env on public.line_items(environment_id);

-- --------------------------------------------------- materiais do produto
create table if not exists public.line_item_materials (
  id                 uuid primary key default gen_random_uuid(),
  line_item_id       uuid not null references public.line_items(id) on delete cascade,
  material_id        uuid references public.materials(id) on delete set null,
  code               text,
  description        text not null check (btrim(description) <> ''),
  thickness_mm       integer,
  price_per_m2       numeric(14,2) not null default 0 check (price_per_m2 >= 0),
  price_overridden   boolean not null default false,
  -- mantidos pelo banco (0023)
  area_m2            numeric(14,4) not null default 0,
  area_with_waste_m2 numeric(14,4) not null default 0,
  total_area_m2      numeric(14,4) not null default 0,
  total_value        numeric(14,2) not null default 0,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references public.profiles(id),
  updated_by         uuid references public.profiles(id),
  constraint line_item_materials_item_key unique (line_item_id, id)
);

comment on table public.line_item_materials is 'Materiais do produto (aba Materiais).';
comment on column public.line_item_materials.price_overridden is
  'Cadeado aberto: o Valor por M2 foi alterado a mao e nao segue mais o cadastro.';
comment on column public.line_item_materials.area_m2 is 'Soma do Total M2 das pecas (1 unidade do produto).';
comment on column public.line_item_materials.area_with_waste_m2 is
  'Quantidade M2: soma do Total com Perda das pecas (1 unidade do produto).';
comment on column public.line_item_materials.total_area_m2 is 'QTD M2 Total = Quantidade M2 x Quant. do produto.';
comment on column public.line_item_materials.total_value is 'Valor Total = QTD M2 Total x Valor por M2.';

create index if not exists idx_li_materials_item on public.line_item_materials(line_item_id);
create index if not exists idx_li_materials_material on public.line_item_materials(material_id);

-- ------------------------------------------------------------------ pecas
create table if not exists public.line_item_pieces (
  id                    uuid primary key default gen_random_uuid(),
  line_item_id          uuid not null references public.line_items(id) on delete cascade,
  line_item_material_id uuid,
  number                text,
  name                  text,
  quantity              numeric(10,2) not null default 1 check (quantity > 0),
  length_mm             integer not null default 0 check (length_mm >= 0),
  width_mm              integer not null default 0 check (width_mm >= 0),
  waste_pct             numeric(5,2) not null default 0 check (waste_pct between 0 and 100),
  area_m2               numeric(14,4) generated always as (
                          round(quantity * length_mm * width_mm / 1000000.0, 4)
                        ) stored,
  area_with_waste_m2    numeric(14,4) generated always as (
                          round(round(quantity * length_mm * width_mm / 1000000.0, 4) * (1 + waste_pct / 100), 4)
                        ) stored,
  label_count           integer not null default 1 check (label_count between 0 and 999),
  specs                 text,
  production_status     text not null default 'PENDENTE'
                        check (production_status in ('PENDENTE','EM_PRODUCAO','PRONTO','INSTALADO','RETRABALHO')),
  sort_order            integer not null default 0,
  legacy_work_order_item_id uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references public.profiles(id),
  updated_by            uuid references public.profiles(id),
  -- a peca so aponta material do proprio produto; remover o material solta a peca
  constraint line_item_pieces_material_fk foreign key (line_item_id, line_item_material_id)
    references public.line_item_materials (line_item_id, id) on delete set null (line_item_material_id)
);

comment on table public.line_item_pieces is
  'Pecas do produto (aba Pecas): medidas, % Perda, identificacao e etiquetas. m2 calculado pelo banco.';
comment on column public.line_item_pieces.area_m2 is 'Total M2 = Quantidade x Comprimento x Largura.';
comment on column public.line_item_pieces.area_with_waste_m2 is 'Total com Perda M2.';
comment on column public.line_item_pieces.label_count is 'QTD de Etiquetas a imprimir para a producao.';

create index if not exists idx_li_pieces_item on public.line_item_pieces(line_item_id);
create index if not exists idx_li_pieces_material on public.line_item_pieces(line_item_material_id);
create index if not exists idx_li_pieces_legacy on public.line_item_pieces(legacy_work_order_item_id)
  where legacy_work_order_item_id is not null;

-- -------------------------------- acabamentos, servicos, revendas, insumos
create table if not exists public.line_item_components (
  id               uuid primary key default gen_random_uuid(),
  line_item_id     uuid not null references public.line_items(id) on delete cascade,
  kind             text not null check (kind in ('ACABAMENTO','SERVICO','REVENDA','INSUMO')),
  product_id       uuid references public.products(id) on delete set null,
  code             text,
  description      text not null check (btrim(description) <> ''),
  unit             text not null default 'UN' check (unit in ('M2','ML','UN','PC','KG','L')),
  quantity         numeric(14,4) not null default 1 check (quantity >= 0),
  unit_price       numeric(14,2) not null default 0 check (unit_price >= 0),
  price_overridden boolean not null default false,
  -- mantidos pelo banco (0023)
  total_quantity   numeric(14,4) not null default 0,
  total_value      numeric(14,2) not null default 0,
  notes            text,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references public.profiles(id),
  updated_by       uuid references public.profiles(id)
);

comment on table public.line_item_components is
  'Composicao do produto: Acabamentos, Servicos, Revendas e Insumos (insumo e custo, nao compoe o total).';

create index if not exists idx_li_components_item on public.line_item_components(line_item_id);

select public.attach_audit_trigger('environments');
select public.attach_audit_trigger('line_items');
select public.attach_audit_trigger('line_item_materials');
select public.attach_audit_trigger('line_item_pieces');
select public.attach_audit_trigger('line_item_components');

-- -------------------------------------------------------------------------
-- RLS: somente leitura pela API. Orcamento -> quotes.read, OS -> work_orders.read.
-- -------------------------------------------------------------------------
create or replace function public.can_read_line_item(p_line_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
      from public.line_items li
     where li.id = p_line_item_id
       and ((li.quote_id is not null and public.has_perm('quotes.read'))
         or (li.work_order_id is not null and public.has_perm('work_orders.read')))
  );
$fn$;

revoke all on function public.can_read_line_item(uuid) from public, anon;
grant execute on function public.can_read_line_item(uuid) to authenticated;

do $rls$
declare
  v_table text;
begin
  foreach v_table in array array['environments','line_items','line_item_materials','line_item_pieces','line_item_components']
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('drop policy if exists %I on public.%I', v_table || '_select', v_table);
    execute format('drop policy if exists %I on public.%I', v_table || '_insert', v_table);
    execute format('drop policy if exists %I on public.%I', v_table || '_update', v_table);
    execute format('drop policy if exists %I on public.%I', v_table || '_delete', v_table);
  end loop;
end
$rls$;

create policy environments_select on public.environments
  for select to authenticated
  using ((quote_id is not null and public.has_perm('quotes.read'))
         or (work_order_id is not null and public.has_perm('work_orders.read')));

create policy line_items_select on public.line_items
  for select to authenticated
  using ((quote_id is not null and public.has_perm('quotes.read'))
         or (work_order_id is not null and public.has_perm('work_orders.read')));

create policy line_item_materials_select on public.line_item_materials
  for select to authenticated using (public.can_read_line_item(line_item_id));

create policy line_item_pieces_select on public.line_item_pieces
  for select to authenticated using (public.can_read_line_item(line_item_id));

create policy line_item_components_select on public.line_item_components
  for select to authenticated using (public.can_read_line_item(line_item_id));

revoke insert, update, delete, truncate on public.environments, public.line_items,
  public.line_item_materials, public.line_item_pieces, public.line_item_components
  from anon, authenticated;
revoke all on all tables in schema public from anon;
