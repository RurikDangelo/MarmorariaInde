#!/usr/bin/env node
/**
 * Zera o sistema para entrega ao cliente: apaga todo o movimento e os
 * cadastros do dia a dia, mantendo os acessos e a base de configuracao.
 *
 *   npm run db:reset                          mostra o que sairia (nao apaga)
 *   npm run db:reset -- --confirmar           apaga
 *   npm run db:reset -- --confirmar --manter-cadastros
 *                                             preserva produtos e materiais
 *
 * Antes de apagar grava um backup JSON em backups/ (fora do Git).
 * Nao toca em auth.users: quem tem login continua entrando.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient, root } from './lib/db.mjs'

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString || connectionString.includes('SENHA')) {
  console.error('\n  Falta SUPABASE_DB_URL no .env.local.\n')
  process.exit(1)
}

const confirmed = process.argv.includes('--confirmar')
const keepCatalog = process.argv.includes('--manter-cadastros')

/** Fica: identidade, RBAC e a base que o sistema precisa para funcionar. */
const KEEP = [
  'schema_migrations',
  'profiles',
  'roles',
  'permissions',
  'role_permissions',
  'company_settings',
  'work_order_statuses',
  'production_steps',
  'material_types',
  'financial_categories',
  'financial_accounts',
  'stock_locations',
  'lookup_options',
]

/** Sai: tudo que e movimento ou cadastro alimentado no uso. */
const WIPE = [
  // ordens de servico e o que pendura nelas
  'work_orders',
  'work_order_history',
  'work_order_items',
  'work_order_attachments',
  'work_order_photos',
  'work_order_measurements',
  'work_order_measurement_items',
  'work_order_measurement_history',
  'installations',
  'production_records',
  'technical_reserves',
  // orcamentos
  'quotes',
  'quote_items',
  'quote_installments',
  'quote_attachments',
  // montagem (ambientes -> produtos -> materiais/pecas/composicao)
  'environments',
  'line_items',
  'line_item_pieces',
  'line_item_materials',
  'line_item_components',
  // cadastros alimentados no uso
  'customers',
  'products',
  'materials',
  'stock_items',
  'stock_movements',
  'teams',
  'team_members',
  // financeiro
  'financial_transactions',
  // apoio
  'alerts',
  'action_plans',
  'audit_logs',
  // numeracao: zerada para a primeira OS do cliente ser a OS-<ano>-0001
  'document_counters',
]

/** Catalogo de produtos e materiais, poupado com --manter-cadastros. */
const CATALOG = ['products', 'materials']

const client = createClient(connectionString, 'marmoraria-reset')

async function tablesInDatabase() {
  const { rows } = await client.query(`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `)
  return rows.map((row) => row.table_name)
}

/**
 * Nenhuma tabela pode ficar de fora da classificacao: sem isto, uma tabela
 * criada depois deste script escaparia do reset sem ninguem perceber.
 */
function assertEveryTableClassified(tables) {
  const classified = new Set([...KEEP, ...WIPE])
  const unknown = tables.filter((table) => !classified.has(table))
  if (unknown.length) {
    throw new Error(
      `Tabela sem classificacao em db-reset.mjs: ${unknown.join(', ')}.\n` +
        '  Decida se ela fica (KEEP) ou sai (WIPE) antes de rodar o reset.',
    )
  }
}

/**
 * truncate ... cascade tambem esvazia quem referencia as tabelas da lista.
 * Se esse alcance chegasse numa tabela que deve ficar, o reset levaria junto
 * os papeis ou as permissoes. Conferido antes de apagar qualquer coisa.
 */
async function assertCascadeStaysInsideWipe(targets) {
  const { rows } = await client.query(
    `select distinct src.relname as child, tgt.relname as parent
       from pg_constraint con
       join pg_class src on src.oid = con.conrelid
       join pg_class tgt on tgt.oid = con.confrelid
       join pg_namespace n on n.oid = src.relnamespace
      where con.contype = 'f' and n.nspname = 'public'`,
  )
  const inside = new Set(targets)
  const leaks = rows.filter((row) => inside.has(row.parent) && !inside.has(row.child))
  if (leaks.length) {
    const lista = leaks.map((row) => `${row.child} -> ${row.parent}`).join(', ')
    throw new Error(`O cascade sairia da lista: ${lista}`)
  }
}

