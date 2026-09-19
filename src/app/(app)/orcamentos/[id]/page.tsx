import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { GenericStatusBadge } from '@/components/shared/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { QuoteActions, QuoteItemsEditor } from '@/features/quotes/components/quote-components'
import { getMaterialsList } from '@/features/work-orders/queries'
import type { Quote, QuoteItem } from '@/types/database'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('quotes').select('number').eq('id', id).maybeSingle<{ number: string }>()
  return { title: data?.number ?? 'Orçamento' }
}

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requirePermission('quotes.read')
  const supabase = await createClient()

  const [{ data: quote }, { data: items }, materials] = await Promise.all([
    supabase
      .from('quotes')
      .select('*, customer:customers!quotes_customer_id_fkey ( * )')
      .eq('id', id)
      .maybeSingle<Quote>(),
    supabase
      .from('quote_items')
      .select('*, material:materials!quote_items_material_id_fkey ( id, name )')
      .eq('quote_id', id)
      .order('sort_order')
      .returns<QuoteItem[]>(),
    getMaterialsList(),
  ])

  if (!quote) notFound()

  const canWrite = user.permissions.has('quotes.write') && quote.status !== 'APROVADO'

  return (
    <PageContainer>
      <PageHeader
        title={quote.number}
        description={quote.customer?.name ?? undefined}
        breadcrumb={[{ label: 'Orçamentos', href: '/orcamentos' }, { label: quote.number }]}
        badge={<GenericStatusBadge status={quote.status} />}
        actions={
          <QuoteActions
            quoteId={quote.id}
            status={quote.status}
            canApprove={user.permissions.has('quotes.approve')}
            canWrite={user.permissions.has('quotes.write')}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Total" value={formatCurrency(quote.total)} />
        <MetricCard label="Emissão" value={formatDate(quote.issue_date)} />
        <MetricCard
          label="Validade"
          value={formatDate(quote.valid_until)}
          tone={
            quote.valid_until && quote.valid_until < new Date().toISOString().slice(0, 10) ? 'warning' : 'default'
          }
        />
      </div>

      {quote.status === 'APROVADO' && (
        <p className="rounded-md border border-success/25 bg-success/5 px-3 py-2 text-sm text-success">
          Orçamento aprovado em {formatDate(quote.approved_at)}.{' '}
          <Link href="/os" className="underline">
            Ver ordens de serviço
          </Link>
        </p>
      )}

      <QuoteItemsEditor quoteId={quote.id} items={items ?? []} materials={materials} canEdit={canWrite} />

      {(quote.notes || quote.internal_notes) && (
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {quote.notes && <p className="whitespace-pre-line">{quote.notes}</p>}
            {quote.internal_notes && user.permissions.has('quotes.write') && (
              <p className="rounded-md bg-warning/8 px-3 py-2 text-sm">
                <span className="block text-xs font-medium text-warning">Interno</span>
                {quote.internal_notes}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </PageContainer>
  )
}
