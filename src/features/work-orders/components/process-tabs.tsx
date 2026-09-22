import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GenericStatusBadge } from '@/components/shared/status-badge'
import { Timeline } from '@/components/shared/timeline'
import type { SessionUser } from '@/lib/auth/session'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { MeasurementPanel } from '@/features/work-orders/components/measurement-panel'
import { ProductionPanel, type PieceOption } from '@/features/work-orders/components/production-panel'
import { MaterialPanel } from '@/features/work-orders/components/material-panel'
import { InstallationPanel } from '@/features/work-orders/components/installation-panel'
import { FilesPanel } from '@/features/work-orders/components/files-panel'
import { NoteForm } from '@/features/work-orders/components/note-form'
import type { MaterialNeed } from '@/features/composition/components/materials-summary'
import type {
  FinancialTransaction,
  Installation,
  Measurement,
  ProductionRecord,
  ProductionStep,
  StockItem,
  WorkOrder,
  WorkOrderAttachment,
  WorkOrderHistory,
  WorkOrderPhoto,
} from '@/types/database'

/** Abaixo da montagem: o andamento da OS (medicao, producao, material, instalacao, dinheiro, arquivos). */
export function WorkOrderProcessTabs({
  user,
  workOrder,
  data,
}: {
  user: SessionUser
  workOrder: WorkOrder
  data: {
    history: WorkOrderHistory[]
    measurements: Measurement[]
    production: ProductionRecord[]
    steps: ProductionStep[]
    pieces: PieceOption[]
    installations: Installation[]
    reservedStock: StockItem[]
    availableStock: StockItem[]
    needs: MaterialNeed[]
    transactions: FinancialTransaction[]
    photos: WorkOrderPhoto[]
    attachments: WorkOrderAttachment[]
    users: { id: string; full_name: string }[]
    teams: { id: string; name: string; kind: string }[]
  }
}) {
  const can = (permission: Parameters<SessionUser['permissions']['has']>[0]) => user.permissions.has(permission)
  const open = !workOrder.cancelled_at
  const canWriteOS = can('work_orders.write')

  return (
    <Tabs defaultValue={can('measurements.read') ? 'medicao' : 'timeline'} className="no-print">
      <TabsList>
        {can('measurements.read') && <TabsTrigger value="medicao">Medição</TabsTrigger>}
        {can('production.read') && <TabsTrigger value="producao">Produção</TabsTrigger>}
        {can('stock.read') && <TabsTrigger value="material">Material</TabsTrigger>}
        {can('installations.read') && <TabsTrigger value="instalacao">Instalação</TabsTrigger>}
        {can('financial.read') && <TabsTrigger value="financeiro">Financeiro</TabsTrigger>}
        <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
      </TabsList>

      {can('measurements.read') && (
        <TabsContent value="medicao">
          <MeasurementPanel
            workOrder={workOrder}
            measurements={data.measurements}
            users={data.users}
            canWrite={can('measurements.write') && open}
            canWriteWorkOrder={canWriteOS}
          />
        </TabsContent>
      )}

      {can('production.read') && (
        <TabsContent value="producao">
          <ProductionPanel
            workOrderId={workOrder.id}
            records={data.production}
            steps={data.steps}
            pieces={data.pieces}
            users={data.users}
            canWrite={can('production.write') && open}
          />
        </TabsContent>
      )}

      {can('stock.read') && (
        <TabsContent value="material">
          <MaterialPanel
            workOrderId={workOrder.id}
            reserved={data.reservedStock}
            available={data.availableStock}
            needs={data.needs}
            canWrite={can('stock.write') && open}
          />
        </TabsContent>
      )}

      {can('installations.read') && (
        <TabsContent value="instalacao">
          <InstallationPanel
            workOrder={workOrder}
            installations={data.installations}
            teams={data.teams}
            users={data.users}
            canWrite={can('installations.write') && open}
          />
        </TabsContent>
      )}

      {can('financial.read') && (
        <TabsContent value="financeiro">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle>Lançamentos desta OS</CardTitle>
              {can('financial.write') && (
                <Button size="sm" asChild>
                  <Link href={`/financeiro?os=${workOrder.id}&novo=1`}>Novo lançamento</Link>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!data.transactions.length ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lançamento vinculado a esta OS.</p>
              ) : (
                <ul className="divide-y">
                  {data.transactions.map((transaction) => (
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
          photos={data.photos}
          attachments={data.attachments}
          canWrite={canWriteOS}
        />
      </TabsContent>

      <TabsContent value="timeline" className="flex flex-col gap-4">
        {canWriteOS && <NoteForm workOrderId={workOrder.id} />}
        <Card>
          <CardContent className="pt-5">
            <Timeline events={data.history} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
