import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { GenericStatusBadge } from '@/components/shared/status-badge'
import { getCompanySettings, requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { getAssignableUsers } from '@/features/work-orders/queries'
import { ensureNewItemsModel, getCatalog, getComposition } from '@/features/composition/queries'
import { QuoteEditor } from '@/features/quotes/components/editor/quote-editor'
import { quoteEditorPermissions } from '@/features/quotes/editor-data'
import type { Quote, QuoteAttachment, QuoteInstallment, TechnicalReserve } from '@/types/database'

const QUOTE_SELECT = `*,
  customer:customers!quotes_customer_id_fkey ( * ),
  seller:profiles!quotes_seller_id_fkey ( id, full_name )`

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

  const load = () => supabase.from('quotes').select(QUOTE_SELECT).eq('id', id).maybeSingle<Quote>()
  let { data: quote } = await load()
  if (!quote) notFound()

  // orcamento da tela antiga vira montagem nova ao abrir (mesmo total)
  if (quote.items_model === 1) {
    await ensureNewItemsModel({ kind: 'quote', id }, 1)
    quote = (await load()).data ?? quote
  }

  const [composition, catalog, users, settings, { data: installments }, { data: reserves }, { data: attachments }, { data: workOrder }] =
    await Promise.all([
      getComposition({ kind: 'quote', id }),
      getCatalog(),
      getAssignableUsers(),
      getCompanySettings(),
      supabase.from('quote_installments').select('*').eq('quote_id', id).order('number').returns<QuoteInstallment[]>(),
      supabase.from('technical_reserves').select('*').eq('quote_id', id).order('created_at').returns<TechnicalReserve[]>(),
      supabase.from('quote_attachments').select('*').eq('quote_id', id).order('created_at').returns<QuoteAttachment[]>(),
      supabase.from('work_orders').select('id, number').eq('quote_id', id).maybeSingle<{ id: string; number: string }>(),
    ])

  return (
    <PageContainer size="wide">
      <PageHeader
        title={quote.number}
        description={quote.customer?.name ?? undefined}
        breadcrumb={[{ label: 'Orçamentos', href: '/orcamentos' }, { label: quote.number }]}
        badge={<GenericStatusBadge status={quote.status} />}
      />

      {quote.status === 'APROVADO' && (
        <p className="rounded-md border border-success/25 bg-success/5 px-3 py-2 text-sm text-success">
          Aprovado em {formatDate(quote.approved_at)} — o orçamento fica travado como foi vendido.{' '}
          {workOrder && (
            <Link href={`/os/${workOrder.id}`} className="font-medium underline">
              Abrir a {workOrder.number}
            </Link>
          )}
        </p>
      )}

      <QuoteEditor
        quote={quote}
        composition={composition}
        catalog={catalog}
        users={users}
        currentUserId={user.id}
        defaultWastePct={Number(settings?.default_waste_pct ?? 0)}
        validityDays={settings?.quote_validity_days ?? 15}
        permissions={quoteEditorPermissions(user, quote)}
        canApprove={user.permissions.has('quotes.approve')}
        installments={installments ?? []}
        reserves={reserves ?? []}
        attachments={attachments ?? []}
      />
    </PageContainer>
  )
}
