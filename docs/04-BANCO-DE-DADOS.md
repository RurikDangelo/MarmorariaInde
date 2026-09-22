# 04 — Banco de dados

PostgreSQL 17 no Supabase. Fonte da verdade: `supabase/migrations/*.sql`.
Aplicar com `npm run db:push`.

## Migrations

| Arquivo | Conteúdo |
|---|---|
| `0001_foundation.sql` | extensões, trigger de auditoria de campos, numeração de documentos |
| `0002_rbac.sql` | `roles`, `permissions`, `role_permissions`, `profiles`, `company_settings`, `has_perm()` |
| `0003_core_entities.sql` | `customers`, `material_types`, `materials`, `products`, estoque |
| `0004_work_orders.sql` | `work_order_statuses`, `quotes`, `work_orders`, itens, anexos, histórico |
| `0005_measurement_production_installation.sql` | medições, produção, equipes, instalações |
| `0006_financial_alerts_audit.sql` | financeiro, planos de ação, alertas, auditoria, funções de estoque |
| `0007_rls.sql` | RLS em todas as tabelas |
| `0008_storage.sql` | buckets e policies de arquivos |
| `0009_seed_catalog.sql` | papéis, permissões, status da OS, etapas, tipos de material |
| `0010_quote_conversion.sql` | `convert_quote_to_work_order()` |
| `0011_bootstrap_admin.sql` | primeiro usuário vira administrador |
| `0012`–`0019` | textos em português, alertas, auditoria tolerante, domínio de login |
| `0020_cadastros.sql` | `products` vira "Produtos e serviços", código de material/produto, `lookup_options` |
| `0021_cabecalho_fatura_rt_anexos.sql` | cabeçalho do antigo, `items_model`, totais por trigger, trava de aprovado, fatura, RT, anexos |
| `0022_montagem_tabelas.sql` | `environments`, `line_items`, materiais, peças e composição (só leitura pela API) |
| `0023_montagem_calculo.sql` | recálculo de m² e valores; guarda do legado |
| `0024_montagem_rpcs.sql` | funções de gravação da montagem, fatura, RT, situação da peça, instalação |
| `0025_aprovacao_e_producao.sql` | `approve_quote()` (cópia completa + contas a receber), RT → contas a pagar, produção por peça |
| `0026_migracao_legado.sql` | `migrate_document()` e conversão dos itens antigos com o mesmo total |

> **Aplicar em produção pelo SQL Editor:** `npm run db:bundle -- 0020` gera
> `supabase/bundles/migrations-0020-a-0026.sql` (uma transação, já registra em
> `schema_migrations`). **Testar antes, sempre local:** `npm run db:test` com
> `TEST_DATABASE_URL` apontando para um Postgres descartável em `localhost`.

## Convenções

- `id uuid primary key default gen_random_uuid()`
- `created_at`, `updated_at`, `created_by`, `updated_by` preenchidos por trigger
  (`public.tg_set_audit_fields`)
- Medidas em **milímetros** (`integer`); dinheiro em `numeric(14,2)`
- `is_demo boolean` nas tabelas de negócio, para separar dado de demonstração

## Tabelas por domínio

### Acesso
`roles` · `permissions` · `role_permissions` · `profiles` · `company_settings`

### Comercial e operação
`customers` · `quotes` · `work_orders` · `work_order_statuses` · `work_order_history` ·
`work_order_photos` · `work_order_attachments` · `quote_installments` · `technical_reserves` ·
`quote_attachments` · (`quote_items` e `work_order_items`: legado, sem uso desde a 0.2.0)

### Montagem (orçamento ou OS — ver [22](22-MONTAGEM-DO-ORCAMENTO.md))
`environments` · `line_items` · `line_item_materials` · `line_item_pieces` ·
`line_item_components` — cada linha tem `quote_id` **ou** `work_order_id`

### Campo e produção
`work_order_measurements` · `work_order_measurement_items` · `work_order_measurement_history` ·
`production_steps` · `production_records` · `installations` · `teams` · `team_members`

### Materiais e cadastros
`material_types` · `materials` · `products` (produtos e serviços: PRODUTO, ACABAMENTO, SERVICO,
REVENDA, INSUMO) · `lookup_options` (listas rápidas) · `stock_locations` · `stock_items` ·
`stock_movements`

### Gestão
`financial_accounts` · `financial_categories` · `financial_transactions` ·
`action_plans` · `alerts` · `audit_logs` · `document_counters` · `schema_migrations`

## Colunas geradas (calculadas pelo banco)

