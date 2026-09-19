-- =========================================================================
-- 0003_core_entities.sql - clientes, materiais, produtos e estoque
-- =========================================================================

-- -------------------------------------------------------------------------
-- Clientes (cadastro operacional, NAO e CRM)
-- -------------------------------------------------------------------------
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  document      text,
  person_type   text not null default 'PF' check (person_type in ('PF','PJ')),
  phone         text,
  whatsapp      text,
  email         text,
  zip_code      text,
  address       text,
  address_number text,
  complement    text,
  district      text,
  city          text,
  state         text,
  notes         text,
  active        boolean not null default true,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id),
  updated_by    uuid references public.profiles(id)
);

comment on table public.customers is
  'Cadastro minimo de clientes para operacao (orcamento, OS, medicao, instalacao, financeiro).';

create index if not exists idx_customers_name_trgm on public.customers using gin (name gin_trgm_ops);
create index if not exists idx_customers_document on public.customers(document);

-- -------------------------------------------------------------------------
-- Materiais
-- -------------------------------------------------------------------------
create table if not exists public.material_types (
  code       text primary key,
  label      text not null,
  category   text not null default 'PEDRA' check (category in ('PEDRA','INSUMO','FERRAMENTA','EPI')),
  sort_order integer not null default 0
);

comment on table public.material_types is 'Tipos de material: granito, marmore, quartzo, colas, discos, EPIs...';

create table if not exists public.materials (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  type_code      text not null references public.material_types(code),
  color          text,
  origin         text check (origin in ('NACIONAL','IMPORTADO')),
  finish_default text,
  thickness_mm   integer,
  price_per_m2   numeric(14,2),
  unit           text not null default 'M2' check (unit in ('M2','ML','UN','KG','L','PC')),
  min_quantity   numeric(14,3) not null default 0,
  supplier       text,
  notes          text,
  active         boolean not null default true,
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles(id),
  updated_by     uuid references public.profiles(id)
);

comment on table public.materials is
  'Material comercializado ou consumido: pedra (por m2) ou insumo (por unidade).';
comment on column public.materials.min_quantity is
  'Estoque minimo. Abaixo disso o sistema gera alerta.';

create index if not exists idx_materials_type on public.materials(type_code) where active;
create index if not exists idx_materials_name_trgm on public.materials using gin (name gin_trgm_ops);

-- -------------------------------------------------------------------------
-- Produtos / servicos de beneficiamento (acabamentos, recortes, cubas...)
-- -------------------------------------------------------------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null default 'SERVICO'
              check (kind in ('SERVICO','ACABAMENTO','RECORTE','ACESSORIO')),
  unit        text not null default 'ML' check (unit in ('M2','ML','UN')),
  price       numeric(14,2) not null default 0,
  description text,
  active      boolean not null default true,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id)
);

comment on table public.products is
  'Catalogo de beneficiamentos e servicos cobrados (boleado, meia-esquadria, cuba, recorte...).';

-- -------------------------------------------------------------------------
-- Estoque
-- -------------------------------------------------------------------------
create table if not exists public.stock_locations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  kind       text not null default 'PATIO' check (kind in ('PATIO','GALPAO','PRATELEIRA','OBRA','OUTRO')),
  notes      text,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id)
);

comment on table public.stock_locations is 'Onde o material fica fisicamente.';

create table if not exists public.stock_items (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null default 'CHAPA' check (kind in ('CHAPA','INSUMO')),
  code          text unique,
  material_id   uuid not null references public.materials(id) on delete restrict,
  location_id   uuid references public.stock_locations(id) on delete set null,
  supplier      text,
  batch         text,
  -- chapas
  thickness_mm  integer,
  length_mm     integer,
  width_mm      integer,
  area_m2       numeric(12,4) generated always as (
                  case when length_mm is not null and width_mm is not null
                       then round((length_mm::numeric / 1000) * (width_mm::numeric / 1000), 4)
                       else null end
                ) stored,
  is_remnant    boolean not null default false,
  parent_item_id uuid references public.stock_items(id) on delete set null,
  -- insumos
  quantity      numeric(14,3) not null default 1,
  unit          text not null default 'UN',
  -- comum
  unit_cost     numeric(14,2),
  status        text not null default 'DISPONIVEL'
                check (status in ('DISPONIVEL','RESERVADA','EM_PRODUCAO','CONSUMIDA','DANIFICADA','DESCARTADA')),
  reserved_work_order_id uuid,
  notes         text,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id),
  updated_by    uuid references public.profiles(id),
  constraint chk_chapa_dimensions check (
    kind <> 'CHAPA' or (length_mm is not null and width_mm is not null and thickness_mm is not null)
  )
);

comment on table public.stock_items is
  'Item fisico de estoque: uma chapa (com dimensoes e status) ou um insumo (com quantidade).';
comment on column public.stock_items.is_remnant is
  'Retalho/sobra gerada a partir de outra chapa (parent_item_id).';

create index if not exists idx_stock_items_status on public.stock_items(status);
create index if not exists idx_stock_items_material on public.stock_items(material_id);
create index if not exists idx_stock_items_reserved_os on public.stock_items(reserved_work_order_id)
  where reserved_work_order_id is not null;

create table if not exists public.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  stock_item_id   uuid references public.stock_items(id) on delete set null,
  material_id     uuid references public.materials(id) on delete set null,
  work_order_id   uuid,
  movement_type   text not null check (movement_type in
                    ('ENTRADA','RESERVA','LIBERACAO','CONSUMO','SOBRA','PERDA','AJUSTE','TRANSFERENCIA','DESCARTE')),
  quantity        numeric(14,3) not null default 0,
  area_m2         numeric(12,4),
  unit_cost       numeric(14,2),
  total_cost      numeric(14,2),
  loss_reason     text check (loss_reason in
                    ('QUEBRA','ERRO_CORTE','DEFEITO','MEDICAO_INCORRETA','TRANSPORTE','RETRABALHO','OUTRO')),
  location_from   uuid references public.stock_locations(id) on delete set null,
  location_to     uuid references public.stock_locations(id) on delete set null,
  notes           text,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id),
  updated_by      uuid references public.profiles(id)
);

comment on table public.stock_movements is
  'Historico imutavel de tudo que entra, sai, e reservado, consumido ou perdido no estoque.';
comment on column public.stock_movements.loss_reason is
  'Obrigatorio quando movement_type = PERDA. Base do dashboard de desperdicio.';

create index if not exists idx_stock_movements_item on public.stock_movements(stock_item_id);
create index if not exists idx_stock_movements_os on public.stock_movements(work_order_id);
create index if not exists idx_stock_movements_type_date on public.stock_movements(movement_type, created_at desc);

select public.attach_audit_trigger('customers');
select public.attach_audit_trigger('materials');
select public.attach_audit_trigger('products');
select public.attach_audit_trigger('stock_locations');
select public.attach_audit_trigger('stock_items');
select public.attach_audit_trigger('stock_movements');
