#!/usr/bin/env node
/**
 * Junta migrations num arquivo unico para colar no SQL Editor do Supabase.
 *
 * Uso: npm run db:bundle -- 0020          (da 0020 ate a ultima)
 *      npm run db:bundle -- 0020 0026     (intervalo)
 *
 * O arquivo roda numa transacao so (se algo falhar, nada e aplicado) e
 * registra cada migration em public.schema_migrations, para o `db:push`
 * nao reaplicar depois. Saida: supabase/bundles/ (fora do Git).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { listMigrations, readMigration, root } from './lib/db.mjs'

const [from, to] = process.argv.slice(2)
if (!from) {
  console.error('\n  Informe a primeira migration. Ex.: npm run db:bundle -- 0020\n')
  process.exit(1)
}

const files = listMigrations().filter((file) => file >= from && (!to || file.slice(0, to.length) <= to))
if (!files.length) {
  console.error(`\n  Nenhuma migration a partir de ${from}.\n`)
  process.exit(1)
}

const first = files[0].slice(0, 4)
const last = files[files.length - 1].slice(0, 4)
const generatedAt = new Date().toISOString()

const parts = [
  `-- =========================================================================`,
  `-- Migrations ${first} a ${last} para o SQL Editor do Supabase`,
  `-- Gerado por scripts/sql-bundle.mjs em ${generatedAt}`,
  `--`,
  `-- Como aplicar: Supabase > SQL Editor > New query > cole TODO este arquivo > Run.`,
  `-- Roda numa transacao so: se qualquer parte falhar, nada e aplicado.`,
  `-- Arquivos: ${files.join(', ')}`,
  `-- =========================================================================`,
  '',
  'begin;',
  '',
  `create table if not exists public.schema_migrations (
  version    text primary key,
  applied_at timestamptz not null default now()
);`,
]

for (const file of files) {
  parts.push(
    '',
    `-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> ${file}`,
    readMigration(file).trimEnd(),
    '',
    `insert into public.schema_migrations (version) values ('${file}')`,
    `  on conflict (version) do update set applied_at = now();`,
  )
}

parts.push('', 'commit;', '')

const outDir = join(root, 'supabase', 'bundles')
mkdirSync(outDir, { recursive: true })
const outFile = join(outDir, `migrations-${first}-a-${last}.sql`)
writeFileSync(outFile, parts.join('\n'), 'utf8')

console.log(`\n  ${files.length} migration(s) em ${outFile}\n`)