| Tabela | Coluna | Expressão |
|---|---|---|
| `line_item_pieces` | `area_m2` | quantidade × comprimento × largura, em m² (4 casas) |
| `line_item_pieces` | `area_with_waste_m2` | `area_m2 × (1 + waste_pct/100)` |
| `work_order_measurement_items` (e o legado) | `area_m2` | comprimento × largura × quantidade, em m² |
| `work_orders` | `pending_value` | `total_value - received_value` |

Valores **mantidos por trigger** (não digitados): m² e valor de cada material do produto,
total de cada acabamento/serviço/revenda/insumo, totais do produto (`line_items.total`),
`quotes.subtotal`/`total` e `work_orders.products_total`/`total_value`.
| `stock_items` | `area_m2` | comprimento × largura da chapa |
| `production_records` | `duration_minutes` | `finished_at - started_at` |

## Triggers

| Trigger | Efeito |
|---|---|
| `tg_set_audit_fields` | carimba created/updated + autor em toda tabela de negócio |
| `tg_work_order_number` / `tg_quote_number` | gera `OS-2026-0001` / `ORC-2026-0001` (reset anual) |
| `tg_recalc_work_order_total` / `tg_recalc_quote_total` | legado (itens antigos) |
| `tg_line_item_child_changed` / `tg_line_item_quantity_changed` / `tg_line_item_document` | montagem: peça/material/composição → produto → documento |
| `tg_quote_totals` / `tg_work_order_totals` | total = produtos + frete + outras − desconto |
| `tg_quote_status_guard` | APROVADO só pela aprovação; aprovado não muda |
| `tg_legacy_items_guard` | tela antiga não grava em documento já migrado |
| `tg_catalog_code` | código automático de material/produto |
| `tg_work_order_history` | timeline automática: status, prioridade, responsável, prazo, valor, cancelamento |
| `tg_measurement_history` | grava revisão + diff em JSON a cada alteração da medição |
| `tg_production_history` / `tg_installation_history` | lançam eventos na timeline da OS |
| `tg_sync_work_order_received` | recalcula `received_value` quando um título é pago |
| `tg_write_audit_log` | auditoria em OS, perfis, financeiro, estoque, configurações e permissões |
| `tg_handle_new_user` | cria o `profile` ao nascer o usuário no Auth (o 1º vira admin) |
| `tg_protect_profile_role` | impede o usuário de mudar o próprio papel |

## Funções de negócio

| Função | O que faz |
|---|---|
| `has_perm(text)` | verificação de permissão — base de toda policy |
| `current_role_code()` / `is_admin()` / `my_permissions()` | papel e permissões do usuário logado |
| `next_document_number(prefix)` | numeração sequencial por ano |
| `reserve_stock_item(item, os)` | reserva a chapa e registra movimento + timeline |
| `release_stock_item(item)` | libera a reserva |
| `consume_stock_item(item, os, área, sobra_c, sobra_l)` | baixa a chapa e cria o retalho aproveitável |
| `register_stock_loss(item, motivo, …)` | registra perda/descarte com motivo obrigatório |
| `approve_quote(quote, prazo, gerar_receber)` | aprova, copia a montagem inteira para a OS e lança as parcelas |
| `convert_quote_to_work_order(quote, prazo)` | compatibilidade: chama `approve_quote` sem parcelas |
| `save_line_item(json)` | grava produto + materiais + peças + composição numa transação |
| `save_environment` / `delete_environment` / `delete_line_item` / `duplicate_line_item` | montagem |
| `set_piece_status(peça, situação)` | situação de produção da peça (`production.write`) |
| `import_measurement(medição)` | medidas viram produtos e peças da OS |
| `save_quote_installments` / `generate_work_order_receivables` | fatura do orçamento / parcelas da OS |
| `save_technical_reserve` / `launch_technical_reserve` | RT e conta a pagar da RT |
| `finish_installation(instalação)` | conclui a instalação, finaliza a OS e marca as peças |
| `migrate_document(quote, os)` | converte itens antigos para a montagem (idempotente) |
| `recalc_line_item` / `recalc_document` | recálculo interno (sem acesso pela API) |
| `refresh_alerts()` | recalcula os alertas automáticos |

Todas as funções de escrita são `SECURITY DEFINER` e **checam `has_perm` na primeira linha**.

## Índices

Criados onde a operação busca de verdade: status e prazo da OS, cliente, responsável,
número (trigram para busca parcial), item de estoque por status/material/OS reservada,
movimentos por tipo e data, títulos por status e vencimento, histórico por OS.

## Backup

Supabase faz backup diário no plano gratuito. Para dump manual:

```bash
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner > backup.sql
```
