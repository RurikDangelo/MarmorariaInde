-- =========================================================================
-- 0009_seed_catalog.sql - catalogo do sistema (NAO e dado demo)
-- Papeis, permissoes, status da OS, etapas de producao e tipos de material.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Papeis
-- -------------------------------------------------------------------------
insert into public.roles (code, label, description, sort_order) values
  ('ADMINISTRADOR', 'Administrador', 'Acesso total ao sistema, inclusive usuarios e configuracoes', 10),
  ('GESTOR',        'Gestor',        'Gestao operacional completa, sem administracao de usuarios', 20),
  ('PRODUCAO',      'Producao',      'Apontamento de producao e acompanhamento das OS', 30),
  ('MEDICAO',       'Medicao',       'Registro e conferencia de medicoes em campo', 40),
  ('INSTALACAO',    'Instalacao',    'Execucao e checklist de instalacao', 50),
  ('FINANCEIRO',    'Financeiro',    'Contas a pagar, a receber e fluxo de caixa', 60),
  ('ESTOQUE',       'Estoque',       'Chapas, insumos, reservas, consumo e perdas', 70),
  ('OPERACIONAL',   'Operacional',   'Consulta das informacoes operacionais', 80)
on conflict (code) do update set label = excluded.label, description = excluded.description;

-- -------------------------------------------------------------------------
-- Permissoes
-- -------------------------------------------------------------------------
insert into public.permissions (code, resource, action, label) values
  ('customers.read',       'customers',    'read',          'Ver clientes'),
  ('customers.write',      'customers',    'write',         'Cadastrar e editar clientes'),
  ('quotes.read',          'quotes',       'read',          'Ver orcamentos'),
  ('quotes.write',         'quotes',       'write',         'Criar e editar orcamentos'),
  ('quotes.approve',       'quotes',       'approve',       'Aprovar orcamento e gerar OS'),
  ('work_orders.read',     'work_orders',  'read',          'Ver ordens de servico'),
  ('work_orders.write',    'work_orders',  'write',         'Criar e editar ordens de servico'),
  ('work_orders.status',   'work_orders',  'status',        'Mover a OS entre etapas'),
  ('work_orders.delete',   'work_orders',  'delete',        'Excluir ordens de servico'),
  ('measurements.read',    'measurements', 'read',          'Ver medicoes'),
  ('measurements.write',   'measurements', 'write',         'Registrar e editar medicoes'),
  ('production.read',      'production',   'read',          'Ver producao'),
  ('production.write',     'production',   'write',         'Apontar producao'),
  ('installations.read',   'installations','read',          'Ver instalacoes'),
  ('installations.write',  'installations','write',         'Registrar instalacoes'),
  ('stock.read',           'stock',        'read',          'Ver estoque'),
  ('stock.write',          'stock',        'write',         'Movimentar estoque'),
  ('financial.read',       'financial',    'read',          'Ver financeiro'),
  ('financial.write',      'financial',    'write',         'Lancar e baixar titulos'),
  ('team.read',            'team',         'read',          'Ver equipe'),
  ('team.write',           'team',         'write',         'Gerenciar equipes'),
  ('users.read',           'users',        'read',          'Ver usuarios'),
  ('users.write',          'users',        'write',         'Gerenciar usuarios e papeis'),
  ('settings.read',        'settings',     'read',          'Ver configuracoes'),
  ('settings.write',       'settings',     'write',         'Alterar configuracoes'),
  ('alerts.read',          'alerts',       'read',          'Ver alertas'),
  ('alerts.write',         'alerts',       'write',         'Dispensar alertas'),
  ('action_plans.read',    'action_plans', 'read',          'Ver planos de acao'),
  ('action_plans.write',   'action_plans', 'write',         'Gerenciar planos de acao'),
  ('reports.read',         'reports',      'read',          'Ver relatorios'),
  ('dashboard.read',       'dashboard',    'read',          'Ver dashboard'),
  ('audit.read',           'audit',        'read',          'Ver logs de auditoria')
