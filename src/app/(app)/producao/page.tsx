import type { Metadata } from 'next'
import Link from 'next/link'
import { Hammer, RotateCcw, Timer } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { DataTable, type Column } from '@/components/shared/data-table'
import { GenericStatusBadge } from '@/components/shared/status-badge'
import { ClearFiltersButton, FilterBar, FilterSelect } from '@/components/shared/filters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime, formatNumber } from '@/lib/utils'
import type { ProductionRecord, ProductionStep } from '@/types/database'

export const metadata: Metadata = { title: 'Produção' }

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ etapa?: string; status?: string }>
}) {
  await requirePermission('production.read')
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('production_records')
    .select(
      `*,
       step:production_steps!production_records_step_code_fkey ( code, label, sort_order, active ),
       responsible:profiles!production_records_responsible_id_fkey ( id, full_name ),
       work_order:work_orders!production_records_work_order_id_fkey (
         id, number,
         customer:customers!work_orders_customer_id_fkey ( name )
       )`,
      { count: 'exact' },
    )

  if (params.etapa) query = query.eq('step_code', params.etapa)
  if (params.status) query = query.eq('status', params.status)

  const [{ data: records, count }, { data: steps }] = await Promise.all([
    query.order('created_at', { ascending: false }).limit(150).returns<ProductionRecord[]>(),
    supabase.from('production_steps').select('*').eq('active', true).order('sort_order').returns<ProductionStep[]>(),
  ])

  const rows = records ?? []
  const inProgress = rows.filter((row) => row.status === 'EM_ANDAMENTO')
  const rework = rows.filter((row) => row.is_rework)
  const durations = rows
    .filter((row) => row.duration_minutes != null)
    .map((row) => row.duration_minutes as number)
  const avgDuration = durations.length
    ? durations.reduce((sum, value) => sum + value, 0) / durations.length
    : null

  const columns: Column<ProductionRecord>[] = [
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
      key: 'step',
      header: 'Etapa',
      render: (row) => (
        <span className="text-sm">
          {row.step?.label ?? row.step_code}
          {row.is_rework && <span className="ml-1.5 text-xs text-destructive">retrabalho</span>}
        </span>
      ),
    },
    {
      key: 'responsible',
      header: 'Responsável',
      render: (row) => <span className="text-sm">{row.responsible?.full_name ?? '—'}</span>,
    },
    {
      key: 'time',
      header: 'Período',
      secondary: true,
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.started_at ? formatDateTime(row.started_at) : '—'}
          {row.finished_at ? ` → ${formatDateTime(row.finished_at)}` : ''}
        </span>
      ),
    },
    {
      key: 'duration',
      header: 'Duração',
      align: 'right',
      render: (row) => (
        <span className="text-sm tabular">
          {row.duration_minutes != null ? formatDuration(row.duration_minutes) : '—'}
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
    <PageContainer size="wide">
      <PageHeader
        title="Produção"
        description="Apontamentos de separação, corte, acabamento, polimento e expedição."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Em andamento" value={inProgress.length} icon={Hammer} tone="info" />
        <MetricCard label="Apontamentos" value={count ?? rows.length} icon={Hammer} />
        <MetricCard label="Retrabalhos" value={rework.length} icon={RotateCcw} tone={rework.length ? 'destructive' : 'success'} />
        <MetricCard
          label="Duração média"
          value={avgDuration != null ? formatDuration(Math.round(avgDuration)) : '—'}
          icon={Timer}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Carga por etapa</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(steps ?? []).map((step) => {
              const stepRecords = rows.filter((row) => row.step_code === step.code)
              const active = stepRecords.filter((row) => row.status === 'EM_ANDAMENTO').length
              return (
                <li key={step.code} className="rounded-md border px-3 py-2">
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {active} em andamento · {stepRecords.length} no total
                  </p>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <FilterBar>
        <FilterSelect
          paramName="etapa"
          label="Etapa"
          allLabel="Todas as etapas"
          options={(steps ?? []).map((step) => ({ value: step.code, label: step.label }))}
        />
        <FilterSelect
          paramName="status"
          label="Situação"
          allLabel="Todas"
          options={[
            { value: 'PENDENTE', label: 'Pendente' },
            { value: 'EM_ANDAMENTO', label: 'Em andamento' },
            { value: 'PAUSADO', label: 'Pausado' },
            { value: 'CONCLUIDO', label: 'Concluído' },
            { value: 'RETRABALHO', label: 'Retrabalho' },
          ]}
        />
        <ClearFiltersButton keys={['etapa', 'status']} />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => (row.work_order ? `/os/${row.work_order.id}` : '#')}
        emptyTitle="Nenhum apontamento de produção"
        emptyDescription="Os apontamentos são feitos dentro da OS, na aba Produção."
        footer={
          <span>
            <Link href="/os/kanban" className="underline">
              Abrir o Kanban da produção
            </Link>
          </span>
        }
        mobileCard={(row) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{row.work_order?.number}</p>
                <p className="truncate text-xs text-muted-foreground">{row.step?.label ?? row.step_code}</p>
              </div>
              <GenericStatusBadge status={row.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {row.responsible?.full_name ?? 'sem responsável'}
              {row.duration_minutes != null ? ` · ${formatDuration(row.duration_minutes)}` : ''}
            </p>
          </div>
        )}
      />
    </PageContainer>
  )
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${formatNumber(hours, 0)}h`
}
