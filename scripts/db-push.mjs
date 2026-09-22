#!/usr/bin/env node
/**
 * Aplica as migrations de supabase/migrations em ordem lexicografica.
 * Controla o que ja rodou na tabela public.schema_migrations.
 *
 * Uso: npm run db:push          (aplica pendentes)
 *      npm run db:push -- --all (reaplica tudo; as migrations sao idempotentes)
 *
 * Requer SUPABASE_DB_URL no .env.local (session pooler, porta 5432).
 * Banco local (localhost/127.0.0.1) conecta sem SSL.
 */
import { applyMigrations, createClient } from './lib/db.mjs'

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString || connectionString.includes('SENHA')) {
  console.error(
    '\n  Falta SUPABASE_DB_URL no .env.local.\n' +
      '  Copie .env.local.example, cole a connection string do painel do Supabase\n' +
      '  (Project Settings > Database > Connection string > Session pooler) e rode de novo.\n',
  )
  process.exit(1)
}

const client = createClient(connectionString, 'marmoraria-db-push')
const t0 = Date.now()

try {
  await client.connect()
  const count = await applyMigrations(client, { reapplyAll: process.argv.includes('--all') })
  console.log(`\n  ${count} migration(s) aplicada(s) em ${((Date.now() - t0) / 1000).toFixed(1)}s\n`)
} catch (error) {
  console.error(`\n${error.message}\n`)
  if (error.excerpt) console.error('Trecho:', error.excerpt)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
