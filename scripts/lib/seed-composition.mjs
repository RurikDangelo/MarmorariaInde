/**
 * Parte DEMO da montagem: cadastro de produtos e servicos e um orcamento igual
 * a impressao do sistema antigo (Pia e Balcao: 4,0238 m2 x R$ 600 = R$ 2.414,28;
 * total R$ 4.805,68). Escreve direto nas tabelas (o seed roda sem usuario) e
 * usa as funcoes de recalculo do banco.
 */

const PRODUCTS = [
  ['PRODUTO', 'Pia e Balcão', 'M2', 0, null],
  ['PRODUTO', 'Bancada de banheiro', 'M2', 0, null],
  ['PRODUTO', 'Soleira', 'M2', 0, null],
  ['PRODUTO', 'Peitoril', 'M2', 0, null],
  ['ACABAMENTO', 'Acabamento 45°', 'ML', 120, null],
  ['ACABAMENTO', 'Acabamento Reto Simples (Material Escuro)', 'ML', 30, null],
  ['ACABAMENTO', 'Boleado', 'ML', 45, null],
  ['SERVICO', 'Furar e Colar Cuba', 'UN', 150, null],
  ['SERVICO', 'Furo Cooktop', 'UN', 50, null],
  ['SERVICO', 'Instalação de Pia e Balcão', 'ML', 150, null],
  ['REVENDA', 'Cuba Inox nº 2 (56x34x17)', 'PC', 290, 210],
  ['REVENDA', 'Torneira gourmet', 'PC', 480, 330],
  ['INSUMO', 'Cola epóxi', 'UN', 0, 35],
  ['INSUMO', 'Silicone', 'UN', 0, 22],
]

// [comprimento, largura, quantidade] das 11 pecas da impressao
const PIECES = [
  [2100, 600, 1, 'Tampo'],
  [1800, 600, 1, 'Tampo balcão'],
  [940, 600, 1, 'Tampo canto'],
  [940, 200, 1, 'Frente'],
  [2700, 150, 1, 'Rodabanca'],
  [600, 100, 1, 'Rodabanca lateral'],
  [1200, 100, 1, 'Rodabanca'],
  [900, 60, 1, 'Saia'],
  [1200, 60, 1, 'Saia'],
  [1800, 60, 1, 'Saia'],
  [940, 60, 2, 'Saia'],
]

// [nome do produto, quantidade]
const COMPONENTS = [
  ['Acabamento 45°', 9.12],
  ['Acabamento Reto Simples (Material Escuro)', 2.7],
  ['Furar e Colar Cuba', 1],
  ['Furo Cooktop', 1],
  ['Instalação de Pia e Balcão', 4.84],
  ['Cuba Inox nº 2 (56x34x17)', 1],
  ['Cola epóxi', 2],
]

export async function seedDemoComposition(client, { customerId, materialId }) {
  const products = new Map()
  for (const [kind, name, unit, price, cost] of PRODUCTS) {
    const { rows } = await client.query(
      `insert into public.products (kind, name, unit, price, cost, is_demo)
       values ($1, $2, $3, $4, $5, true) returning id, code, name, kind, unit, price, cost`,
      [kind, name, unit, price, cost],
    )
    products.set(name, rows[0])
  }

  const { rows: quoteRows } = await client.query(
    `insert into public.quotes
       (customer_id, status, issue_date, validity_days, valid_until, delivery_term, delivery_days, delivery_date,
        payment_type, payment_method, payment_terms, site_details, freight, items_model, notes, is_demo)
     values ($1, 'ENVIADO', current_date - 3, 15, current_date + 12, '20 dias úteis', 20, current_date + 25,
             'A_PRAZO', 'PIX', '50% de entrada + 50% em 30 dias', 'Apartamento 42, bloco B. Portaria libera com o nome.',
             0, 2, 'Orçamento DEMO com a montagem da impressão do sistema antigo.', true)
     returning id, number`,
    [customerId],
  )
  const quote = quoteRows[0]

  const { rows: environmentRows } = await client.query(
    `insert into public.environments (quote_id, number, name, description, sort_order, is_demo)
     values ($1, 1, 'Cozinha', 'Pia, balcão e rodabanca em granito preto', 1, true) returning id`,
    [quote.id],
  )
  const pia = products.get('Pia e Balcão')
  const { rows: itemRows } = await client.query(
    `insert into public.line_items
       (quote_id, environment_id, product_id, code, description, quantity, unit, length_mm, width_mm, edge_mm, backsplash_mm, sort_order, is_demo)
     values ($1, $2, $3, $4, $5, 1, 'M2', 2100, 600, 60, 150, 1, true) returning id`,
    [quote.id, environmentRows[0].id, pia.id, pia.code, pia.name],
  )
  const itemId = itemRows[0].id

  // preco da impressao (R$ 600/m2) com o cadeado aberto
  const { rows: materialRows } = await client.query(
    `insert into public.line_item_materials (line_item_id, material_id, code, description, thickness_mm, price_per_m2, price_overridden, sort_order)
     select $1, m.id, m.code, m.name, m.thickness_mm, 600, true, 1 from public.materials m where m.id = $2
     returning id`,
    [itemId, materialId],
  )

  for (const [index, [length, width, quantity, name]] of PIECES.entries()) {
    await client.query(
      `insert into public.line_item_pieces
         (line_item_id, line_item_material_id, number, name, quantity, length_mm, width_mm, waste_pct, label_count, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9)`,
      [itemId, materialRows[0].id, String(index + 1), name, quantity, length, width, quantity, index + 1],
    )
  }

  for (const [index, [name, quantity]] of COMPONENTS.entries()) {
    const product = products.get(name)
    await client.query(
      `insert into public.line_item_components (line_item_id, kind, product_id, code, description, unit, quantity, unit_price, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        itemId,
        product.kind,
        product.id,
        product.code,
        product.name,
        product.unit,
        quantity,
        product.kind === 'INSUMO' ? product.cost : product.price,
        index + 1,
      ],
    )
  }

  await client.query('select public.recalc_line_item($1)', [itemId])
  await client.query('select public.recalc_document($1, null)', [quote.id])

  const { rows: totals } = await client.query('select total from public.quotes where id = $1', [quote.id])
  const total = Number(totals[0].total)
  const half = Math.round((total / 2) * 100) / 100
  await client.query(
    `insert into public.quote_installments (quote_id, number, due_date, amount, payment_method, is_demo)
     values ($1, 1, current_date, $2, 'PIX', true), ($1, 2, current_date + 30, $3, 'PIX', true)`,
    [quote.id, half, Math.round((total - half) * 100) / 100],
  )
  await client.query(
    `insert into public.technical_reserves (quote_id, professional_name, professional_phone, percentage, amount, is_demo)
     values ($1, '[DEMO] Arq. Helena Duarte', '(12) 99100-2233', 5, round($2 * 0.05, 2), true)`,
    [quote.id, total],
  )

  return {
    number: quote.number,
    total: total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    products: PRODUCTS.length,
  }
}
