import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Banknote,
  CalendarClock,
  Hammer,
  MapPin,
  Pencil,
  Phone,
  Printer,
  Ruler,
  User,
} from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge, PriorityBadge, GenericStatusBadge } from '@/components/shared/status-badge'
import { Timeline } from '@/components/shared/timeline'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { cn, daysUntil, formatCurrency, formatDate, formatDateTime, whatsappLink } from '@/lib/utils'
import {
  getAssignableUsers,
  getMaterialsList,
  getTeamsList,
  getWorkOrder,
  getWorkOrderFiles,
  getWorkOrderHistory,
  getWorkOrderInstallations,
  getWorkOrderItems,
  getWorkOrderMeasurements,
  getWorkOrderProduction,
  getWorkOrderStatuses,
  getWorkOrderStock,
} from '@/features/work-orders/queries'
import { ItemsEditor } from '@/features/work-orders/components/items-editor'
import { CancelWorkOrderDialog, StatusChanger } from '@/features/work-orders/components/status-changer'
import { MeasurementPanel } from '@/features/work-orders/components/measurement-panel'
import { ProductionPanel } from '@/features/work-orders/components/production-panel'
import { MaterialPanel } from '@/features/work-orders/components/material-panel'
import { InstallationPanel } from '@/features/work-orders/components/installation-panel'
import { FilesPanel } from '@/features/work-orders/components/files-panel'
import { NoteForm } from '@/features/work-orders/components/note-form'
import type { FinancialTransaction, ProductionStep, StockItem } from '@/types/database'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const workOrder = await getWorkOrder(id)
  return { title: workOrder ? `${workOrder.number}` : 'Ordem de serviço' }
}

