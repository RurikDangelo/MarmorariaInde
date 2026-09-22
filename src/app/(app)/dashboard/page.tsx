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
import { cn, formatArea, formatCurrency, formatDate, formatNumber } from '@/lib/utils'
import { getDashboardData, resolvePeriod, type PeriodKey } from '@/features/dashboard/queries'
import { CashflowChart } from '@/features/dashboard/components/cashflow-chart'
import { StatusBadge } from '@/components/shared/status-badge'
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

  const periodLabel = resolvePeriod(period).label
  const maxStatusCount = Math.max(1, ...data.workOrders.byStatus.map((status) => status.count))

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
          value={data.workOrders.open}
          icon={ClipboardList}
          href="/os?situacao=abertas"
          hint={`${data.workOrders.total} no total`}
        />
        <MetricCard
          label="OS atrasadas"
          value={data.workOrders.late}
          icon={CalendarClock}
          tone={data.workOrders.late > 0 ? 'destructive' : 'success'}
          href="/os?situacao=atrasadas"
        />
        <MetricCard
          label="Finalizadas no período"
          value={data.workOrders.finished}
          icon={ClipboardList}
          tone="success"
          hint={
            data.production.avgLeadTimeDays
              ? `lead time médio ${formatNumber(data.production.avgLeadTimeDays, 1)} dias`
              : undefined
          }
        />
        <MetricCard
          label="Etapas em produção"
          value={data.production.inProgress}
          icon={Hammer}
          tone="info"
          href="/producao"
          hint={data.production.rework > 0 ? `${data.production.rework} retrabalho(s)` : undefined}
        />
      </section>

      {/* Financeiro */}
      {user.permissions.has('financial.read') && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Faturamento" value={formatCurrency(data.financial.revenue)} icon={Banknote} hint={periodLabel.toLowerCase()} />
          <MetricCard label="Recebido" value={formatCurrency(data.financial.received)} icon={Banknote} tone="success" />
          <MetricCard
            label="A receber"
            value={formatCurrency(data.financial.toReceive)}
            icon={Banknote}
            tone="warning"
            href="/financeiro?tipo=RECEITA&status=PENDENTE"
          />
          <MetricCard
            label="Vencido"
            value={formatCurrency(data.financial.overdue)}
            icon={AlertTriangle}
            tone={data.financial.overdue > 0 ? 'destructive' : 'success'}
            href="/financeiro?status=PENDENTE"
          />
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {user.permissions.has('financial.read') && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Receita e despesa por mês</CardTitle>
              <p className="text-sm text-muted-foreground">Últimos 6 meses, por data de vencimento.</p>
            </CardHeader>
            <CardContent>
              <CashflowChart data={data.revenueByMonth} />
            </CardContent>
          </Card>
        )}

        <Card className={user.permissions.has('financial.read') ? undefined : 'lg:col-span-2'}>
          <CardHeader>
            <CardTitle>OS por etapa</CardTitle>
            <p className="text-sm text-muted-foreground">Somente ordens em aberto.</p>
          </CardHeader>
          <CardContent>
            {data.workOrders.open === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma OS em aberto.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.workOrders.byStatus
                  .filter((status) => status.count > 0)
                  .map((status) => (
                    <li key={status.code}>
                      <Link
                        href={`/os?status=${status.code}`}
                        className="group flex items-center gap-2 text-sm"
                      >
                        <span className="w-32 shrink-0 truncate text-muted-foreground group-hover:text-foreground">
                          {status.label}
                        </span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-primary/70 transition-all"
                            style={{ width: `${(status.count / maxStatusCount) * 100}%` }}
                          />
                        </span>
                        <span className="w-6 shrink-0 text-right tabular font-medium">{status.count}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Próximas OS */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle>Próximas entregas</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/os">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!recentOrders?.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma OS em aberto.</p>
            ) : (
              <ul className="divide-y">
                {recentOrders.map((order) => (
                  <li key={order.id}>
                    <Link href={`/os/${order.id}`} className="flex items-center gap-3 py-2.5 transition-colors hover:bg-secondary/40">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {order.number}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {order.customer?.name}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {order.deadline ? `entrega ${formatDate(order.deadline)}` : 'sem prazo'}
                          {order.title ? ` · ${order.title}` : ''}
                        </p>
                      </div>
                      <StatusBadge label={order.status?.label ?? order.status_code} color={order.status?.color} />
                      <span className="hidden w-24 text-right text-sm tabular sm:block">
                        {formatCurrency(order.total_value)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Alertas */}
        {user.permissions.has('alerts.read') && (
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle>Alertas</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/alertas">Ver todos</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {!alerts?.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nada pendente. Tudo em dia.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {alerts.map((alert) => (
                    <li key={alert.id} className="flex gap-2.5">
                      <span
                        className={cn(
                          'mt-1.5 size-2 shrink-0 rounded-full',
                          alert.severity === 'CRITICO' && 'bg-destructive',
                          alert.severity === 'ATENCAO' && 'bg-warning',
                          alert.severity === 'INFO' && 'bg-info',
                        )}
                      />
                      <div className="min-w-0">
                        {alert.href ? (
                          <Link href={alert.href} className="text-sm font-medium hover:underline">
                            {alert.title}
                          </Link>
                        ) : (
                          <p className="text-sm font-medium">{alert.title}</p>
                        )}
                        {alert.description && (
                          <p className="truncate text-xs text-muted-foreground">{alert.description}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Estoque e desperdício */}
      {user.permissions.has('stock.read') && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Chapas disponíveis" value={data.stock.availableSlabs} icon={Layers} href="/estoque" />
          <MetricCard label="Material reservado" value={data.stock.reservedSlabs} icon={Layers} tone="warning" />
          <MetricCard
            label="Consumido no período"
            value={formatArea(data.stock.consumedArea)}
            icon={Layers}
            tone="info"
          />
          <MetricCard
            label="Desperdício"
            value={`${formatNumber(data.stock.wastePct, 1)}%`}
            icon={TrendingDown}
            tone={data.stock.wastePct > 10 ? 'destructive' : 'success'}
            hint={`${formatArea(data.stock.lostArea)} · ${formatCurrency(data.stock.lostCost)}`}
          />
        </section>
      )}

      {user.permissions.has('action_plans.read') && data.actionPlans.open > 0 && (
        <Card>
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