on conflict (code) do update set label = excluded.label;

-- -------------------------------------------------------------------------
-- Papel x permissao
-- -------------------------------------------------------------------------
delete from public.role_permissions;

-- ADMINISTRADOR: tudo
insert into public.role_permissions (role, permission)
select 'ADMINISTRADOR', code from public.permissions;

-- GESTOR: operacao completa, sem gerenciar usuarios nem alterar configuracoes
insert into public.role_permissions (role, permission)
select 'GESTOR', code from public.permissions
 where code not in ('users.write', 'settings.write');

-- PRODUCAO
insert into public.role_permissions (role, permission) values
  ('PRODUCAO','work_orders.read'), ('PRODUCAO','work_orders.status'),
  ('PRODUCAO','production.read'),  ('PRODUCAO','production.write'),
  ('PRODUCAO','measurements.read'),('PRODUCAO','stock.read'),
  ('PRODUCAO','customers.read'),   ('PRODUCAO','alerts.read'),
  ('PRODUCAO','team.read'),        ('PRODUCAO','dashboard.read'),
  ('PRODUCAO','action_plans.read');

-- MEDICAO
insert into public.role_permissions (role, permission) values
  ('MEDICAO','work_orders.read'),  ('MEDICAO','work_orders.status'),
  ('MEDICAO','measurements.read'), ('MEDICAO','measurements.write'),
  ('MEDICAO','customers.read'),    ('MEDICAO','alerts.read'),
  ('MEDICAO','dashboard.read'),    ('MEDICAO','team.read');

-- INSTALACAO
insert into public.role_permissions (role, permission) values
  ('INSTALACAO','work_orders.read'),   ('INSTALACAO','work_orders.status'),
  ('INSTALACAO','installations.read'), ('INSTALACAO','installations.write'),
  ('INSTALACAO','measurements.read'),  ('INSTALACAO','customers.read'),
  ('INSTALACAO','alerts.read'),        ('INSTALACAO','dashboard.read'),
  ('INSTALACAO','team.read');

-- FINANCEIRO
insert into public.role_permissions (role, permission) values
  ('FINANCEIRO','financial.read'),  ('FINANCEIRO','financial.write'),
  ('FINANCEIRO','work_orders.read'),('FINANCEIRO','quotes.read'),
  ('FINANCEIRO','customers.read'),  ('FINANCEIRO','customers.write'),
  ('FINANCEIRO','reports.read'),    ('FINANCEIRO','alerts.read'),
  ('FINANCEIRO','dashboard.read');

-- ESTOQUE
insert into public.role_permissions (role, permission) values
  ('ESTOQUE','stock.read'),        ('ESTOQUE','stock.write'),
  ('ESTOQUE','work_orders.read'),  ('ESTOQUE','production.read'),
  ('ESTOQUE','reports.read'),      ('ESTOQUE','alerts.read'),
  ('ESTOQUE','dashboard.read');

-- OPERACIONAL: leitura da operacao
insert into public.role_permissions (role, permission) values
  ('OPERACIONAL','work_orders.read'),  ('OPERACIONAL','customers.read'),
  ('OPERACIONAL','measurements.read'), ('OPERACIONAL','production.read'),
  ('OPERACIONAL','installations.read'),('OPERACIONAL','stock.read'),
  ('OPERACIONAL','alerts.read'),       ('OPERACIONAL','dashboard.read'),
  ('OPERACIONAL','quotes.read');

