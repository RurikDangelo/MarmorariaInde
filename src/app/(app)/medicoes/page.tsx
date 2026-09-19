import type { Metadata } from 'next'
import Link from 'next/link'
import { Ruler } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import { GenericStatusBadge } from '@/components/shared/status-badge'
import { ClearFiltersButton, FilterBar, FilterSelect, SearchInput } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import type { Measurement } from '@/types/database'

export const metadata: Metadata = { title: 'Medições' }

export default async function MeasurementsPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; status?: string }>
}) {
  await requirePermission('measurements.read')
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('work_order_measurements')
    .select(
      `*,
       responsible:profiles!work_order_measurements_responsible_id_fkey ( id, full_name ),
       work_order:work_orders!work_order_measurements_work_order_id_fkey (
         id, number, customer_id,
         customer:customers!work_orders_customer_id_fkey ( id, name, phone, city )
       )`,
      { count: 'exact' },
    )

  if (params.status) query = query.eq('status', params.status)

  const { data, count } = await query
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(150)
    .returns<Measurement[]>()

  const rows = (data ?? []).filter((row) => {
    if (!params.busca) return true
    const term = params.busca.toLowerCase()
    return (
      row.work_order?.number.toLowerCase().includes(term) ||
      row.work_order?.customer?.name.toLowerCase().includes(term)
    )
  })

  const pending = rows.filter((row) => row.status === 'PENDENTE' || row.status === 'AGENDADA')
  const approved = rows.filter((row) => row.approved)

  const columns: Column<Measurement>[] = [
    {
      key: 'os',
      header: 'OS / cliente',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium">{row.work_order?.number ?? '—'}</p>
          <p className="truncate text-xs text-muted-foreground">{row.work_order?.customer?.name ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'Agenda',
      render: (row) => (
        <span className="text-sm">
          {row.measured_at
            ? `medida ${formatDateTime(row.measured_at)}`
            : row.scheduled_at
              ? formatDateTime(row.scheduled_at)
              : 'sem data'}
        </span>
      ),
    },
    {
      key: 'responsible',
      header: 'Responsável',
      secondary: true,
      render: (row) => <span className="text-sm">{row.responsible?.full_name ?? '—'}</span>,
    },
    {
      key: 'local',
      header: 'Local',
      secondary: true,
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {[row.district, row.city].filter(Boolean).join(' · ') || row.work_order?.customer?.city || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Situação',
      render: (row) => <GenericStatusBadge status={row.status} />,
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Medições"
        description="Agenda de campo e conferência das medidas antes de cortar."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Pendentes / agendadas" value={pending.length} icon={Ruler} tone={pending.length ? 'warning' : 'success'} />
        <MetricCard label="Aprovadas" value={approved.length} icon={Ruler} tone="success" />
        <MetricCard label="Total registradas" value={count ?? rows.length} icon={Ruler} />
      </section>

      <FilterBar>
        <SearchInput placeholder="Buscar por OS ou cliente…" />
        <FilterSelect
          paramName="status"
          label="Situação"
          allLabel="Todas"
          options={[
            { value: 'PENDENTE', label: 'Pendente' },
            { value: 'AGENDADA', label: 'Agendada' },
            { value: 'REALIZADA', label: 'Realizada' },
            { value: 'APROVADA', label: 'Aprovada' },
            { value: 'REPROVADA', label: 'Reprovada' },
          ]}
        />
        <ClearFiltersButton keys={['busca', 'status']} />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => (row.work_order ? `/os/${row.work_order.id}` : '#')}
        emptyTitle="Nenhuma medição registrada"
        emptyDescription="As medições são criadas dentro da OS, na aba Medição."
        footer={
          <span>
            {rows.length} medição(ões) ·{' '}
            <Link href="/os" className="underline">
              abrir ordens de serviço
            </Link>
          </span>
        }
        mobileCard={(row) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{row.work_order?.number}</p>
                <p className="truncate text-xs text-muted-foreground">{row.work_order?.customer?.name}</p>
              </div>
              <GenericStatusBadge status={row.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {row.measured_at ? formatDateTime(row.measured_at) : row.scheduled_at ? formatDateTime(row.scheduled_at) : 'sem data'}
              {row.responsible?.full_name ? ` · ${row.responsible.full_name}` : ''}
            </p>
          </div>
        )}
      />
    </PageContainer>
  )
}
