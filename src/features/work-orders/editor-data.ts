import type { SessionUser } from '@/lib/auth/session'
import { formatDimensions } from '@/lib/utils'
import type { Composition } from '@/features/composition/types'
import type { EditorPermissions } from '@/features/work-orders/components/editor/work-order-editor'
import type { PieceOption } from '@/features/work-orders/components/production-panel'
import type { WorkOrder } from '@/types/database'

/** O que o usuario pode fazer na tela unica da OS. */
export function workOrderEditorPermissions(user: SessionUser, workOrder: WorkOrder | null): EditorPermissions {
  const has = (permission: Parameters<SessionUser['permissions']['has']>[0]) => user.permissions.has(permission)
  const open = !workOrder || (!workOrder.cancelled_at && !workOrder.finished_at)
  return {
    canEdit: has('work_orders.write') && open,
    canManageCatalog: has('stock.write'),
    canAddToLists: has('work_orders.write') || has('quotes.write') || has('stock.write') || has('settings.write'),
    canCreateCustomer: has('customers.write'),
    canFinancial: has('financial.write'),
  }
}

/** Pecas da montagem para o apontamento de producao: "Cozinha · Pia e Balcão · Peça 3 — Saia (0,94 × 0,06)". */
export function pieceOptions(composition: Composition): PieceOption[] {
  return composition.items.flatMap((item) => {
    const environment = composition.environments.find((row) => row.id === item.environment_id)
    return (item.pieces ?? []).map((piece) => ({
      id: piece.id,
      label: [
        environment?.name,
        item.description,
        `Peça ${piece.number ?? '?'}${piece.name ? ` — ${piece.name}` : ''} (${formatDimensions(piece.length_mm, piece.width_mm)})`,
      ]
        .filter(Boolean)
        .join(' · '),
    }))
  })
}
