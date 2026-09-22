import { notFound } from 'next/navigation'
import { getCompanySettings, requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { paymentMethodLabel, PAYMENT_TYPES } from '@/lib/labels'
import { ensureNewItemsModel, getComposition } from '@/features/composition/queries'
import { parsePrintOptions } from '@/features/composition/print-options'
import { drawingUrlsFor } from '@/features/composition/print-data'
import { DocumentPrint } from '@/features/composition/components/print/document-print'
import { PrintToolbar } from '@/features/composition/components/print/print-toolbar'
import type { Quote, QuoteInstallment } from '@/types/database'

export const metadata = { title: 'Imprimir orçamento' }

const dateOnly = (value: string | null) => (value ? formatDate(`${value}T12:00:00`) : null)

/** "Impressão do Orçamento" do sistema antigo: logo, ambientes, composição e fatura. */
export default async function PrintQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ocultar?: string }>
}) {
  const [{ id }, { ocultar }] = await Promise.all([params, searchParams])
  await requirePermission('quotes.read')
  const supabase = await createClient()
  const load = () =>
    supabase
      .from('quotes')
      .select('*, customer:customers!quotes_customer_id_fkey ( * ), seller:profiles!quotes_seller_id_fkey ( id, full_name )')
      .eq('id', id)
      .maybeSingle<Quote>()

  let { data: quote } = await load()
  if (!quote) notFound()
  if (quote.items_model === 1) {
    await ensureNewItemsModel({ kind: 'quote', id }, 1)
    quote = (await load()).data ?? quote
  }

  const [composition, settings, { data: installments }] = await Promise.all([
    getComposition({ kind: 'quote', id }),
    getCompanySettings(),
    supabase.from('quote_installments').select('*').eq('quote_id', id).order('number').returns<QuoteInstallment[]>(),
  ])
  const options = parsePrintOptions(ocultar)
  const drawingUrls = options.desenhos ? await drawingUrlsFor(composition.items) : {}
  const rows = installments ?? []

  return (
    <div className="bg-muted/30 py-4 print:bg-white print:py-0">
      <PrintToolbar options={options} />
      <DocumentPrint
        settings={settings}
        title={`Orçamento Nº ${quote.number}`}
        subtitle={[
          `Emissão ${dateOnly(quote.issue_date)}`,
          quote.valid_until ? `Válido até ${dateOnly(quote.valid_until)}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        customer={quote.customer}
        siteDetails={quote.site_details}
        composition={composition}
        options={options}
        totals={{
          products: Number(quote.subtotal),
          freight: Number(quote.freight),
          surcharge: Number(quote.surcharge),
          discount: Number(quote.discount),
          total: Number(quote.total),
        }}
        installments={rows.map((row) => ({
          number: row.number,
          count: rows.length,
          dueDate: row.due_date,
          amount: Number(row.amount),
          method: row.payment_method,
        }))}
        info={[
          { label: 'Validade', value: quote.validity_days != null ? `${quote.validity_days} dias` : dateOnly(quote.valid_until) },
          {
            label: 'Previsão de entrega',
            value: [quote.delivery_term, dateOnly(quote.delivery_date)].filter(Boolean).join(' — ') || null,
          },
          { label: 'Tipo de pagamento', value: PAYMENT_TYPES.find((type) => type.value === quote.payment_type)?.label },
          { label: 'Forma de pagamento', value: quote.payment_terms },
          { label: 'Espécie', value: quote.payment_method ? paymentMethodLabel(quote.payment_method) : null },
          { label: 'Vendedor', value: quote.seller?.full_name },
        ]}
        notes={quote.notes}
        drawingUrls={drawingUrls}
        signatures={[settings?.company_name ?? 'Marmoraria', 'De acordo — cliente']}
      />
    </div>
  )
}
