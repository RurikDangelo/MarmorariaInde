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
`customers` · `quotes` · `quote_items` · `work_orders` · `work_order_items` ·
`work_order_statuses` · `work_order_history` · `work_order_photos` · `work_order_attachments`

### Campo e produção
`work_order_measurements` · `work_order_measurement_items` · `work_order_measurement_history` ·
`production_steps` · `production_records` · `installations` · `teams` · `team_members`

### Materiais
`material_types` · `materials` · `products` · `stock_locations` · `stock_items` · `stock_movements`

### Gestão
`financial_accounts` · `financial_categories` · `financial_transactions` ·
`action_plans` · `alerts` · `audit_logs` · `document_counters` · `schema_migrations`

## Colunas geradas (calculadas pelo banco)

| Tabela | Coluna | Expressão |
|---|---|---|
| `work_order_items`, `quote_items`, `work_order_measurement_items` | `area_m2` | comprimento × largura × quantidade, em m² |
| `work_order_items`, `quote_items` | `total_price` | conforme `pricing_mode` (M2 / ML / UN) |
| `work_orders` | `pending_value` | `total_value - received_value` |
| `stock_items` | `area_m2` | comprimento × largura da chapa |
| `production_records` | `duration_minutes` | `finished_at - started_at` |

## Triggers

| Trigger | Efeito |
|---|---|
| `tg_set_audit_fields` | carimba created/updated + autor em toda tabela de negócio |
| `tg_work_order_number` / `tg_quote_number` | gera `OS-2026-0001` / `ORC-2026-0001` (reset anual) |
| `tg_recalc_work_order_total` / `tg_recalc_quote_total` | soma os itens e grava o total |
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
| `convert_quote_to_work_order(quote, prazo)` | aprova o orçamento e cria a OS com os itens |
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
