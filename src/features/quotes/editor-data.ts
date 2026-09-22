import type { SessionUser } from '@/lib/auth/session'
import type { EditorPermissions } from '@/features/work-orders/components/editor/work-order-editor'
import type { Quote } from '@/types/database'

/** O que o usuario pode fazer na tela unica do orcamento. Aprovado/recusado/cancelado fica so leitura. */
export function quoteEditorPermissions(user: SessionUser, quote: Quote | null): EditorPermissions {
  const has = (permission: Parameters<SessionUser['permissions']['has']>[0]) => user.permissions.has(permission)
  const locked = quote !== null && ['APROVADO', 'CANCELADO', 'RECUSADO'].includes(quote.status)
  return {
    // recusado/cancelado: o status continua editavel pelo cabecalho para reabrir
    canEdit: has('quotes.write') && quote?.status !== 'APROVADO',
    canManageCatalog: has('stock.write') && !locked,
    canAddToLists: has('quotes.write') || has('work_orders.write') || has('stock.write') || has('settings.write'),
    canCreateCustomer: has('customers.write'),
    canFinancial: has('financial.write'),
  }
}
