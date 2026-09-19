import type { Metadata } from 'next'
import { FileText } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { DataTable, type Column } from '@/components/shared/data-table'
import { GenericStatusBadge } from '@/components/shared/status-badge'
import { ClearFiltersButton, FilterBar, FilterSelect, SearchInput } from '@/components/shared/filters'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { NewQuoteDialog } from '@/features/quotes/components/quote-components'
import type { Quote } from '@/types/database'

export const metadata: Metadata = { title: 'Orçamentos' }

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; status?: string }>
}) {
  const user = await requirePermission('quotes.read')
  const params = await searchParams
  const canWrite = user.permissions.has('quotes.write')
  const supabase = await createClient()

  let query = supabase
    .from('quotes')
    .select('*, customer:customers!quotes_customer_id_fkey ( id, name, city )', { count: 'exact' })

  if (params.status) query = query.eq('status', params.status)
  if (params.busca) {
    const term = params.busca.replace(/[%,()]/g, '')
    query = query.ilike('number', `%${term}%`)
  }

  const [{ data, count }, { data: customers }] = await Promise.all([
    query.order('created_at', { ascending: false }).limit(150).returns<Quote[]>(),
    supabase.from('customers').select('id, name').eq('active', true).order('name').limit(500),
  ])

  const rows = data ?? []
  const open = rows.filter((row) => row.status === 'RASCUNHO' || row.status === 'ENVIADO')
  const approved = rows.filter((row) => row.status === 'APROVADO')
  const openValue = open.reduce((sum, row) => sum + Number(row.total ?? 0), 0)

  const columns: Column<Quote>[] = [
    {
      key: 'number',
      header: 'Orçamento',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium">{row.number}</p>
          <p className="truncate text-xs text-muted-foreground">{row.customer?.name ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'issue',
      header: 'Emissão',
      render: (row) => <span className="text-sm tabular">{formatDate(row.issue_date)}</span>,
    },
    {
      key: 'valid',
      header: 'Validade',
      secondary: true,
      render: (row) => <span className="text-sm tabular">{formatDate(row.valid_until)}</span>,
    },
    {
      key: 'status',
      header: 'Situação',
      render: (row) => <GenericStatusBadge status={row.status} />,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (row) => <span className="text-sm font-medium tabular">{formatCurrency(row.total)}</span>,
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Orçamentos"
        description="Proposta → aprovação → ordem de serviço, sem redigitar nada."
        actions={canWrite ? <NewQuoteDialog customers={customers ?? []} /> : undefined}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Em aberto" value={open.length} icon={FileText} hint={formatCurrency(openValue)} />
        <MetricCard label="Aprovados" value={approved.length} icon={FileText} tone="success" />
        <MetricCard label="Total emitidos" value={count ?? rows.length} icon={FileText} />
      </section>

      <FilterBar>
        <SearchInput placeholder="Buscar por número…" />
        <FilterSelect
          paramName="status"
          label="Situação"
          allLabel="Todas"
          options={[
            { value: 'RASCUNHO', label: 'Rascunho' },
            { value: 'ENVIADO', label: 'Enviado' },
            { value: 'APROVADO', label: 'Aprovado' },
            { value: 'RECUSADO', label: 'Recusado' },
            { value: 'EXPIRADO', label: 'Expirado' },
            { value: 'CANCELADO', label: 'Cancelado' },
          ]}
        />
        <ClearFiltersButton keys={['busca', 'status']} />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/orcamentos/${row.id}`}
        emptyTitle="Nenhum orçamento"
        emptyDescription="Crie o orçamento, adicione os itens e aprove para gerar a OS."
        footer={`${count ?? rows.length} orçamento(s)`}
        mobileCard={(row) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{row.number}</p>
                <p className="truncate text-xs text-muted-foreground">{row.customer?.name}</p>
              </div>
              <GenericStatusBadge status={row.status} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatDate(row.issue_date)}</span>
              <span className="font-medium tabular text-foreground">{formatCurrency(row.total)}</span>
            </div>
          </div>
        )}
      />
    </PageContainer>
  )
}
