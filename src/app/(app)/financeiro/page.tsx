import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowDownCircle, ArrowUpCircle, Banknote, TrendingUp } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { DataTable, type Column } from '@/components/shared/data-table'
import { GenericStatusBadge } from '@/components/shared/status-badge'
import { ClearFiltersButton, FilterBar, FilterSelect, SearchInput } from '@/components/shared/filters'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { SettleButton, TransactionDialog } from '@/features/financial/components/transaction-dialog'
import type { FinancialAccount, FinancialCategory, FinancialTransaction } from '@/types/database'

export const metadata: Metadata = { title: 'Financeiro' }

export default async function FinancialPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; tipo?: string; status?: string; novo?: string; os?: string }>
}) {
  const user = await requirePermission('financial.read')
  const params = await searchParams
  const canWrite = user.permissions.has('financial.write')
  const supabase = await createClient()

  let query = supabase
    .from('financial_transactions')
    .select(
      `*,
       category:financial_categories!financial_transactions_category_id_fkey ( id, name, kind, color, active ),
       account:financial_accounts!financial_transactions_account_id_fkey ( id, name ),
       work_order:work_orders!financial_transactions_work_order_id_fkey ( id, number ),
       customer:customers!financial_transactions_customer_id_fkey ( id, name )`,
      { count: 'exact' },
    )

  if (params.tipo) query = query.eq('kind', params.tipo)
  if (params.status) query = query.eq('status', params.status)

  const [{ data, count }, { data: categories }, { data: accounts }, { data: workOrders }] = await Promise.all([
    query.order('due_date', { ascending: false }).limit(200).returns<FinancialTransaction[]>(),
    supabase.from('financial_categories').select('*').eq('active', true).order('name').returns<FinancialCategory[]>(),
    supabase.from('financial_accounts').select('*').eq('active', true).order('name').returns<FinancialAccount[]>(),
    supabase
      .from('work_orders')
      .select('id, number, customer_id')
      .is('cancelled_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const all = data ?? []
  const rows = params.busca
    ? all.filter((row) => row.description.toLowerCase().includes(params.busca!.toLowerCase()))
    : all

  const today = new Date().toISOString().slice(0, 10)
  const toReceive = all.filter((row) => row.kind === 'RECEITA' && row.status === 'PENDENTE')
  const toPay = all.filter((row) => row.kind === 'DESPESA' && row.status === 'PENDENTE')
  const received = all.filter((row) => row.kind === 'RECEITA' && row.status === 'PAGO')
  const paid = all.filter((row) => row.kind === 'DESPESA' && row.status === 'PAGO')
  const overdue = all.filter((row) => row.status === 'PENDENTE' && row.due_date < today)

  const total = (list: FinancialTransaction[]) =>
    list.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)

  const columns: Column<FinancialTransaction>[] = [
    {
      key: 'description',
      header: 'Lançamento',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium">{row.description}</p>
          <p className="text-xs text-muted-foreground">
            {row.category?.name ?? 'sem categoria'}
            {row.work_order ? ` · OS ${row.work_order.number}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'due',
      header: 'Vencimento',
      render: (row) => (
        <span
          className={cn(
            'text-sm tabular',
            row.status === 'PENDENTE' && row.due_date < today && 'font-medium text-destructive',
          )}
        >
          {formatDate(row.due_date)}
        </span>
      ),
    },
    {
      key: 'account',
      header: 'Conta',
      secondary: true,
      render: (row) => <span className="text-sm">{row.account?.name ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Situação',
      render: (row) => <GenericStatusBadge status={row.status} />,
    },
    {
      key: 'amount',
      header: 'Valor',
      align: 'right',
      render: (row) => (
        <span
          className={cn(
            'text-sm font-medium tabular',
            row.kind === 'RECEITA' ? 'text-success' : 'text-destructive',
          )}
        >
          {row.kind === 'RECEITA' ? '+' : '−'}
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (row: FinancialTransaction) =>
              row.status === 'PENDENTE' ? (
                <SettleButton transactionId={row.id} workOrderId={row.work_order_id} />
              ) : null,
          },
        ]
      : []),
  ]

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Financeiro"
        description="Contas a receber, a pagar e o caixa da marmoraria."
        actions={
          canWrite ? (
            <TransactionDialog
              categories={categories ?? []}
              accounts={accounts ?? []}
              workOrders={workOrders ?? []}
              openByDefault={params.novo === '1'}
              defaultWorkOrderId={params.os}
            />
          ) : undefined
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="A receber"
          value={formatCurrency(total(toReceive))}
          icon={ArrowUpCircle}
          tone="warning"
          hint={`${toReceive.length} título(s)`}
          href="/financeiro?tipo=RECEITA&status=PENDENTE"
        />
        <MetricCard
          label="A pagar"
          value={formatCurrency(total(toPay))}
          icon={ArrowDownCircle}
          tone="destructive"
          hint={`${toPay.length} título(s)`}
          href="/financeiro?tipo=DESPESA&status=PENDENTE"
        />
        <MetricCard
          label="Saldo realizado"
          value={formatCurrency(total(received) - total(paid))}
          icon={TrendingUp}
          tone="success"
          hint="recebido menos pago"
        />
        <MetricCard
          label="Vencido"
          value={formatCurrency(total(overdue))}
          icon={Banknote}
          tone={overdue.length ? 'destructive' : 'success'}
          hint={`${overdue.length} título(s)`}
        />
      </section>

      <FilterBar>
        <SearchInput placeholder="Buscar lançamento…" />
        <FilterSelect
          paramName="tipo"
          label="Tipo"
          allLabel="Todos"
          options={[
            { value: 'RECEITA', label: 'Receitas' },
            { value: 'DESPESA', label: 'Despesas' },
          ]}
        />
        <FilterSelect
          paramName="status"
          label="Situação"
          allLabel="Todas"
          options={[
            { value: 'PENDENTE', label: 'Pendente' },
            { value: 'PAGO', label: 'Pago/recebido' },
            { value: 'CANCELADO', label: 'Cancelado' },
          ]}
        />
        <ClearFiltersButton keys={['busca', 'tipo', 'status']} />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyTitle="Nenhum lançamento encontrado"
        emptyDescription="Registre as entradas e saídas para acompanhar o caixa."
        footer={`${rows.length} de ${count ?? rows.length} lançamento(s)`}
        mobileCard={(row) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{row.description}</p>
                <p className="truncate text-xs text-muted-foreground">
                  vence {formatDate(row.due_date)}
                  {row.work_order ? ` · OS ${row.work_order.number}` : ''}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 text-sm font-medium tabular',
                  row.kind === 'RECEITA' ? 'text-success' : 'text-destructive',
                )}
              >
                {row.kind === 'RECEITA' ? '+' : '−'}
                {formatCurrency(row.amount)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <GenericStatusBadge status={row.status} />
              {canWrite && row.status === 'PENDENTE' && (
                <div className="ml-auto">
                  <SettleButton transactionId={row.id} workOrderId={row.work_order_id} />
                </div>
              )}
            </div>
          </div>
        )}
      />

      <p className="text-xs text-muted-foreground">
        Receitas vinculadas a uma OS atualizam automaticamente o valor recebido dela.{' '}
        <Link href="/os" className="underline">
          Ver ordens de serviço
        </Link>
      </p>
    </PageContainer>
  )
}
