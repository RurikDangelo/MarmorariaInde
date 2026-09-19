import type { Metadata } from 'next'
import Link from 'next/link'
import { KanbanSquare, Plus } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import { PriorityBadge, StatusBadge } from '@/components/shared/status-badge'
import { ClearFiltersButton, FilterBar, FilterSelect, SearchInput } from '@/components/shared/filters'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { cn, daysUntil, formatCurrency, formatDate } from '@/lib/utils'
import { getAssignableUsers, getWorkOrderStatuses, listWorkOrders } from '@/features/work-orders/queries'
import type { WorkOrder } from '@/types/database'

export const metadata: Metadata = { title: 'Ordens de serviço' }

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function WorkOrdersPage({ searchParams }: PageProps) {
  const user = await requirePermission('work_orders.read')
  const params = await searchParams

  const [statuses, users, result] = await Promise.all([
    getWorkOrderStatuses(),
    getAssignableUsers(),
    listWorkOrders({
      busca: params.busca,
      status: params.status,
      prioridade: params.prioridade,
      responsavel: params.responsavel,
      situacao: (params.situacao as 'abertas' | 'atrasadas' | 'finalizadas' | 'canceladas') ?? undefined,
      pagina: params.pagina ? Number(params.pagina) : 1,
    }),
  ])

  const columns: Column<WorkOrder>[] = [
    {
      key: 'number',
      header: 'OS',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium">{row.number}</p>
          <p className="truncate text-xs text-muted-foreground">{row.customer?.name ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Serviço',
      secondary: true,
      render: (row) => (
        <span className="text-sm text-muted-foreground">{row.title ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Etapa',
      render: (row) => <StatusBadge label={row.status?.label ?? row.status_code} color={row.status?.color} />,
    },
    {
      key: 'priority',
      header: 'Prioridade',
      secondary: true,
      render: (row) => <PriorityBadge priority={row.priority} />,
    },
    {
      key: 'deadline',
      header: 'Prazo',
      render: (row) => <DeadlineCell row={row} />,
    },
    {
      key: 'assignee',
      header: 'Responsável',
      secondary: true,
      render: (row) => <span className="text-sm">{row.assignee?.full_name ?? '—'}</span>,
    },
    {
      key: 'value',
      header: 'Valor',
      align: 'right',
      render: (row) => (
        <div>
          <p className="tabular font-medium">{formatCurrency(row.total_value)}</p>
          {row.pending_value > 0 && (
            <p className="tabular text-xs text-muted-foreground">
              {formatCurrency(row.pending_value)} em aberto
            </p>
          )}
        </div>
      ),
    },
  ]

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Ordens de serviço"
        description="Do orçamento aprovado até a instalação finalizada."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/os/kanban">
                <KanbanSquare />
                Kanban
              </Link>
            </Button>
            {user.permissions.has('work_orders.write') && (
              <Button asChild>
                <Link href="/os/nova">
                  <Plus />
                  Nova OS
                </Link>
              </Button>
            )}
          </>
        }
      />

      <FilterBar>
        <SearchInput placeholder="Buscar por número ou serviço…" />
        <FilterSelect
          paramName="status"
          label="Etapa"
          allLabel="Todas as etapas"
          options={statuses.map((status) => ({ value: status.code, label: status.label }))}
        />
        <FilterSelect
          paramName="prioridade"
          label="Prioridade"
          allLabel="Todas"
          options={[
            { value: 'URGENTE', label: 'Urgente' },
            { value: 'ALTA', label: 'Alta' },
            { value: 'NORMAL', label: 'Normal' },
            { value: 'BAIXA', label: 'Baixa' },
          ]}
        />
        <FilterSelect
          paramName="situacao"
          label="Situação"
          allLabel="Todas"
          options={[
            { value: 'abertas', label: 'Em aberto' },
            { value: 'atrasadas', label: 'Atrasadas' },
            { value: 'finalizadas', label: 'Finalizadas' },
            { value: 'canceladas', label: 'Canceladas' },
          ]}
        />
        <FilterSelect
          paramName="responsavel"
          label="Responsável"
          allLabel="Todos"
          options={users.map((item) => ({ value: item.id, label: item.full_name }))}
        />
        <ClearFiltersButton keys={['busca', 'status', 'prioridade', 'situacao', 'responsavel']} />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={result.rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/os/${row.id}`}
        emptyTitle="Nenhuma ordem de serviço encontrada"
        emptyDescription="Ajuste os filtros ou crie a primeira OS."
        emptyAction={
          user.permissions.has('work_orders.write') ? (
            <Button asChild size="sm">
              <Link href="/os/nova">
                <Plus />
                Nova OS
              </Link>
            </Button>
          ) : undefined
        }
        footer={`${result.total} ${result.total === 1 ? 'ordem' : 'ordens'} · página ${result.page} de ${result.totalPages}`}
        mobileCard={(row) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{row.number}</p>
                <p className="truncate text-sm text-muted-foreground">{row.customer?.name ?? '—'}</p>
              </div>
              <StatusBadge label={row.status?.label ?? row.status_code} color={row.status?.color} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <PriorityBadge priority={row.priority} />
              <DeadlineCell row={row} compact />
              <span className="tabular ml-auto font-medium text-foreground">
                {formatCurrency(row.total_value)}
              </span>
            </div>
          </div>
        )}
      />

      <Pagination page={result.page} totalPages={result.totalPages} params={params} />
    </PageContainer>
  )
}

function DeadlineCell({ row, compact }: { row: WorkOrder; compact?: boolean }) {
  if (!row.deadline) return <span className="text-sm text-muted-foreground">—</span>
  const days = daysUntil(row.deadline)
  const closed = !!row.finished_at || !!row.cancelled_at
  const late = !closed && days !== null && days < 0
  const near = !closed && days !== null && days >= 0 && days <= 3

  return (
    <span
      className={cn(
        'text-sm tabular',
        late && 'font-medium text-destructive',
        near && 'font-medium text-warning',
        compact && 'text-xs',
      )}
    >
      {formatDate(row.deadline)}
      {late && !compact && <Badge variant="destructive" size="sm" className="ml-1.5">atrasada</Badge>}
      {late && compact && ' · atrasada'}
    </span>
  )
}

function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number
  totalPages: number
  params: Record<string, string | undefined>
}) {
  if (totalPages <= 1) return null

  const buildHref = (target: number) => {
    const next = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== undefined) as [string, string][],
    )
    next.set('pagina', String(target))
    return `/os?${next.toString()}`
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
        {page > 1 ? <Link href={buildHref(page - 1)}>Anterior</Link> : <span>Anterior</span>}
      </Button>
      <span className="text-sm text-muted-foreground">
        Página {page} de {totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
        {page < totalPages ? <Link href={buildHref(page + 1)}>Próxima</Link> : <span>Próxima</span>}
      </Button>
    </div>
  )
}
