#!/usr/bin/env node
/**
 * Testes do banco (regras de calculo, RLS, aprovacao, migracao do legado).
 *
 * Uso: TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/marmoraria_test npm run db:test
 *
 * - Aceita PostgreSQL comum (aplica supabase/tests/supabase-stub.sql se nao
 *   houver schema auth) ou o banco do `supabase start`.
 * - Aplica as migrations pendentes e roda cada supabase/tests/*.test.sql
 *   dentro de uma transacao que SEMPRE termina em rollback.
 * - Recusa banco remoto: testes nunca rodam em producao.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { applyMigrations, createClient, isLocalDatabase, root } from './lib/db.mjs'

const connectionString = process.env.TEST_DATABASE_URL
if (!connectionString) {
  console.error('\n  Informe TEST_DATABASE_URL (banco local, descartavel).\n')
  process.exit(1)
}
if (!isLocalDatabase(connectionString)) {
  console.error('\n  TEST_DATABASE_URL precisa apontar para localhost. Testes nunca rodam em banco remoto.\n')
  process.exit(1)
}

const testsDir = join(root, 'supabase', 'tests')
const client = createClient(connectionString, 'marmoraria-db-test')
let failures = 0

try {
  await client.connect()

  const { rows } = await client.query(`select exists (select 1 from pg_namespace where nspname = 'auth') as has_auth`)
  if (!rows[0].has_auth) {
    console.log('  Banco sem Supabase: aplicando stub de auth/storage')
    await client.query(readFileSync(join(testsDir, 'supabase-stub.sql'), 'utf8'))
  }

  await applyMigrations(client, { log: () => {} })

  const files = readdirSync(testsDir).filter((file) => file.endsWith('.test.sql')).sort()
  for (const file of files) {
    const sql = readFileSync(join(testsDir, file), 'utf8')
    const started = Date.now()
    await client.query('begin')
    try {
      await client.query(sql)
      console.log(`  PASSOU  ${file} (${Date.now() - started} ms)`)
    } catch (error) {
      failures++
      console.log(`  FALHOU  ${file}\n          ${error.message}`)
      if (error.where) console.log(`          ${error.where.split('\n')[0]}`)
    } finally {
      await client.query('rollback')
    }
  }

  console.log(failures ? `\n  ${failures} arquivo(s) com falha\n` : '\n  Todos os testes passaram\n')
  process.exitCode = failures ? 1 : 0
} catch (error) {
  console.error(`\n  ${error.message}\n`)
  if (error.excerpt) console.error('Trecho:', error.excerpt)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
