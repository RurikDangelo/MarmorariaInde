import type { Metadata } from 'next'
import Link from 'next/link'
import { ListChecks } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { DataTable, type Column } from '@/components/shared/data-table'
import { GenericStatusBadge, PriorityBadge } from '@/components/shared/status-badge'
import { ClearFiltersButton, FilterBar, FilterSelect } from '@/components/shared/filters'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { ActionPlanDialog, ActionPlanStatusSelect } from '@/features/management/components/action-plan-dialog'
import type { ActionPlan } from '@/types/database'

export const metadata: Metadata = { title: 'Planos de ação' }

export default async function ActionPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const user = await requirePermission('action_plans.read')
  const params = await searchParams
  const canWrite = user.permissions.has('action_plans.write')
  const supabase = await createClient()

  let query = supabase
    .from('action_plans')
    .select(
      `*,
       responsible:profiles!action_plans_responsible_id_fkey ( id, full_name ),
       work_order:work_orders!action_plans_work_order_id_fkey ( id, number )`,
      { count: 'exact' },
    )

  if (params.status) query = query.eq('status', params.status)

  const [{ data, count }, { data: users }, { data: workOrders }] = await Promise.all([
    query.order('due_date', { ascending: true, nullsFirst: false }).limit(150).returns<ActionPlan[]>(),
    supabase.from('profiles').select('id, full_name').eq('active', true).order('full_name'),
    supabase.from('work_orders').select('id, number').is('cancelled_at', null).order('created_at', { ascending: false }).limit(100),
  ])

  const rows = data ?? []
  const today = new Date().toISOString().slice(0, 10)
  const open = rows.filter((row) => row.status === 'ABERTO' || row.status === 'EM_ANDAMENTO')
  const late = open.filter((row) => row.due_date && row.due_date < today)
  const done = rows.filter((row) => row.status === 'CONCLUIDO')

  const columns: Column<ActionPlan>[] = [
    {
      key: 'title',
      header: 'Plano',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium">{row.title}</p>
          {row.problem && <p className="truncate text-xs text-muted-foreground">{row.problem}</p>}
          {row.work_order && (
            <Link href={`/os/${row.work_order.id}`} className="text-xs text-primary hover:underline">
              OS {row.work_order.number}
            </Link>
          )}
        </div>
      ),
    },
    {
      key: 'responsible',
      header: 'Responsável',
      render: (row) => <span className="text-sm">{row.responsible?.full_name ?? '—'}</span>,
    },
    {
      key: 'priority',
      header: 'Prioridade',
      secondary: true,
      render: (row) => <PriorityBadge priority={row.priority} />,
    },
    {
      key: 'due',
      header: 'Prazo',
      render: (row) => (
        <span className="text-sm tabular">
          {row.due_date ? formatDate(row.due_date) : '—'}
          {row.due_date && row.due_date < today && row.status !== 'CONCLUIDO' && (
            <Badge variant="destructive" size="sm" className="ml-1.5">
              atrasado
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Situação',
      render: (row) =>
        canWrite ? (
          <ActionPlanStatusSelect planId={row.id} status={row.status} />
        ) : (
          <GenericStatusBadge status={row.status} />
        ),
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Planos de ação"
        description="Problema, ação combinada, responsável e prazo — para o erro não se repetir."
        actions={
          canWrite ? <ActionPlanDialog users={users ?? []} workOrders={workOrders ?? []} /> : undefined
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Em andamento" value={open.length} icon={ListChecks} />
        <MetricCard label="Atrasados" value={late.length} icon={ListChecks} tone={late.length ? 'destructive' : 'success'} />
        <MetricCard label="Concluídos" value={done.length} icon={ListChecks} tone="success" />
      </section>

      <FilterBar>
        <FilterSelect
          paramName="status"
          label="Situação"
          allLabel="Todas"
          options={[
            { value: 'ABERTO', label: 'Aberto' },
            { value: 'EM_ANDAMENTO', label: 'Em andamento' },
            { value: 'CONCLUIDO', label: 'Concluído' },
            { value: 'CANCELADO', label: 'Cancelado' },
          ]}
        />
        <ClearFiltersButton keys={['status']} />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyTitle="Nenhum plano de ação"
        emptyDescription="Registre o que precisa mudar quando algo dá errado na operação."
        footer={`${count ?? rows.length} plano(s)`}
        mobileCard={(row) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{row.title}</p>
              <GenericStatusBadge status={row.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {row.responsible?.full_name ?? 'sem responsável'}
              {row.due_date ? ` · ${formatDate(row.due_date)}` : ''}
            </p>
          </div>
        )}
      />
    </PageContainer>
  )
}
