import type { CustomerSummary } from '@/features/customers/components/customer-picker'
import { todayIso } from '@/features/composition/installments'
import type { QuoteHeaderInput } from '@/features/quotes/actions'
import type { PaymentMethod, PaymentType, Quote } from '@/types/database'

export type EditableQuoteStatus = 'RASCUNHO' | 'ENVIADO' | 'RECUSADO' | 'EXPIRADO' | 'CANCELADO'

export interface QuoteHeaderDraft {
  customer: CustomerSummary | null
  status: EditableQuoteStatus
  issue_date: string
  validity_days: number | null
  valid_until: string
  delivery_term: string
  delivery_days: number | null
  delivery_date: string
  seller_id: string | null
  payment_type: PaymentType
  payment_method: PaymentMethod | null
  payment_terms: string
  site_details: string
  freight: number
  surcharge: number
  discount: number
  notes: string
  internal_notes: string
}

export function headerFromQuote(
  quote: Quote | null,
  defaults: { sellerId: string; validityDays: number },
): QuoteHeaderDraft {
  const issue = quote?.issue_date ?? todayIso()
  return {
    customer: quote?.customer ?? null,
    // aprovado so aparece no selo; a tela fica somente leitura
    status: quote && quote.status !== 'APROVADO' ? quote.status : 'RASCUNHO',
    issue_date: issue,
    validity_days: quote ? quote.validity_days : defaults.validityDays,
    valid_until: quote?.valid_until ?? '',
    delivery_term: quote?.delivery_term ?? '',
    delivery_days: quote?.delivery_days ?? null,
    delivery_date: quote?.delivery_date ?? '',
    seller_id: quote ? quote.seller_id : defaults.sellerId,
    payment_type: quote?.payment_type ?? 'A_VISTA',
    payment_method: quote?.payment_method ?? null,
    payment_terms: quote?.payment_terms ?? '',
    site_details: quote?.site_details ?? '',
    freight: Number(quote?.freight ?? 0),
    surcharge: Number(quote?.surcharge ?? 0),
    discount: Number(quote?.discount ?? 0),
    notes: quote?.notes ?? '',
    internal_notes: quote?.internal_notes ?? '',
  }
}

export function quoteHeaderToInput(draft: QuoteHeaderDraft, id: string | null): QuoteHeaderInput {
  const { customer, valid_until, delivery_date, ...rest } = draft
  return {
    ...rest,
    id,
    customer_id: customer?.id ?? '',
    valid_until: valid_until || null,
    delivery_date: delivery_date || null,
  }
}
