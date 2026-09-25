import type { Metadata } from 'next'
import Link from 'next/link'
import { after } from 'next/server'
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  ClipboardList,
  Hammer,
  Layers,
  ListChecks,
  TrendingDown,
} from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { PeriodFilter } from '@/components/shared/filters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatArea, formatCurrency, formatNumber } from '@/lib/utils'
import { getDashboardData, resolvePeriod, type PeriodKey } from '@/features/dashboard/queries'
import { CashflowChart } from '@/features/dashboard/components/cashflow-chart'
import { StageBreakdown } from '@/features/dashboard/components/stage-breakdown'
import { AlertsPanel } from '@/features/dashboard/components/alerts-panel'
import { UpcomingDeliveries } from '@/features/dashboard/components/upcoming-deliveries'
import type { Alert, WorkOrder } from '@/types/database'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: PeriodKey }>
}) {
  const user = await requirePermission('dashboard.read')
  const { periodo } = await searchParams
  const period = (periodo ?? 'mes') as PeriodKey

  const supabase = await createClient()
  // recalculo dos alertas depois de responder: a tela nao espera por ele
  after(async () => {
    await supabase.rpc('refresh_alerts')
  })

  const [data, { data: recentOrders }, { data: alerts }] = await Promise.all([
    getDashboardData(period),
    supabase
      .from('work_orders')
      .select(
        `id, number, title, priority, deadline, total_value, status_code,
         customer:customers!work_orders_customer_id_fkey ( id, name ),
         status:work_order_statuses!work_orders_status_code_fkey ( code, label, color )`,
      )
      .is('cancelled_at', null)
      .is('finished_at', null)
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(6)
      .returns<WorkOrder[]>(),
    user.permissions.has('alerts.read')
      ? supabase
          .from('alerts')
          .select('*')
          .is('dismissed_at', null)
          .order('severity')
          .limit(6)
          .returns<Alert[]>()
      : Promise.resolve({ data: [] as Alert[] }),
  ])

  // Problemas que esta propria consulta ja conhece. Se nao houver alerta
  // ativo mas estes numeros forem > 0, o painel avisa em vez de dizer que
  // esta tudo em dia (os avisos podem ter sido dispensados).
  const knownIssues =
    data.workOrders.late + (data.financial.overdue > 0 ? 1 : 0) + data.actionPlans.late

  const periodLabel = resolvePeriod(period).label
  const canSeeFinancial = user.permissions.has('financial.read')

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Visão geral"
        description={`Como a marmoraria está hoje · ${periodLabel.toLowerCase()}`}
        actions={<PeriodFilter />}
      />

      {/* Operação */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="OS em aberto"
          numeric={data.workOrders.open}
          icon={ClipboardList}
          href="/os?situacao=abertas"
          hint={`${data.workOrders.total} no total`}
          index={0}
        />
        <MetricCard
          label="OS atrasadas"
          numeric={data.workOrders.late}
          icon={CalendarClock}
          tone={data.workOrders.late > 0 ? 'destructive' : 'success'}
          href="/os?situacao=atrasadas"
          index={1}
        />
        <MetricCard
          label="Finalizadas no período"
          numeric={data.workOrders.finished}
          icon={ClipboardList}
          tone="success"
          hint={
            data.production.avgLeadTimeDays
              ? `lead time médio ${formatNumber(data.production.avgLeadTimeDays, 1)} dias`
              : undefined
          }
          index={2}
        />
        <MetricCard
          label="Etapas em produção"
          numeric={data.production.inProgress}
          icon={Hammer}
          tone="info"
          href="/producao"
          hint={data.production.rework > 0 ? `${data.production.rework} retrabalho(s)` : undefined}
          index={3}
        />
      </section>

      {/* Financeiro */}
      {canSeeFinancial && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Faturamento"
            numeric={data.financial.revenue}
            format="currency"
            icon={Banknote}
            hint={periodLabel.toLowerCase()}
            index={0}
          />
          <MetricCard
            label="Recebido"
            numeric={data.financial.received}
            format="currency"
            icon={Banknote}
            tone="success"
            index={1}
          />
          <MetricCard
            label="A receber"
            numeric={data.financial.toReceive}
            format="currency"
            icon={Banknote}
            tone="warning"
            href="/financeiro?tipo=RECEITA&status=PENDENTE"
            index={2}
          />
          <MetricCard
            label="Vencido"
            numeric={data.financial.overdue}
            format="currency"
            icon={AlertTriangle}
            tone={data.financial.overdue > 0 ? 'destructive' : 'success'}
            href="/financeiro?status=PENDENTE"
            index={3}
          />
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {canSeeFinancial && (
          <Card className="motion-enter lg:col-span-2" style={{ '--enter-index': 4 } as React.CSSProperties}>
            <CardHeader>
              <CardTitle>Receita e despesa por mês</CardTitle>
              <p className="text-sm text-muted-foreground">Últimos 6 meses, por data de vencimento.</p>
            </CardHeader>
            <CardContent>
              <CashflowChart data={data.revenueByMonth} />
            </CardContent>
          </Card>
        )}

        <Card
          className={canSeeFinancial ? 'motion-enter' : 'motion-enter lg:col-span-2'}
          style={{ '--enter-index': 5 } as React.CSSProperties}
        >
          <CardHeader>
            <CardTitle>OS por etapa</CardTitle>
            <p className="text-sm text-muted-foreground">
              {data.workOrders.open === 0
                ? 'Somente ordens em aberto.'
                : data.workOrders.open === 1
                  ? '1 ordem em aberto no fluxo.'
                  : `${data.workOrders.open} ordens em aberto no fluxo.`}
            </p>
          </CardHeader>
          <CardContent>
            <StageBreakdown rows={data.workOrders.byStatus} total={data.workOrders.open} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="motion-enter lg:col-span-2" style={{ '--enter-index': 6 } as React.CSSProperties}>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle>Próximas entregas</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/os">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <UpcomingDeliveries orders={recentOrders ?? []} />
          </CardContent>
        </Card>

        {user.permissions.has('alerts.read') && (
          <Card className="motion-enter" style={{ '--enter-index': 7 } as React.CSSProperties}>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle>Alertas</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/alertas">Ver todos</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <AlertsPanel alerts={alerts ?? []} knownIssues={knownIssues} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Estoque e desperdício */}
      {user.permissions.has('stock.read') && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Chapas disponíveis"
            numeric={data.stock.availableSlabs}
            icon={Layers}
            href="/estoque"
            index={0}
          />
          <MetricCard
            label="Material reservado"
            numeric={data.stock.reservedSlabs}
            icon={Layers}
            tone="warning"
            index={1}
          />
          <MetricCard
            label="Consumido no período"
            numeric={data.stock.consumedArea}
            format="area"
            icon={Layers}
            tone="info"
            index={2}
          />
          <MetricCard
            label="Desperdício"
            numeric={data.stock.wastePct}
            format="percent"
            icon={TrendingDown}
            tone={data.stock.wastePct > 10 ? 'destructive' : 'success'}
            hint={`${formatArea(data.stock.lostArea)} · ${formatCurrency(data.stock.lostCost)}`}
            index={3}
          />
        </section>
      )}

      {user.permissions.has('action_plans.read') && data.actionPlans.open > 0 && (
        <Card className="motion-enter" style={{ '--enter-index': 8 } as React.CSSProperties}>
          <CardContent className="flex flex-wrap items-center gap-3 pt-5">
            <ListChecks className="size-5 text-muted-foreground" />
            <p className="text-sm">
              <span className="font-medium">{data.actionPlans.open}</span> plano(s) de ação em andamento
              {data.actionPlans.late > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {data.actionPlans.late} atrasado(s)
                </Badge>
              )}
            </p>
            <Button variant="outline" size="sm" asChild className="ml-auto">
              <Link href="/planos-de-acao">Abrir planos de ação</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  )
}
