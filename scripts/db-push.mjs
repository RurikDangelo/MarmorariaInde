#!/usr/bin/env node
/**
 * Aplica as migrations de supabase/migrations em ordem lexicografica.
 * Controla o que ja rodou na tabela public.schema_migrations.
 *
 * Uso: npm run db:push          (aplica pendentes)
 *      npm run db:push -- --all (reaplica tudo; as migrations sao idempotentes)
 *
 * Requer SUPABASE_DB_URL no .env.local (session pooler, porta 5432).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

dotenv.config({ path: join(root, '.env.local'), quiet: true })

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString || connectionString.includes('SENHA')) {
  console.error(
    '\n  Falta SUPABASE_DB_URL no .env.local.\n' +
      '  Copie .env.local.example, cole a connection string do painel do Supabase\n' +
      '  (Project Settings > Database > Connection string > Session pooler) e rode de novo.\n',
  )
  process.exit(1)
}

const reapplyAll = process.argv.includes('--all')
const migrationsDir = join(root, 'supabase', 'migrations')
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  application_name: 'marmoraria-db-push',
})

const t0 = Date.now()

try {
  await client.connect()
  await client.query(`
    create table if not exists public.schema_migrations (
      version    text primary key,
      applied_at timestamptz not null default now()
    )
  `)

  const { rows } = await client.query('select version from public.schema_migrations')
  const applied = new Set(rows.map((r) => r.version))

  let count = 0
  for (const file of files) {
    if (!reapplyAll && applied.has(file)) {
      console.log(`  ok   ${file} (ja aplicada)`)
      continue
    }
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    process.stdout.write(`  ...  ${file}`)
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query(
        `insert into public.schema_migrations (version) values ($1)
         on conflict (version) do update set applied_at = now()`,
        [file],
      )
      await client.query('commit')
      count++
      process.stdout.write(`\r  OK   ${file}          \n`)
    } catch (err) {
      await client.query('rollback')
      process.stdout.write(`\r  ERRO ${file}          \n`)
      console.error(`\n${err.message}\n`)
      if (err.position) {
        const pos = Number(err.position)
        console.error('Trecho:', sql.slice(Math.max(0, pos - 220), pos + 220))
      }
      process.exit(1)
    }
  }

  console.log(`\n  ${count} migration(s) aplicada(s) em ${((Date.now() - t0) / 1000).toFixed(1)}s\n`)
} catch (err) {
  console.error('\n  Falha ao conectar no banco:', err.message, '\n')
  process.exit(1)
} finally {
  await client.end().catch(() => {})
}
