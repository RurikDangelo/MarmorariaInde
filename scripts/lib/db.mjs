/**
 * Conexao e aplicacao de migrations compartilhadas por db:push, db:test e db:seed.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import dotenv from 'dotenv'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const migrationsDir = join(root, 'supabase', 'migrations')

dotenv.config({ path: join(root, '.env.local'), quiet: true })

/** Banco na propria maquina (Postgres local ou `supabase start`) nao usa SSL. */
export function isLocalDatabase(connectionString) {
  try {
    const { hostname } = new URL(connectionString)
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)
  } catch {
    return false
  }
}

export function createClient(connectionString, applicationName) {
  return new pg.Client({
    connectionString,
    ssl: isLocalDatabase(connectionString) ? false : { rejectUnauthorized: false },
    application_name: applicationName,
  })
}

export function listMigrations() {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
}

export function readMigration(file) {
  return readFileSync(join(migrationsDir, file), 'utf8')
}

/**
 * Aplica em ordem as migrations ainda nao registradas em public.schema_migrations
 * (ou todas, com reapplyAll). Cada arquivo roda na propria transacao.
 */
export async function applyMigrations(client, { reapplyAll = false, log = console.log } = {}) {
  await client.query(`
    create table if not exists public.schema_migrations (
      version    text primary key,
      applied_at timestamptz not null default now()
    )
  `)

  const { rows } = await client.query('select version from public.schema_migrations')
  const applied = new Set(rows.map((row) => row.version))

  let count = 0
  for (const file of listMigrations()) {
    if (!reapplyAll && applied.has(file)) {
      log(`  ok   ${file} (ja aplicada)`)
      continue
    }
    const sql = readMigration(file)
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
      log(`  OK   ${file}`)
    } catch (error) {
      await client.query('rollback')
      log(`  ERRO ${file}`)
      if (error.position) {
        const position = Number(error.position)
        error.excerpt = sql.slice(Math.max(0, position - 220), position + 220)
      }
      throw error
    }
  }
  return count
}
