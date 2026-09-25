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
  PackageCheck,
  Ruler,
  TrendingDown,
  Wallet,
} from 'lucide-react'
import { PageContainer } from '@/components/shared/page-header'
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
import { DashboardHeader, SectionHeading } from '@/features/dashboard/components/dashboard-shell'
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

  // Problemas que esta propria consulta ja conhece. Se nao houver alerta ativo
  // mas estes numeros forem > 0, o painel avisa em vez de dizer que esta tudo
  // em dia (os avisos podem ter sido dispensados hoje).
  const knownIssues =
    data.workOrders.late + (data.financial.overdue > 0 ? 1 : 0) + data.actionPlans.late

  const periodLabel = resolvePeriod(period).label
  const canSeeFinancial = user.permissions.has('financial.read')

  const updatedAt = new Date().toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })

  const recebidoPct =
    data.financial.revenue > 0 ? (data.financial.received / data.financial.revenue) * 100 : 0

  return (
    <PageContainer size="wide" className="gap-8 py-7 sm:py-8">
      <DashboardHeader
        title="Visão geral"
        description="Acompanhe o desempenho da marmoraria e os principais indicadores operacionais."
        updatedAt={updatedAt}
        periodLabel={periodLabel.toLowerCase()}
        action={<PeriodFilter />}
      />

      {/* ---------------------------------------------------------- operação */}
      <section className="flex flex-col gap-4">
        <SectionHeading label="Operação" hint="ordens de serviço no fluxo" index={1} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="OS em aberto"
            numeric={data.workOrders.open}
            icon={ClipboardList}
            href="/os?situacao=abertas"
            hint={`${data.workOrders.total} no total`}
            index={2}
          />
          <MetricCard
            label="OS atrasadas"
            numeric={data.workOrders.late}
            icon={CalendarClock}
            tone={data.workOrders.late > 0 ? 'destructive' : 'success'}
            href="/os?situacao=atrasadas"
            hint={data.workOrders.late > 0 ? 'precisam de atenção' : 'nenhuma fora do prazo'}
            index={3}
          />
          <MetricCard
            label="Finalizadas no período"
            numeric={data.workOrders.finished}
            icon={PackageCheck}
            tone="success"
            hint={
              data.production.avgLeadTimeDays
                ? `lead time médio ${formatNumber(data.production.avgLeadTimeDays, 1)} dias`
                : periodLabel.toLowerCase()
            }
            index={4}
          />
          <MetricCard
            label="Etapas em produção"
            numeric={data.production.inProgress}
            icon={Hammer}
            tone="info"
            href="/producao"
            hint={
              data.production.rework > 0
                ? `${data.production.rework} retrabalho(s)`
                : 'sem retrabalho no período'
            }
            index={5}
          />
        </div>
      </section>

      {/* -------------------------------------------------------- financeiro */}
      {canSeeFinancial && (
        <section className="flex flex-col gap-4">
          <SectionHeading label="Financeiro" hint={periodLabel.toLowerCase()} index={1} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Faturamento"
              numeric={data.financial.revenue}
              format="currency"
              icon={Banknote}
              hint={periodLabel.toLowerCase()}
              index={2}
            />
            <MetricCard
              label="Recebido"
              numeric={data.financial.received}
              format="currency"
              icon={Wallet}
              tone="success"
              hint={
                data.financial.revenue > 0
                  ? `${formatNumber(recebidoPct, 0)}% do faturado`
                  : 'nada faturado ainda'
              }
              meter={recebidoPct}
              index={3}
            />
            <MetricCard
              label="A receber"
              numeric={data.financial.toReceive}
              format="currency"
              icon={CalendarClock}
              tone="warning"
              href="/financeiro?tipo=RECEITA&status=PENDENTE"
              hint="títulos em aberto"
              index={4}
            />
            <MetricCard
              label="Vencido"
              numeric={data.financial.overdue}
              format="currency"
              icon={AlertTriangle}
              tone={data.financial.overdue > 0 ? 'destructive' : 'success'}
              href="/financeiro?status=PENDENTE"
              hint={data.financial.overdue > 0 ? 'cobrança pendente' : 'nada vencido'}
              index={5}
            />
          </div>
        </section>
      )}

      {/* ------------------------------------------------ caixa e distribuição
          items-start: a lista de etapas tem a altura do próprio conteúdo. Se
          esticasse até o gráfico, sobraria um vazio enorme sob uma etapa só. */}
      <div className="grid items-start gap-4 xl:grid-cols-3">
        {canSeeFinancial && (
          <Card
            className="motion-enter overflow-hidden xl:col-span-2"
            style={{ '--enter-index': 6 } as React.CSSProperties}
          >
            <CardHeader className="gap-1 px-6 pb-4 pt-6">
              <CardTitle className="text-lg">Evolução do caixa</CardTitle>
              <p className="text-sm text-muted-foreground">
                Receita e despesa dos últimos 6 meses, por data de vencimento.
              </p>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <CashflowChart data={data.revenueByMonth} />
            </CardContent>
          </Card>
        )}

        <Card
          className={canSeeFinancial ? 'motion-enter' : 'motion-enter xl:col-span-2'}
          style={{ '--enter-index': 7 } as React.CSSProperties}
        >
          <CardHeader className="gap-1 px-6 pb-3 pt-6">
            <CardTitle className="text-lg">OS por etapa</CardTitle>
            <p className="text-sm text-muted-foreground">
              {data.workOrders.open === 0
                ? 'Somente ordens em aberto.'
                : data.workOrders.open === 1
                  ? '1 ordem em aberto no fluxo.'
                  : `${data.workOrders.open} ordens em aberto no fluxo.`}
            </p>
          </CardHeader>
          <CardContent className="px-3 pb-5">
            <StageBreakdown rows={data.workOrders.byStatus} total={data.workOrders.open} />
          </CardContent>
        </Card>
      </div>

      {/* -------------------------------------------------- entregas e alertas */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="motion-enter xl:col-span-2"
          style={{ '--enter-index': 8 } as React.CSSProperties}
        >
          <CardHeader className="flex-row items-center justify-between gap-2 px-6 pb-4 pt-6">
            <div>
              <CardTitle className="text-lg">Próximas entregas</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Ordenadas pelo prazo mais próximo.</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/os">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-4 pb-5">
            <UpcomingDeliveries orders={recentOrders ?? []} />
          </CardContent>
        </Card>

        {user.permissions.has('alerts.read') && (
          <Card className="motion-enter" style={{ '--enter-index': 9 } as React.CSSProperties}>
            <CardHeader className="flex-row items-center justify-between gap-2 px-6 pb-4 pt-6">
              <div>
                <CardTitle className="text-lg">Alertas</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">O que precisa de atenção agora.</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/alertas">Ver todos</Link>
              </Button>
            </CardHeader>
            <CardContent className="px-4 pb-5">
              <AlertsPanel alerts={alerts ?? []} knownIssues={knownIssues} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* ------------------------------------------------ estoque e desperdício */}
      {user.permissions.has('stock.read') && (
        <section className="flex flex-col gap-4">
          <SectionHeading label="Estoque e desperdício" hint="chapas e consumo" index={1} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Chapas disponíveis"
              numeric={data.stock.availableSlabs}
              icon={Layers}
              href="/estoque"
              hint="prontas para reservar"
              index={2}
            />
            <MetricCard
              label="Material reservado"
              numeric={data.stock.reservedSlabs}
              icon={PackageCheck}
              tone="warning"
              hint="comprometido com OS"
              index={3}
            />
            <MetricCard
              label="Consumido no período"
              numeric={data.stock.consumedArea}
              format="area"
              icon={Ruler}
              tone="info"
              hint={periodLabel.toLowerCase()}
              index={4}
            />
            <MetricCard
              label="Desperdício"
              numeric={data.stock.wastePct}
              format="percent"
              icon={TrendingDown}
              tone={data.stock.wastePct > 10 ? 'destructive' : 'success'}
              hint={`${formatArea(data.stock.lostArea)} · ${formatCurrency(data.stock.lostCost)}`}
              meter={data.stock.wastePct}
              index={5}
            />
          </div>
        </section>
      )}

      {user.permissions.has('action_plans.read') && data.actionPlans.open > 0 && (
        <Card className="motion-enter" style={{ '--enter-index': 10 } as React.CSSProperties}>
          <CardContent className="flex flex-wrap items-center gap-4 px-6 py-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent ring-1 ring-inset ring-accent/20">
              <ListChecks className="size-5" />
            </span>
            <p className="text-sm">
              <span className="text-base font-bold">{data.actionPlans.open}</span>{' '}
              {data.actionPlans.open === 1 ? 'plano de ação' : 'planos de ação'} em andamento
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
