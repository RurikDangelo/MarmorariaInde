import { createClient } from '@/lib/supabase/server'

export type PeriodKey = 'hoje' | 'semana' | 'mes' | 'trimestre' | 'ano'

export function resolvePeriod(period: PeriodKey = 'mes'): { from: string; to: string; label: string } {
  const now = new Date()
  const to = new Date(now)
  to.setHours(23, 59, 59, 999)
  const from = new Date(now)

  switch (period) {
    case 'hoje':
      from.setHours(0, 0, 0, 0)
      return { from: from.toISOString(), to: to.toISOString(), label: 'Hoje' }
    case 'semana':
      from.setDate(from.getDate() - from.getDay())
      from.setHours(0, 0, 0, 0)
      return { from: from.toISOString(), to: to.toISOString(), label: 'Esta semana' }
    case 'trimestre':
      from.setDate(from.getDate() - 90)
      return { from: from.toISOString(), to: to.toISOString(), label: 'Últimos 90 dias' }
    case 'ano':
      from.setMonth(0, 1)
      from.setHours(0, 0, 0, 0)
      return { from: from.toISOString(), to: to.toISOString(), label: 'Este ano' }
    default:
      from.setDate(1)
      from.setHours(0, 0, 0, 0)
      return { from: from.toISOString(), to: to.toISOString(), label: 'Este mês' }
  }
}

export interface DashboardData {
  workOrders: {
    total: number
    open: number
    late: number
    finished: number
    byStatus: { code: string; label: string; color: string; count: number }[]
  }
  financial: {
    revenue: number
    received: number
    toReceive: number
    expenses: number
    overdue: number
  }
  stock: {
    availableSlabs: number
    reservedSlabs: number
    lowStockMaterials: number
    consumedArea: number
    lostArea: number
    lostCost: number
    wastePct: number
  }
  production: {
    inProgress: number
    finishedSteps: number
    rework: number
    avgLeadTimeDays: number | null
  }
  alerts: { severity: string; count: number }[]
  actionPlans: { open: number; late: number }
  revenueByMonth: { month: string; receita: number; despesa: number }[]
}

