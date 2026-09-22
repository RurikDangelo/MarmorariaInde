#!/usr/bin/env node
/**
 * Popula o banco com dados DEMO para desenvolvimento.
 * Tudo entra com is_demo = true e pode ser removido com:
 *   npm run db:seed -- --limpar
 *
 * NUNCA rode isto em produção com dados reais.
 */
import { createClient } from './lib/db.mjs'
import { seedDemoComposition } from './lib/seed-composition.mjs'

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString || connectionString.includes('SENHA')) {
  console.error('\n  Falta SUPABASE_DB_URL no .env.local.\n')
  process.exit(1)
}

const clean = process.argv.includes('--limpar')
const client = createClient(connectionString, 'marmoraria-seed')

// Apenas tabelas que tem a coluna is_demo. Os filhos (itens de OS, ambientes e
// produtos da montagem, itens de medicao) somem por cascade ao apagar o pai.
const DEMO_TABLES = [
  'stock_movements',
  'production_records',
  'installations',
  'work_order_measurements',
  'financial_transactions',
  'action_plans',
  'work_orders',
  'quotes',
  'products',
  'stock_items',
  'materials',
  'customers',
  'teams',
]

async function wipeDemo() {
  for (const table of DEMO_TABLES) {
    const { rowCount } = await client.query(
      `delete from public.${table} where is_demo is true`,
    )
    if (rowCount) console.log(`  - ${table}: ${rowCount} registro(s) DEMO removido(s)`)
  }
}

