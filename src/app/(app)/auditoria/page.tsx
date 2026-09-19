import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import { ClearFiltersButton, FilterBar, FilterSelect } from '@/components/shared/filters'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import type { AuditLog } from '@/types/database'

export const metadata: Metadata = { title: 'Auditoria' }

const TABLE_LABELS: Record<string, string> = {
  work_orders: 'Ordens de serviço',
  profiles: 'Usuários',
  financial_transactions: 'Financeiro',
  stock_items: 'Estoque',
  company_settings: 'Configurações',
  role_permissions: 'Permissões',
}

const ACTION_LABELS: Record<string, { label: string; variant: 'success' | 'info' | 'destructive' }> = {
  INSERT: { label: 'Criação', variant: 'success' },
  UPDATE: { label: 'Alteração', variant: 'info' },
  DELETE: { label: 'Exclusão', variant: 'destructive' },
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ tabela?: string; acao?: string }>
}) {
  await requirePermission('audit.read')
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('audit_logs')
    .select('*, actor:profiles!audit_logs_actor_id_fkey ( id, full_name )', { count: 'exact' })

  if (params.tabela) query = query.eq('table_name', params.tabela)
  if (params.acao) query = query.eq('action', params.acao)

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .limit(200)
    .returns<AuditLog[]>()

  const rows = data ?? []

  const columns: Column<AuditLog>[] = [
    {
      key: 'when',
      header: 'Quando',
      render: (row) => <span className="text-sm tabular">{formatDateTime(row.created_at)}</span>,
    },
    {
      key: 'actor',
      header: 'Quem',
      render: (row) => <span className="text-sm">{row.actor?.full_name ?? 'sistema'}</span>,
    },
    {
      key: 'table',
      header: 'Onde',
      render: (row) => (
        <span className="text-sm">{TABLE_LABELS[row.table_name] ?? row.table_name}</span>
      ),
    },
    {
      key: 'action',
      header: 'O quê',
      render: (row) => {
        const config = ACTION_LABELS[row.action] ?? { label: row.action, variant: 'info' as const }
        return <Badge variant={config.variant}>{config.label}</Badge>
      },
    },
    {
      key: 'changes',
      header: 'Campos alterados',
      secondary: true,
      render: (row) => {
        const keys = row.changes ? Object.keys(row.changes) : []
        if (!keys.length) return <span className="text-sm text-muted-foreground">—</span>
        return (
          <span className="text-xs text-muted-foreground">
            {keys.slice(0, 5).join(', ')}
            {keys.length > 5 ? ` +${keys.length - 5}` : ''}
          </span>
        )
      },
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Auditoria"
        description="Registro imutável de quem alterou o quê nas tabelas sensíveis."
        badge={
          <Badge variant="secondary">
            <ShieldCheck className="size-3" />
            somente leitura
          </Badge>
        }
      />

      <FilterBar>
        <FilterSelect
          paramName="tabela"
          label="Tabela"
          allLabel="Todas"
          options={Object.entries(TABLE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          paramName="acao"
          label="Ação"
          allLabel="Todas"
          options={[
            { value: 'INSERT', label: 'Criação' },
            { value: 'UPDATE', label: 'Alteração' },
            { value: 'DELETE', label: 'Exclusão' },
          ]}
        />
        <ClearFiltersButton keys={['tabela', 'acao']} />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyTitle="Nenhum registro de auditoria"
        footer={`${rows.length} de ${count ?? rows.length} registro(s) · mostrando os 200 mais recentes`}
        mobileCard={(row) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{TABLE_LABELS[row.table_name] ?? row.table_name}</span>
              <Badge variant={ACTION_LABELS[row.action]?.variant ?? 'info'} size="sm">
                {ACTION_LABELS[row.action]?.label ?? row.action}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {row.actor?.full_name ?? 'sistema'} · {formatDateTime(row.created_at)}
            </p>
          </div>
        )}
      />
    </PageContainer>
  )
}