export async function getDashboardData(period: PeriodKey = 'mes'): Promise<DashboardData> {
  const supabase = await createClient()
  const { from, to } = resolvePeriod(period)
  const today = new Date().toISOString().slice(0, 10)

  const [
    statusesRes,
    workOrdersRes,
    transactionsRes,
    stockRes,
    movementsRes,
    productionRes,
    alertsRes,
    plansRes,
    finishedRes,
  ] = await Promise.all([
    supabase.from('work_order_statuses').select('code, label, color, sort_order').order('sort_order'),
    supabase
      .from('work_orders')
      .select('id, status_code, deadline, finished_at, cancelled_at, created_at, total_value, received_value'),
    supabase
      .from('financial_transactions')
      .select('kind, amount, status, due_date, paid_at')
      .gte('due_date', from.slice(0, 10))
      .lte('due_date', to.slice(0, 10)),
    supabase.from('stock_items').select('status, area_m2, kind'),
    supabase
      .from('stock_movements')
      .select('movement_type, area_m2, total_cost, created_at')
      .gte('created_at', from),
    supabase.from('production_records').select('status, is_rework, created_at').gte('created_at', from),
    supabase.from('alerts').select('severity').is('dismissed_at', null),
    supabase.from('action_plans').select('status, due_date'),
    supabase
      .from('financial_transactions')
      .select('kind, amount, status, paid_at, due_date')
      .gte('due_date', new Date(new Date().setMonth(new Date().getMonth() - 5, 1)).toISOString().slice(0, 10)),
  ])

  const statuses = (statusesRes.data ?? []) as { code: string; label: string; color: string }[]
  const workOrders = (workOrdersRes.data ?? []) as {
    id: string
    status_code: string
    deadline: string | null
    finished_at: string | null
    cancelled_at: string | null
    created_at: string
    total_value: number
    received_value: number
  }[]

  const activeOrders = workOrders.filter((wo) => !wo.cancelled_at)
  const open = activeOrders.filter((wo) => !wo.finished_at)
  const late = open.filter((wo) => wo.deadline && wo.deadline < today)
  const finishedInPeriod = activeOrders.filter((wo) => wo.finished_at && wo.finished_at >= from)

  const transactions = (transactionsRes.data ?? []) as {
    kind: string
    amount: number
    status: string
    due_date: string
  }[]

  const revenue = sum(transactions.filter((t) => t.kind === 'RECEITA' && t.status !== 'CANCELADO'))
  const received = sum(transactions.filter((t) => t.kind === 'RECEITA' && t.status === 'PAGO'))
  const toReceive = sum(transactions.filter((t) => t.kind === 'RECEITA' && t.status === 'PENDENTE'))
  const expenses = sum(transactions.filter((t) => t.kind === 'DESPESA' && t.status !== 'CANCELADO'))
  const overdue = sum(transactions.filter((t) => t.status === 'PENDENTE' && t.due_date < today))

  const stockItems = (stockRes.data ?? []) as { status: string; area_m2: number | null; kind: string }[]
  const movements = (movementsRes.data ?? []) as {
    movement_type: string
    area_m2: number | null
    total_cost: number | null
  }[]

  const consumedArea = movements
    .filter((m) => m.movement_type === 'CONSUMO')
    .reduce((acc, m) => acc + Number(m.area_m2 ?? 0), 0)
  const lostArea = movements
    .filter((m) => m.movement_type === 'PERDA' || m.movement_type === 'DESCARTE')
    .reduce((acc, m) => acc + Number(m.area_m2 ?? 0), 0)
  const lostCost = movements
    .filter((m) => m.movement_type === 'PERDA' || m.movement_type === 'DESCARTE')
    .reduce((acc, m) => acc + Number(m.total_cost ?? 0), 0)

  const production = (productionRes.data ?? []) as { status: string; is_rework: boolean }[]
  const plans = (plansRes.data ?? []) as { status: string; due_date: string | null }[]

  const leadTimes = finishedInPeriod
    .map((wo) =>
      wo.finished_at
        ? (new Date(wo.finished_at).getTime() - new Date(wo.created_at).getTime()) / 86_400_000
        : null,
    )
    .filter((value): value is number => value !== null)

  const history = (finishedRes.data ?? []) as {
    kind: string
    amount: number
    status: string
    due_date: string
  }[]

  const months = new Map<string, { receita: number; despesa: number }>()
  for (let i = 5; i >= 0; i--) {
    const date = new Date()
    date.setMonth(date.getMonth() - i, 1)
    months.set(date.toISOString().slice(0, 7), { receita: 0, despesa: 0 })
  }
  for (const transaction of history) {
    if (transaction.status === 'CANCELADO') continue
    const key = transaction.due_date.slice(0, 7)
    const bucket = months.get(key)
    if (!bucket) continue
    if (transaction.kind === 'RECEITA') bucket.receita += Number(transaction.amount)
    else bucket.despesa += Number(transaction.amount)
  }

  return {
    workOrders: {
      total: activeOrders.length,
      open: open.length,
      late: late.length,
      finished: finishedInPeriod.length,
      byStatus: statuses.map((status) => ({
        ...status,
        count: open.filter((wo) => wo.status_code === status.code).length,
      })),
    },
    financial: { revenue, received, toReceive, expenses, overdue },
    stock: {
      availableSlabs: stockItems.filter((item) => item.kind === 'CHAPA' && item.status === 'DISPONIVEL').length,
      reservedSlabs: stockItems.filter((item) => item.status === 'RESERVADA').length,
      lowStockMaterials: 0,
      consumedArea,
      lostArea,
      lostCost,
      wastePct: consumedArea + lostArea > 0 ? (lostArea / (consumedArea + lostArea)) * 100 : 0,
    },
    production: {
      inProgress: production.filter((record) => record.status === 'EM_ANDAMENTO').length,
      finishedSteps: production.filter((record) => record.status === 'CONCLUIDO').length,
      rework: production.filter((record) => record.is_rework).length,
      avgLeadTimeDays: leadTimes.length
        ? leadTimes.reduce((acc, value) => acc + value, 0) / leadTimes.length
        : null,
    },
    alerts: groupBy((alertsRes.data ?? []) as { severity: string }[], 'severity'),
    actionPlans: {
      open: plans.filter((plan) => plan.status === 'ABERTO' || plan.status === 'EM_ANDAMENTO').length,
      late: plans.filter(
        (plan) =>
          (plan.status === 'ABERTO' || plan.status === 'EM_ANDAMENTO') &&
          plan.due_date &&
          plan.due_date < today,
      ).length,
    },
    revenueByMonth: Array.from(months.entries()).map(([month, values]) => ({
      month: formatMonth(month),
      ...values,
    })),
  }
}

function sum(rows: { amount: number }[]): number {
  return rows.reduce((acc, row) => acc + Number(row.amount ?? 0), 0)
}

function groupBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const map = new Map<string, number>()
  for (const row of rows) {
    const value = String(row[key])
    map.set(value, (map.get(value) ?? 0) + 1)
  }
  return Array.from(map.entries()).map(([severity, count]) => ({ severity, count }))
}

function formatMonth(value: string): string {
  const [year, month] = value.split('-')
  const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${names[Number(month) - 1]}/${year.slice(2)}`
}

/** Recalcula os alertas automáticos. Chamado ao abrir o dashboard/central. */
export async function refreshAlerts(): Promise<void> {
  const supabase = await createClient()
  await supabase.rpc('refresh_alerts')
}