async function seed() {
  console.log('\n  Criando dados DEMO…\n')

  // ---------------------------------------------------------------- clientes
  const customers = await insertMany(
    'customers',
    ['name', 'person_type', 'document', 'phone', 'whatsapp', 'city', 'state', 'district', 'address', 'address_number', 'is_demo'],
    [
      ['[DEMO] Ana Paula Ribeiro', 'PF', '123.456.789-00', '(12) 98111-2233', '(12) 98111-2233', 'São José dos Campos', 'SP', 'Jardim Aquarius', 'Av. Salmão', '120', true],
      ['[DEMO] Construtora Vale Norte', 'PJ', '12.345.678/0001-90', '(12) 3921-5566', '(12) 99777-1010', 'São José dos Campos', 'SP', 'Centro', 'Rua Rubião Júnior', '455', true],
      ['[DEMO] Marcos Tavares', 'PF', '987.654.321-00', '(12) 99632-8877', '(12) 99632-8877', 'Jacareí', 'SP', 'Villa Branca', 'Rua das Acácias', '77', true],
      ['[DEMO] Cozinhas Bella Casa', 'PJ', '98.765.432/0001-10', '(12) 3033-4455', '(12) 98444-3322', 'Taubaté', 'SP', 'Jardim das Nações', 'Av. Itália', '980', true],
      ['[DEMO] Juliana Costa', 'PF', '456.789.123-00', '(12) 98222-4455', '(12) 98222-4455', 'Caçapava', 'SP', 'Vila Menino Jesus', 'Rua São Benedito', '33', true],
    ],
  )

  // --------------------------------------------------------------- materiais
  const materials = await insertMany(
    'materials',
    ['name', 'type_code', 'color', 'origin', 'thickness_mm', 'price_per_m2', 'unit', 'min_quantity', 'supplier', 'is_demo'],
    [
      ['[DEMO] Granito Preto São Gabriel', 'GRANITO', 'Preto', 'NACIONAL', 20, 620.0, 'M2', 3, 'Pedreira Vale', true],
      ['[DEMO] Granito Branco Siena', 'GRANITO', 'Branco', 'NACIONAL', 20, 540.0, 'M2', 2, 'Pedreira Vale', true],
      ['[DEMO] Mármore Carrara', 'MARMORE', 'Branco', 'IMPORTADO', 20, 1280.0, 'M2', 1, 'Import Stone', true],
      ['[DEMO] Quartzo Branco Prime', 'QUARTZO', 'Branco', 'NACIONAL', 20, 1450.0, 'M2', 1, 'Quartz BR', true],
      ['[DEMO] Quartzito Taj Mahal', 'QUARTZITO', 'Bege', 'IMPORTADO', 30, 2100.0, 'M2', 1, 'Import Stone', true],
      ['[DEMO] Cola de pedra cinza', 'COLA', null, null, null, null, 'UN', 10, 'Distribuidora SJC', true],
      ['[DEMO] Disco diamantado 110mm', 'DISCO', null, null, null, null, 'UN', 8, 'Distribuidora SJC', true],
      ['[DEMO] Luva anticorte', 'EPI', null, null, null, null, 'PC', 6, 'Segurança Total', true],
    ],
  )

  // ------------------------------------------------------------------ locais
  const { rows: locations } = await client.query(
    `select id, name from public.stock_locations order by name`,
  )
  const patio = locations.find((l) => l.name.includes('Pátio') || l.name.includes('Patio'))?.id ?? locations[0]?.id
  const galpao = locations.find((l) => l.name.includes('Galpão') || l.name.includes('Galpao'))?.id ?? patio

  // ------------------------------------------------------------------ chapas
  const slabs = []
  const slabSpecs = [
    [materials[0], 'CH-D001', 3200, 1900, 20, 3400, 'DISPONIVEL', false],
    [materials[0], 'CH-D002', 3150, 1850, 20, 3320, 'DISPONIVEL', false],
    [materials[1], 'CH-D003', 3000, 1800, 20, 2900, 'DISPONIVEL', false],
    [materials[1], 'CH-D004', 2950, 1750, 20, 2850, 'RESERVADA', false],
    [materials[2], 'CH-D005', 2800, 1700, 20, 6100, 'DISPONIVEL', false],
    [materials[3], 'CH-D006', 3200, 1600, 20, 7400, 'DISPONIVEL', false],
    [materials[4], 'CH-D007', 3300, 1900, 30, 13200, 'DISPONIVEL', false],
    [materials[0], 'CH-D008-R', 1200, 700, 20, 520, 'DISPONIVEL', true],
    [materials[1], 'CH-D009-R', 900, 600, 20, 380, 'DISPONIVEL', true],
    [materials[2], 'CH-D010', 2750, 1650, 20, 5900, 'CONSUMIDA', false],
    [materials[0], 'CH-D011', 3100, 1880, 20, 3290, 'DANIFICADA', false],
    [materials[3], 'CH-D012', 3150, 1580, 20, 7200, 'DISPONIVEL', false],
  ]

  for (const [materialId, code, length, width, thickness, cost, status, remnant] of slabSpecs) {
    const { rows } = await client.query(
      `insert into public.stock_items
        (kind, code, material_id, location_id, supplier, batch, thickness_mm, length_mm, width_mm,
         is_remnant, quantity, unit, unit_cost, status, is_demo)
       values ('CHAPA', $1, $2, $3, 'Pedreira Vale', 'LT-2026-07', $4, $5, $6, $7, 1, 'M2', $8, $9, true)
       returning id`,
      [code, materialId, remnant ? galpao : patio, thickness, length, width, remnant, cost, status],
    )
    slabs.push(rows[0].id)
  }

  // insumos
  await client.query(
    `insert into public.stock_items (kind, code, material_id, location_id, quantity, unit, unit_cost, status, is_demo)
     values ('INSUMO', 'INS-D001', $1, $2, 24, 'UN', 38.0, 'DISPONIVEL', true),
            ('INSUMO', 'INS-D002', $3, $2, 5, 'UN', 96.0, 'DISPONIVEL', true),
            ('INSUMO', 'INS-D003', $4, $2, 12, 'PC', 29.9, 'DISPONIVEL', true)`,
    [materials[5], galpao, materials[6], materials[7]],
  )

  // ------------------------------------------------------------------ equipe
  const teams = await insertMany(
    'teams',
    ['name', 'kind', 'phone', 'is_demo'],
    [
      ['[DEMO] Equipe Corte A', 'PRODUCAO', '(12) 98700-1122', true],
      ['[DEMO] Equipe Instalação 1', 'INSTALACAO', '(12) 98700-3344', true],
      ['[DEMO] Medição Campo', 'MEDICAO', '(12) 98700-5566', true],
    ],
  )

  // ---------------------------------------- orçamento (montagem da impressão)
  const quote = await seedDemoComposition(client, { customerId: customers[4], materialId: materials[0] })

  // ----------------------------------------------------------- ordens de OS
  const orders = []
  const orderSpecs = [
    [customers[0], 'Bancada de cozinha em granito preto', 'NOVA', 'NORMAL', 12],
    [customers[1], 'Soleiras e peitoris - obra 12 apartamentos', 'MEDICAO', 'ALTA', 20],
    [customers[2], 'Pia de banheiro em mármore', 'AGUARDANDO_MATERIAL', 'NORMAL', 8],
    [customers[3], 'Cozinha completa em quartzo', 'CORTE', 'URGENTE', 5],
    [customers[0], 'Churrasqueira e bancada externa', 'ACABAMENTO', 'NORMAL', 10],
    [customers[4], 'Lavabo em quartzito', 'INSTALACAO', 'ALTA', 2],
    [customers[1], 'Escada em granito - torre B', 'FINALIZADA', 'NORMAL', -6],
  ]

  for (const [customerId, title, status, priority, deadlineOffset] of orderSpecs) {
    const { rows } = await client.query(
      `insert into public.work_orders
         (customer_id, status_code, priority, title, deadline, address, address_number, district, city, state, notes, is_demo,
          created_at, finished_at)
       select $1, $2, $3, $4, current_date + ($5)::int, c.address, c.address_number, c.district, c.city, c.state,
              'Ordem DEMO gerada pelo seed', true,
              case when $2 = 'FINALIZADA' then now() - interval '23 days' else now() - interval '8 days' end,
              case when $2 = 'FINALIZADA' then now() - interval '4 days' else null end
         from public.customers c where c.id = $1
       returning id, number`,
      [customerId, status, priority, title, deadlineOffset],
    )
    orders.push(rows[0])
  }

  // itens das OS
  const itemSpecs = [
    [0, 'Bancada da pia', 'Cozinha', materials[0], 2400, 600, 1, 620, 'Polido', 'Boleada', true, 'Sobrepor', 1, false],
    [0, 'Frontão', 'Cozinha', materials[0], 2400, 100, 1, 620, 'Polido', 'Reta', false, null, 0, false],
    [1, 'Soleira porta 80cm', 'Entrada', materials[1], 800, 150, 24, 540, 'Polido', 'Reta', false, null, 0, false],
    [1, 'Peitoril janela', 'Sala', materials[1], 1200, 180, 12, 540, 'Polido', 'Pingadeira', false, null, 0, false],
    [2, 'Bancada de banheiro', 'Banheiro social', materials[2], 1200, 550, 1, 1280, 'Polido', 'Boleada', true, 'Esculpida', 1, false],
    [3, 'Bancada em L', 'Cozinha', materials[3], 3200, 650, 1, 1450, 'Polido', 'Meia-esquadria', true, 'Embutir', 1, true],
    [3, 'Ilha', 'Cozinha', materials[3], 2000, 900, 1, 1450, 'Polido', 'Meia-esquadria', false, null, 0, false],
    [4, 'Bancada da churrasqueira', 'Área gourmet', materials[0], 2800, 700, 1, 620, 'Levigado', 'Boleada', true, 'Sobrepor', 1, false],
    [5, 'Bancada do lavabo', 'Lavabo', materials[4], 900, 500, 1, 2100, 'Polido', 'Boleada', true, 'Esculpida', 1, false],
    [6, 'Degraus escada', 'Escada', materials[0], 1200, 320, 18, 620, 'Levigado', 'Boleada', false, null, 0, false],
  ]

  for (const [orderIndex, description, environment, materialId, length, width, qty, price, finish, edge, hasSink, sinkType, sinkQty, hasCooktop] of itemSpecs) {
    await client.query(
      `insert into public.work_order_items
         (work_order_id, description, environment, material_id, length_mm, width_mm, quantity,
          pricing_mode, unit_price, finish, edge, has_sink, sink_type, sink_quantity, has_cooktop, production_status)
       values ($1,$2,$3,$4,$5,$6,$7,'M2',$8,$9,$10,$11,$12,$13,$14,'PENDENTE')`,
      [orders[orderIndex].id, description, environment, materialId, length, width, qty, price, finish, edge, hasSink, sinkType, sinkQty, hasCooktop],
    )
  }

  // As OS DEMO nascem com itens antigos e passam pela mesma migração da produção
  // (ambiente + produto + material + peça, com o mesmo total).
  for (const order of orders) {
    await client.query('select public.migrate_document(null, $1)', [order.id])
  }

  // --------------------------------------------------------------- medições
  const { rows: measurement } = await client.query(
    `insert into public.work_order_measurements
       (work_order_id, status, scheduled_at, measured_at, city, district, obstacles, hydraulics_notes,
        check_measures, check_square, check_level, check_photos, customer_present, approved, approved_at, is_demo)
     values ($1, 'APROVADA', now() - interval '3 days', now() - interval '3 days', 'São José dos Campos',
             'Jardim Aquarius', 'Armário aéreo instalado, atenção ao recorte',
             'Ponto de água à esquerda da cuba', true, true, true, true, true, true, now() - interval '3 days', true)
     returning id`,
    [orders[0].id],
  )
  await client.query(
    `insert into public.work_order_measurement_items (measurement_id, description, environment, length_mm, width_mm, quantity)
     values ($1, 'Bancada da pia', 'Cozinha', 2400, 600, 1),
            ($1, 'Frontão', 'Cozinha', 2400, 100, 1)`,
    [measurement[0].id],
  )
  await client.query(
    `insert into public.work_order_measurements
       (work_order_id, status, scheduled_at, city, is_demo)
     values ($1, 'AGENDADA', now() + interval '1 day', 'São José dos Campos', true)`,
    [orders[1].id],
  )

  // --------------------------------------------------------------- produção
  await client.query(
    `insert into public.production_records (work_order_id, step_code, status, started_at, finished_at, is_demo)
     values ($1, 'SEPARACAO', 'CONCLUIDO', now() - interval '2 days', now() - interval '2 days' + interval '45 minutes', true),
            ($1, 'CORTE', 'EM_ANDAMENTO', now() - interval '5 hours', null, true),
            ($2, 'CORTE', 'CONCLUIDO', now() - interval '3 days', now() - interval '3 days' + interval '3 hours', true),
            ($2, 'ACABAMENTO', 'EM_ANDAMENTO', now() - interval '6 hours', null, true),
            ($3, 'EXPEDICAO', 'CONCLUIDO', now() - interval '6 days', now() - interval '6 days' + interval '1 hour', true)`,
    [orders[3].id, orders[4].id, orders[6].id],
  )
  await client.query(
    `insert into public.production_records
       (work_order_id, step_code, status, started_at, finished_at, is_rework, rework_reason, is_demo)
     values ($1, 'ACABAMENTO', 'CONCLUIDO', now() - interval '1 day', now() - interval '1 day' + interval '2 hours',
             true, 'Boleado irregular na emenda', true)`,
    [orders[4].id],
  )

  // ------------------------------------------------------------- instalação
  await client.query(
    `insert into public.installations
       (work_order_id, team_id, status, scheduled_at, city, check_material, check_pieces, check_measures, is_demo)
     values ($1, $2, 'AGENDADA', now() + interval '2 days', 'Caçapava', true, true, true, true)`,
    [orders[5].id, teams[1]],
  )
  await client.query(
    `insert into public.installations
       (work_order_id, team_id, status, scheduled_at, started_at, finished_at, city,
        check_material, check_pieces, check_measures, check_site_ready, check_installed, check_finish,
        check_photos, customer_present, approved, approved_at, is_demo)
     values ($1, $2, 'CONCLUIDA', now() - interval '5 days', now() - interval '5 days',
             now() - interval '5 days' + interval '4 hours', 'São José dos Campos',
             true, true, true, true, true, true, true, true, true, now() - interval '5 days', true)`,
    [orders[6].id, teams[1]],
  )

  // ----------------------------------------------------- movimentos estoque
  await client.query(
    `update public.stock_items set status = 'RESERVADA', reserved_work_order_id = $1 where id = $2`,
    [orders[3].id, slabs[5]],
  )
  await client.query(
    `insert into public.stock_movements (stock_item_id, material_id, work_order_id, movement_type, quantity, area_m2, unit_cost, total_cost, is_demo)
     select $1, material_id, $2, 'RESERVA', 1, area_m2, unit_cost, unit_cost, true from public.stock_items where id = $1`,
    [slabs[5], orders[3].id],
  )
  await client.query(
    `insert into public.stock_movements (stock_item_id, material_id, work_order_id, movement_type, quantity, area_m2, unit_cost, total_cost, is_demo)
     select $1, material_id, $2, 'CONSUMO', 1, area_m2, unit_cost, unit_cost, true from public.stock_items where id = $1`,
    [slabs[9], orders[6].id],
  )
  await client.query(
    `insert into public.stock_movements (stock_item_id, material_id, work_order_id, movement_type, quantity, area_m2, unit_cost, total_cost, loss_reason, notes, is_demo)
     select $1, material_id, $2, 'PERDA', 1, area_m2, unit_cost, unit_cost, 'QUEBRA', 'Chapa trincou no transporte', true
       from public.stock_items where id = $1`,
    [slabs[10], orders[4].id],
  )
  await client.query(
    `insert into public.stock_movements (stock_item_id, material_id, movement_type, quantity, area_m2, unit_cost, notes, is_demo)
     select $1, material_id, 'SOBRA', 1, area_m2, unit_cost, 'Retalho aproveitável do corte', true
       from public.stock_items where id = $1`,
    [slabs[7]],
  )

  // -------------------------------------------------------------- financeiro
  const { rows: categories } = await client.query(
    `select id, name, kind from public.financial_categories`,
  )
  const receita = categories.find((c) => c.kind === 'RECEITA')?.id
  const despesa = categories.find((c) => c.name.includes('chapas'))?.id
  const { rows: accounts } = await client.query(`select id from public.financial_accounts limit 1`)
  const account = accounts[0]?.id

  await client.query(
    `insert into public.financial_transactions
       (description, kind, category_id, account_id, work_order_id, customer_id, amount, due_date, paid_at, status, payment_method, is_demo)
     values
       ('[DEMO] Entrada 50% - bancada cozinha', 'RECEITA', $1, $2, $3, $4,
        (select round(total_value * 0.5, 2) from public.work_orders where id = $3), current_date - 5, current_date - 5, 'PAGO', 'PIX', true),
       ('[DEMO] Saldo final - bancada cozinha', 'RECEITA', $1, $2, $3, $4,
        (select round(total_value * 0.5, 2) from public.work_orders where id = $3), current_date + 10, null, 'PENDENTE', null, true),
       ('[DEMO] Entrada obra 12 apartamentos', 'RECEITA', $1, $2, $5, $6,
        (select round(total_value * 0.4, 2) from public.work_orders where id = $5), current_date - 2, current_date - 2, 'PAGO', 'TRANSFERENCIA', true),
       ('[DEMO] Saldo obra 12 apartamentos', 'RECEITA', $1, $2, $5, $6,
        (select round(total_value * 0.6, 2) from public.work_orders where id = $5), current_date - 1, null, 'PENDENTE', null, true),
       ('[DEMO] Compra de chapas julho', 'DESPESA', $7, $2, null, null, 14800.00, current_date + 6, null, 'PENDENTE', null, true),
       ('[DEMO] Insumos e abrasivos', 'DESPESA', $7, $2, null, null, 1260.00, current_date - 8, current_date - 8, 'PAGO', 'BOLETO', true)`,
    [receita, account, orders[0].id, customers[0], orders[1].id, customers[1], despesa],
  )

  // ---------------------------------------------------------- planos de ação
  await client.query(
    `insert into public.action_plans (title, problem, action, priority, due_date, status, work_order_id, is_demo)
     values
       ('[DEMO] Reduzir quebra no transporte', 'Duas chapas trincaram no mês', 'Revisar cavaletes e amarração do caminhão', 'ALTA', current_date - 2, 'EM_ANDAMENTO', $1, true),
       ('[DEMO] Conferência de medidas antes do corte', 'Retrabalho por medida errada', 'Dupla conferência obrigatória na separação', 'NORMAL', current_date + 12, 'ABERTO', null, true)`,
    [orders[4].id],
  )

  await client.query(`select public.refresh_alerts()`)

  console.log('\n  Dados DEMO criados:')
  console.log(`  - ${customers.length} clientes`)
  console.log(`  - ${materials.length} materiais`)
  console.log(`  - ${slabs.length} chapas + 3 insumos`)
  console.log(`  - ${orders.length} ordens de serviço com itens`)
  console.log(`  - orçamento ${quote.number} com a montagem "Pia e Balcão" (${quote.total})`)
  console.log(`  - ${quote.products} produtos, acabamentos, serviços, revendas e insumos no cadastro`)
  console.log('  - 2 medições, 6 apontamentos de produção, 2 instalações')
  console.log('  - 6 lançamentos financeiros, 2 planos de ação')
  console.log('\n  Para remover: npm run db:seed -- --limpar\n')
}

async function insertMany(table, columns, rows) {
  const ids = []
  for (const values of rows) {
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ')
    const { rows: inserted } = await client.query(
      `insert into public.${table} (${columns.join(', ')}) values (${placeholders}) returning id`,
      values,
    )
    ids.push(inserted[0].id)
  }
  return ids
}

try {
  await client.connect()

  if (clean) {
    console.log('\n  Removendo dados DEMO…\n')
    await wipeDemo()
    console.log('\n  Pronto.\n')
  } else {
    await wipeDemo()
    await seed()
  }
} catch (error) {
  console.error('\n  Erro:', error.message, '\n')
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