-- -------------------------------------------------------------------------
-- Status da OS = colunas do Kanban (secao 17 do escopo)
-- -------------------------------------------------------------------------
insert into public.work_order_statuses (code, label, description, color, sort_order, is_default, is_terminal, kanban) values
  ('NOVA',               'Novas',               'OS criada, aguardando planejamento',        'info',    10, true,  false, true),
  ('MEDICAO',            'Medicao',             'Aguardando ou em medicao no cliente',       'accent',  20, false, false, true),
  ('AGUARDANDO_MATERIAL','Aguardando material', 'Material a separar, reservar ou comprar',   'warning', 30, false, false, true),
  ('CORTE',              'Corte',               'Chapa em corte',                            'primary', 40, false, false, true),
  ('ACABAMENTO',         'Acabamento',          'Boleado, polimento, colagem',               'primary', 50, false, false, true),
  ('CONFERENCIA',        'Conferencia',         'Conferencia de qualidade das pecas',        'accent',  60, false, false, true),
  ('EXPEDICAO',          'Expedicao',           'Pecas separadas e carregadas',              'info',    70, false, false, true),
  ('INSTALACAO',         'Instalacao',          'Equipe em obra',                            'warning', 80, false, false, true),
  ('FINALIZADA',         'Finalizadas',         'Servico concluido e aprovado',              'success', 90, false, true,  true),
  ('CANCELADA',          'Canceladas',          'OS cancelada',                              'destructive', 100, false, true, false)
on conflict (code) do update
  set label = excluded.label, description = excluded.description, color = excluded.color,
      sort_order = excluded.sort_order, is_terminal = excluded.is_terminal, kanban = excluded.kanban;

-- -------------------------------------------------------------------------
-- Etapas de producao (secao 18 do escopo)
-- -------------------------------------------------------------------------
insert into public.production_steps (code, label, sort_order) values
  ('SEPARACAO',   'Separacao de material', 10),
  ('CORTE',       'Corte',                 20),
  ('ACABAMENTO',  'Acabamento',            30),
  ('COLAGEM',     'Colagem',               40),
  ('POLIMENTO',   'Polimento',             50),
  ('CONFERENCIA', 'Conferencia',           60),
  ('EXPEDICAO',   'Expedicao',             70)
on conflict (code) do update set label = excluded.label, sort_order = excluded.sort_order;

-- -------------------------------------------------------------------------
-- Tipos de material (secao 19 do escopo)
-- -------------------------------------------------------------------------
insert into public.material_types (code, label, category, sort_order) values
  ('GRANITO',    'Granito',            'PEDRA',      10),
  ('MARMORE',    'Marmore',            'PEDRA',      20),
  ('QUARTZO',    'Quartzo',            'PEDRA',      30),
  ('QUARTZITO',  'Quartzito',          'PEDRA',      40),
  ('SUPERFICIE', 'Superficie especial','PEDRA',      50),
  ('COLA',       'Cola / adesivo',     'INSUMO',     60),
  ('RESINA',     'Resina',             'INSUMO',     70),
  ('ABRASIVO',   'Abrasivo',           'INSUMO',     80),
  ('DISCO',      'Disco de corte',     'INSUMO',     90),
  ('INSUMO',     'Insumo geral',       'INSUMO',    100),
  ('FERRAMENTA', 'Ferramenta',         'FERRAMENTA',110),
  ('EPI',        'EPI',                'EPI',       120)
on conflict (code) do update set label = excluded.label, category = excluded.category;

-- -------------------------------------------------------------------------
-- Categorias financeiras padrao
-- -------------------------------------------------------------------------
insert into public.financial_categories (name, kind, color) values
  ('Venda de servico',      'RECEITA', 'success'),
  ('Entrada / sinal',       'RECEITA', 'success'),
  ('Compra de chapas',      'DESPESA', 'warning'),
  ('Insumos e abrasivos',   'DESPESA', 'warning'),
  ('Folha e mao de obra',   'DESPESA', 'destructive'),
  ('Manutencao de maquinas','DESPESA', 'muted'),
  ('Transporte / frete',    'DESPESA', 'muted'),
  ('Despesa administrativa','DESPESA', 'muted')
on conflict (name, kind) do nothing;

insert into public.financial_accounts (name, kind) values
  ('Caixa da loja', 'CAIXA')
on conflict (name) do nothing;

insert into public.stock_locations (name, kind) values
  ('Patio de chapas', 'PATIO'),
  ('Galpao de producao', 'GALPAO')
on conflict (name) do nothing;
