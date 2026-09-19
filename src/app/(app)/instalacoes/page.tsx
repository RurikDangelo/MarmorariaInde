import type { Metadata } from 'next'
import { CalendarClock, MapPin, Users } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { DataTable, type Column } from '@/components/shared/data-table'
import { GenericStatusBadge } from '@/components/shared/status-badge'
import { ClearFiltersButton, FilterBar, FilterSelect } from '@/components/shared/filters'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import type { Installation } from '@/types/database'

export const metadata: Metadata = { title: 'Instalações' }

export default async function InstallationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requirePermission('installations.read')
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('installations')
    .select(
      `*,
       team:teams!installations_team_id_fkey ( id, name ),
       responsible:profiles!installations_responsible_id_fkey ( id, full_name ),
       work_order:work_orders!installations_work_order_id_fkey (
         id, number,
         customer:customers!work_orders_customer_id_fkey ( name )
       )`,
      { count: 'exact' },
    )

  if (params.status) query = query.eq('status', params.status)

  const { data, count } = await query
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(150)
    .returns<Installation[]>()

  const rows = data ?? []
  const scheduled = rows.filter((row) => row.status === 'AGENDADA' || row.status === 'REAGENDADA')
  const noTeam = scheduled.filter((row) => !row.team_id)
  const done = rows.filter((row) => row.status === 'CONCLUIDA')

  const columns: Column<Installation>[] = [
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
          {row.scheduled_at ? formatDateTime(row.scheduled_at) : 'sem data'}
        </span>
      ),
    },
    {
      key: 'team',
      header: 'Equipe',
      render: (row) =>
        row.team ? (
          <span className="text-sm">{row.team.name}</span>
        ) : (
          <Badge variant="warning">sem equipe</Badge>
        ),
    },
    {
      key: 'address',
      header: 'Local',
      secondary: true,
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {[row.district, row.city].filter(Boolean).join(' · ') || '—'}
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
        title="Instalações"
        description="Agenda das equipes em obra e checklist de entrega."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Agendadas" value={scheduled.length} icon={CalendarClock} tone="info" />
        <MetricCard
          label="Sem equipe definida"
          value={noTeam.length}
          icon={Users}
          tone={noTeam.length ? 'destructive' : 'success'}
        />
        <MetricCard label="Concluídas" value={done.length} icon={MapPin} tone="success" />
      </section>

      <FilterBar>
        <FilterSelect
          paramName="status"
          label="Situação"
          allLabel="Todas"
          options={[
            { value: 'AGENDADA', label: 'Agendada' },
            { value: 'EM_ANDAMENTO', label: 'Em andamento' },
            { value: 'CONCLUIDA', label: 'Concluída' },
            { value: 'REAGENDADA', label: 'Reagendada' },
            { value: 'CANCELADA', label: 'Cancelada' },
          ]}
        />
        <ClearFiltersButton keys={['status']} />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => (row.work_order ? `/os/${row.work_order.id}` : '#')}
        emptyTitle="Nenhuma instalação agendada"
        emptyDescription="As instalações são agendadas dentro da OS, na aba Instalação."
        footer={`${count ?? rows.length} instalação(ões)`}
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
              {row.scheduled_at ? formatDateTime(row.scheduled_at) : 'sem data'} ·{' '}
              {row.team?.name ?? 'sem equipe'}
            </p>
          </div>
        )}
      />
    </PageContainer>
  )
}