export default async function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requirePermission('work_orders.read')
  const workOrder = await getWorkOrder(id)
  if (!workOrder) notFound()

  const supabase = await createClient()

  const [
    items,
    history,
    measurements,
    production,
    installations,
    reservedStock,
    files,
    statuses,
    users,
    teams,
    materials,
  ] = await Promise.all([
    getWorkOrderItems(id),
    getWorkOrderHistory(id),
    user.permissions.has('measurements.read') ? getWorkOrderMeasurements(id) : Promise.resolve([]),
    user.permissions.has('production.read') ? getWorkOrderProduction(id) : Promise.resolve([]),
    user.permissions.has('installations.read') ? getWorkOrderInstallations(id) : Promise.resolve([]),
    user.permissions.has('stock.read') ? getWorkOrderStock(id) : Promise.resolve([]),
    getWorkOrderFiles(id),
    getWorkOrderStatuses(),
    getAssignableUsers(),
    getTeamsList(),
    getMaterialsList(),
  ])

  const [{ data: steps }, { data: availableStock }, { data: transactions }] = await Promise.all([
    supabase.from('production_steps').select('*').eq('active', true).order('sort_order').returns<ProductionStep[]>(),
    user.permissions.has('stock.read')
      ? supabase
          .from('stock_items')
          .select('*, material:materials!stock_items_material_id_fkey ( id, name, color )')
          .eq('status', 'DISPONIVEL')
          .order('is_remnant', { ascending: false })
          .limit(100)
          .returns<StockItem[]>()
      : Promise.resolve({ data: [] as StockItem[] }),
    user.permissions.has('financial.read')
      ? supabase
          .from('financial_transactions')
          .select('*, category:financial_categories!financial_transactions_category_id_fkey ( id, name, kind, color, active )')
          .eq('work_order_id', id)
          .order('due_date')
          .returns<FinancialTransaction[]>()
      : Promise.resolve({ data: [] as FinancialTransaction[] }),
  ])

  const canWriteOS = user.permissions.has('work_orders.write')
  const days = daysUntil(workOrder.deadline)
  const late = days !== null && days < 0 && !workOrder.finished_at && !workOrder.cancelled_at
  const customerPhone = workOrder.customer?.whatsapp ?? workOrder.customer?.phone
  const whatsapp = whatsappLink(
    customerPhone,
    `Olá! Sobre a ordem de serviço ${workOrder.number} da Marmoraria Independência.`,
  )

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
            {!workOrder.cancelled_at && user.permissions.has('work_orders.status') && (
              <StatusChanger
                workOrderId={workOrder.id}
                currentStatus={workOrder.status_code}
                statuses={statuses}
              />
            )}
            {canWriteOS && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/os/${workOrder.id}/editar`}>
                  <Pencil />
                  Editar
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/os/${workOrder.id}/imprimir`} target="_blank">
                <Printer />
                Imprimir
              </Link>
            </Button>
            {canWriteOS && !workOrder.cancelled_at && <CancelWorkOrderDialog workOrderId={workOrder.id} />}
          </div>
        }
      />

      {workOrder.cancelled_at && workOrder.cancel_reason && (
        <p className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          OS cancelada em {formatDate(workOrder.cancelled_at)}: {workOrder.cancel_reason}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Valor total" value={formatCurrency(workOrder.total_value)} icon={Banknote} />
        <MetricCard
          label="Recebido"
          value={formatCurrency(workOrder.received_value)}
          icon={Banknote}
          tone="success"
          hint={
            workOrder.total_value > 0
              ? `${Math.round((Number(workOrder.received_value) / Number(workOrder.total_value)) * 100)}% do total`
              : undefined
          }
        />
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

      <Tabs defaultValue="resumo">
        <TabsList className="no-print">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          {user.permissions.has('measurements.read') && <TabsTrigger value="medicao">Medição</TabsTrigger>}
          {user.permissions.has('production.read') && <TabsTrigger value="producao">Produção</TabsTrigger>}
          {user.permissions.has('stock.read') && <TabsTrigger value="material">Material</TabsTrigger>}
          {user.permissions.has('installations.read') && <TabsTrigger value="instalacao">Instalação</TabsTrigger>}
          {user.permissions.has('financial.read') && <TabsTrigger value="financeiro">Financeiro</TabsTrigger>}
          <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="flex flex-col gap-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Cliente e local de execução</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium">{workOrder.customer?.name ?? '—'}</p>
                  {customerPhone && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Phone className="size-3.5" />
                      {customerPhone}
                      {whatsapp && (
                        <a
                          href={whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-success underline-offset-2 hover:underline"
                        >
                          WhatsApp
                        </a>
                      )}
                    </p>
                  )}
                  {workOrder.customer && (
                    <Link
                      href={`/clientes/${workOrder.customer.id}`}
                      className="mt-1 inline-block text-xs text-primary underline-offset-2 hover:underline"
                    >
                      Ver cadastro
                    </Link>
                  )}
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Endereço de execução</p>
                  {workOrder.address ? (
                    <p className="text-sm">
                      <MapPin className="mr-1 inline size-3.5 text-muted-foreground" />
                      {workOrder.address}
                      {workOrder.address_number ? `, ${workOrder.address_number}` : ''}
                      {workOrder.complement ? ` · ${workOrder.complement}` : ''}
                      <br />
                      <span className="text-muted-foreground">
                        {[workOrder.district, workOrder.city, workOrder.state].filter(Boolean).join(' · ')}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Não informado</p>
                  )}
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Responsável</p>
                  <p className="text-sm">
                    <User className="mr-1 inline size-3.5 text-muted-foreground" />
                    {workOrder.assignee?.full_name ?? 'Sem responsável'}
                    {workOrder.team?.name ? ` · ${workOrder.team.name}` : ''}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Agendamentos</p>
                  <p className="text-sm">
                    <Ruler className="mr-1 inline size-3.5 text-muted-foreground" />
                    Medição: {workOrder.scheduled_measurement_at ? formatDateTime(workOrder.scheduled_measurement_at) : '—'}
                  </p>
                  <p className="text-sm">
                    <Hammer className="mr-1 inline size-3.5 text-muted-foreground" />
                    Instalação: {workOrder.scheduled_install_at ? formatDateTime(workOrder.scheduled_install_at) : '—'}
                  </p>
                </div>

                {workOrder.notes && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Observações</p>
                    <p className="whitespace-pre-line text-sm">{workOrder.notes}</p>
                  </div>
                )}

                {workOrder.internal_notes && canWriteOS && (
                  <div className="sm:col-span-2 rounded-md bg-warning/8 px-3 py-2">
                    <p className="text-xs font-medium text-warning">Observações internas</p>
                    <p className="whitespace-pre-line text-sm">{workOrder.internal_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Últimos eventos</CardTitle>
              </CardHeader>
              <CardContent>
                <Timeline events={history.slice(0, 6)} />
              </CardContent>
            </Card>
          </div>

          <ItemsEditor
            workOrderId={workOrder.id}
            items={items}
            materials={materials}
            canEdit={canWriteOS && !workOrder.cancelled_at}
          />
        </TabsContent>

        {user.permissions.has('measurements.read') && (
          <TabsContent value="medicao">
            <MeasurementPanel
              workOrder={workOrder}
              measurements={measurements}
              users={users}
              canWrite={user.permissions.has('measurements.write') && !workOrder.cancelled_at}
              canWriteWorkOrder={canWriteOS}
            />
          </TabsContent>
        )}

        {user.permissions.has('production.read') && (
          <TabsContent value="producao">
            <ProductionPanel
              workOrderId={workOrder.id}
              records={production}
              steps={steps ?? []}
              items={items}
              users={users}
              canWrite={user.permissions.has('production.write') && !workOrder.cancelled_at}
            />
          </TabsContent>
        )}

        {user.permissions.has('stock.read') && (
          <TabsContent value="material">
            <MaterialPanel
              workOrderId={workOrder.id}
              reserved={reservedStock}
              available={availableStock ?? []}
              canWrite={user.permissions.has('stock.write') && !workOrder.cancelled_at}
            />
          </TabsContent>
        )}

        {user.permissions.has('installations.read') && (
          <TabsContent value="instalacao">
            <InstallationPanel
              workOrder={workOrder}
              installations={installations}
              teams={teams}
              users={users}
              canWrite={user.permissions.has('installations.write') && !workOrder.cancelled_at}
            />
          </TabsContent>
        )}

        {user.permissions.has('financial.read') && (
          <TabsContent value="financeiro">
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2">
                <CardTitle>Lançamentos desta OS</CardTitle>
                {user.permissions.has('financial.write') && (
                  <Button size="sm" asChild>
                    <Link href={`/financeiro?os=${workOrder.id}&novo=1`}>Novo lançamento</Link>
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {!transactions?.length ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum lançamento vinculado a esta OS.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {transactions.map((transaction) => (
                      <li key={transaction.id} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{transaction.description}</p>
                          <p className="text-xs text-muted-foreground">
                            vence {formatDate(transaction.due_date)}
                            {transaction.category?.name ? ` · ${transaction.category.name}` : ''}
                          </p>
                        </div>
                        <GenericStatusBadge status={transaction.status} />
                        <span
                          className={cn(
                            'tabular text-sm font-medium',
                            transaction.kind === 'RECEITA' ? 'text-success' : 'text-destructive',
                          )}
                        >
                          {transaction.kind === 'RECEITA' ? '+' : '−'}
                          {formatCurrency(transaction.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="arquivos">
          <FilesPanel
            workOrderId={workOrder.id}
            workOrderNumber={workOrder.number}
            photos={files.photos}
            attachments={files.attachments}
            canWrite={canWriteOS}
          />
        </TabsContent>

        <TabsContent value="timeline" className="flex flex-col gap-4">
          {canWriteOS && <NoteForm workOrderId={workOrder.id} />}
          <Card>
            <CardContent className="pt-5">
              <Timeline events={history} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