async function countRows(tables) {
  const counts = {}
  for (const table of tables) {
    const { rows } = await client.query(`select count(*)::int as n from public."${table}"`)
    counts[table] = rows[0].n
  }
  return counts
}

async function backup(targets) {
  const data = {}
  for (const table of targets) {
    const { rows } = await client.query(`select * from public."${table}"`)
    if (rows.length) data[table] = rows
  }
  const dir = join(root, 'backups')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `reset-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
  return file
}

/**
 * Apagar a linha de storage.objects deixaria o arquivo orfao no bucket.
 * O nome vem do banco e a remocao vai pela API de Storage, que tira os dois.
 * O bucket `empresa` fica: e onde mora o logo da marmoraria.
 */
async function wipeStorage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const { rows } = await client.query(
    `select bucket_id, name from storage.objects where bucket_id <> 'empresa'`,
  )
  if (!rows.length) return { removed: 0, pending: 0 }
  if (!url || !key) return { removed: 0, pending: rows.length }

  const byBucket = new Map()
  for (const row of rows) {
    if (!byBucket.has(row.bucket_id)) byBucket.set(row.bucket_id, [])
    byBucket.get(row.bucket_id).push(row.name)
  }

  let removed = 0
  for (const [bucket, prefixes] of byBucket) {
    const response = await fetch(`${url}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes }),
    })
    if (!response.ok) {
      throw new Error(`Storage ${bucket}: ${response.status} ${await response.text()}`)
    }
    removed += prefixes.length
  }
  return { removed, pending: 0 }
}

async function main() {
  await client.connect()

  assertEveryTableClassified(await tablesInDatabase())

  const targets = WIPE.filter((table) => !(keepCatalog && CATALOG.includes(table)))
  await assertCascadeStaysInsideWipe(targets)

  const before = await countRows([...targets, ...KEEP, ...CATALOG])
  const { rows: users } = await client.query('select count(*)::int as n from auth.users')
  const { rows: files } = await client.query(
    `select count(*)::int as n from storage.objects where bucket_id <> 'empresa'`,
  )

  console.log('\n  SAI\n')
  for (const table of targets) {
    if (before[table]) console.log(`    ${String(before[table]).padStart(5)}  ${table}`)
  }
  if (files[0].n) console.log(`    ${String(files[0].n).padStart(5)}  arquivos no Storage`)

  console.log('\n  FICA\n')
  console.log(`    ${String(users[0].n).padStart(5)}  logins (auth.users)`)
  for (const table of KEEP) {
    if (before[table]) console.log(`    ${String(before[table]).padStart(5)}  ${table}`)
  }
  if (keepCatalog) {
    for (const table of CATALOG) {
      console.log(`    ${String(before[table]).padStart(5)}  ${table} (--manter-cadastros)`)
    }
  }

  if (!confirmed) {
    console.log('\n  Nada foi apagado. Para apagar de verdade:')
    console.log('    npm run db:reset -- --confirmar\n')
    return
  }

  const file = await backup(targets)
  console.log(`\n  Backup: ${file}`)

  const storage = await wipeStorage()

  await client.query('begin')
  await client.query(
    `truncate table ${targets.map((table) => `public."${table}"`).join(', ')} restart identity cascade`,
  )
  await client.query('commit')

  const after = await countRows(targets)
  const left = Object.entries(after).filter(([, n]) => n > 0)
  if (left.length) {
    throw new Error(`Sobrou registro em: ${left.map(([t, n]) => `${t}(${n})`).join(', ')}`)
  }

  console.log(`  Storage: ${storage.removed} arquivo(s) removido(s)`)
  if (storage.pending) {
    console.log(`  Storage: ${storage.pending} arquivo(s) NAO removidos (falta SUPABASE_SERVICE_ROLE_KEY)`)
  }
  console.log('\n  Sistema zerado. Logins e configuracao intactos.')
  console.log('  A proxima OS sera a numero 0001.\n')
}

main()
  .catch((error) => {
    console.error(`\n  ERRO: ${error.message}\n`)
    process.exitCode = 1
  })
  .finally(() => client.end())
