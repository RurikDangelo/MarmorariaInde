import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Banknote, CalendarClock } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge, PriorityBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { getCompanySettings, requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { daysUntil, formatCurrency, formatDate } from '@/lib/utils'
import {
  getAssignableUsers,
  getTeamsList,
  getWorkOrder,
  getWorkOrderFiles,
  getWorkOrderHistory,
  getWorkOrderInstallations,
  getWorkOrderMeasurements,
  getWorkOrderProduction,
  getWorkOrderStatuses,
  getWorkOrderStock,
  loadWorkOrder,
} from '@/features/work-orders/queries'
import { ensureNewItemsModel, getCatalog, getComposition } from '@/features/composition/queries'
import { summarizeMaterials } from '@/features/composition/components/materials-summary'
import { WorkOrderEditor } from '@/features/work-orders/components/editor/work-order-editor'
import { WorkOrderProcessTabs } from '@/features/work-orders/components/process-tabs'
import { CancelWorkOrderDialog, StatusChanger } from '@/features/work-orders/components/status-changer'
import { pieceOptions, workOrderEditorPermissions } from '@/features/work-orders/editor-data'
import type { FinancialTransaction, ProductionStep, StockItem, TechnicalReserve } from '@/types/database'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const workOrder = await getWorkOrder(id)
  return { title: workOrder ? `${workOrder.number}` : 'Ordem de serviço' }
}

/** A OS e a propria tela de montagem; o andamento (medicao, producao...) fica logo abaixo. */
export default async function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // sessao e OS juntas: a RLS ja protege a consulta
  const [user, loadedWorkOrder] = await Promise.all([requirePermission('work_orders.read'), getWorkOrder(id)])
  let workOrder = loadedWorkOrder
  if (!workOrder) notFound()

  // OS criada pela tela antiga: vira montagem nova ao abrir (mesmo total, idempotente)
  if (workOrder.items_model === 1) {
    await ensureNewItemsModel({ kind: 'work_order', id }, 1)
    workOrder = (await loadWorkOrder(id)) ?? workOrder
  }

  const supabase = await createClient()
  const can = (permission: Parameters<typeof user.permissions.has>[0]) => user.permissions.has(permission)

  // os dois lotes saem juntos (antes o segundo esperava o primeiro terminar)
  const [
    [composition, catalog, history, measurements, production, installations, reservedStock, files, statuses, users, teams, settings],
    [{ data: steps }, { data: availableStock }, { data: transactions }, { data: reserves }],
  ] = await Promise.all([
    Promise.all([
      getComposition({ kind: 'work_order', id }),
      getCatalog(),
      getWorkOrderHistory(id),
      can('measurements.read') ? getWorkOrderMeasurements(id) : Promise.resolve([]),
      can('production.read') ? getWorkOrderProduction(id) : Promise.resolve([]),
      can('installations.read') ? getWorkOrderInstallations(id) : Promise.resolve([]),
      can('stock.read') ? getWorkOrderStock(id) : Promise.resolve([]),
      getWorkOrderFiles(id),
      getWorkOrderStatuses(),
      getAssignableUsers(),
      getTeamsList(),
      getCompanySettings(),
    ]),
    Promise.all([
      supabase.from('production_steps').select('*').eq('active', true).order('sort_order').returns<ProductionStep[]>(),
      can('stock.read')
        ? supabase
            .from('stock_items')
            .select('*, material:materials!stock_items_material_id_fkey ( id, name, color )')
            .eq('status', 'DISPONIVEL')
            .order('is_remnant', { ascending: false })
            .limit(100)
            .returns<StockItem[]>()
        : Promise.resolve({ data: [] as StockItem[] }),
      can('financial.read')
        ? supabase
            .from('financial_transactions')
            .select('*, category:financial_categories!financial_transactions_category_id_fkey ( id, name, kind, color, active )')
            .eq('work_order_id', id)
            .order('due_date')
            .returns<FinancialTransaction[]>()
        : Promise.resolve({ data: [] as FinancialTransaction[] }),
      supabase.from('technical_reserves').select('*').eq('work_order_id', id).order('created_at').returns<TechnicalReserve[]>(),
    ]),
  ])

  const days = daysUntil(workOrder.deadline)
  const late = days !== null && days < 0 && !workOrder.finished_at && !workOrder.cancelled_at

  return (
    <PageContainer size="wide">
      <PageHeader
        title={workOrder.number}
        description={workOrder.title ?? workOrder.customer?.name ?? undefined}
        breadcrumb={[{ label: 'Ordens de serviço', href: '/os' }, { label: workOrder.number }]}
        badge={
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge label={workOrder.status?.label ?? workOrder.status_code} color={workOrder.status?.color} />
            <PriorityBadge priority={workOrder.priority} />
            {workOrder.is_demo && <Badge variant="warning">DEMO</Badge>}
            {workOrder.cancelled_at && <Badge variant="destructive">Cancelada</Badge>}
          </div>
        }
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            {!workOrder.cancelled_at && can('work_orders.status') && (
              <StatusChanger workOrderId={workOrder.id} currentStatus={workOrder.status_code} statuses={statuses} />
            )}
            {can('work_orders.write') && !workOrder.cancelled_at && <CancelWorkOrderDialog workOrderId={workOrder.id} />}
          </div>
        }
      />

      {workOrder.cancelled_at && workOrder.cancel_reason && (
        <p className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          OS cancelada em {formatDate(workOrder.cancelled_at)}: {workOrder.cancel_reason}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total da OS" value={formatCurrency(workOrder.total_value)} icon={Banknote} />
        <MetricCard label="Recebido" value={formatCurrency(workOrder.received_value)} icon={Banknote} tone="success" />
        <MetricCard
          label="Em aberto"
          value={formatCurrency(workOrder.pending_value)}
          icon={Banknote}
          tone={Number(workOrder.pending_value) > 0 ? 'warning' : 'success'}
        />
        <MetricCard
          label="Prazo"
          value={workOrder.deadline ? formatDate(workOrder.deadline) : 'Sem prazo'}
          icon={CalendarClock}
          tone={late ? 'destructive' : 'default'}
          hint={
            workOrder.finished_at
              ? `finalizada em ${formatDate(workOrder.finished_at)}`
              : days === null
                ? undefined
                : late
                  ? `${Math.abs(days)} dia(s) de atraso`
                  : `faltam ${days} dia(s)`
          }
        />
      </div>

      <WorkOrderEditor
        workOrder={workOrder}
        composition={composition}
        catalog={catalog}
        users={users}
        teams={teams}
        currentUserId={user.id}
        defaultWastePct={Number(settings?.default_waste_pct ?? 0)}
        permissions={workOrderEditorPermissions(user, workOrder)}
        reserves={reserves ?? []}
        receivables={(transactions ?? []).filter((transaction) => transaction.kind === 'RECEITA')}
      />

      <WorkOrderProcessTabs
        user={user}
        workOrder={workOrder}
        data={{
          history,
          measurements,
          production,
          steps: steps ?? [],
          pieces: pieceOptions(composition),
          installations,
          reservedStock,
          availableStock: availableStock ?? [],
          needs: summarizeMaterials(composition.items),
          transactions: transactions ?? [],
          photos: files.photos,
          attachments: files.attachments,
          users,
          teams,
        }}
      />
    </PageContainer>
  )
}
