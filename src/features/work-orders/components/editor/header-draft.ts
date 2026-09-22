import type { CustomerSummary } from '@/features/customers/components/customer-picker'
import type { WorkOrderHeaderInput } from '@/features/work-orders/header-actions'
import type { PaymentMethod, PaymentType, Priority, WorkOrder } from '@/types/database'

export interface WorkOrderHeaderDraft {
  customer: CustomerSummary | null
  title: string
  priority: Priority
  seller_id: string | null
  assigned_to: string | null
  team_id: string | null
  deadline: string
  /** Horario local do <input type="datetime-local">. */
  scheduled_measurement_at: string
  scheduled_install_at: string
  payment_type: PaymentType
  payment_method: PaymentMethod | null
  payment_terms: string
  site_details: string
  zip_code: string
  address: string
  address_number: string
  complement: string
  district: string
  city: string
  state: string
  freight: number
  surcharge: number
  discount: number
  notes: string
  internal_notes: string
}

/** ISO (UTC) -> valor do <input type="datetime-local"> no fuso do navegador. */
export function toLocalInput(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

/** Horario local digitado -> ISO com fuso (evita gravar 10h como 10h UTC). */
function toIso(local: string): string | null {
  if (!local) return null
  const date = new Date(local)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function headerFromWorkOrder(
  workOrder: WorkOrder | null,
  sellerId: string | null,
  initialCustomer: CustomerSummary | null = null,
): WorkOrderHeaderDraft {
  if (!workOrder && initialCustomer) {
    // Nova OS aberta pela ficha do cliente: cliente e endereco da obra ja preenchidos
    return {
      ...headerFromWorkOrder(null, sellerId),
      customer: initialCustomer,
      zip_code: initialCustomer.zip_code ?? '',
      address: initialCustomer.address ?? '',
      address_number: initialCustomer.address_number ?? '',
      complement: initialCustomer.complement ?? '',
      district: initialCustomer.district ?? '',
      city: initialCustomer.city ?? '',
      state: initialCustomer.state ?? '',
    }
  }
  return {
    customer: workOrder?.customer ?? null,
    title: workOrder?.title ?? '',
    priority: workOrder?.priority ?? 'NORMAL',
    seller_id: workOrder ? workOrder.seller_id : sellerId,
    assigned_to: workOrder?.assigned_to ?? null,
    team_id: workOrder?.team_id ?? null,
    deadline: workOrder?.deadline ?? '',
    scheduled_measurement_at: toLocalInput(workOrder?.scheduled_measurement_at),
    scheduled_install_at: toLocalInput(workOrder?.scheduled_install_at),
    payment_type: workOrder?.payment_type ?? 'A_VISTA',
    payment_method: workOrder?.payment_method ?? null,
    payment_terms: workOrder?.payment_terms ?? '',
    site_details: workOrder?.site_details ?? '',
    zip_code: workOrder?.zip_code ?? '',
    address: workOrder?.address ?? '',
    address_number: workOrder?.address_number ?? '',
    complement: workOrder?.complement ?? '',
    district: workOrder?.district ?? '',
    city: workOrder?.city ?? '',
    state: workOrder?.state ?? '',
    freight: Number(workOrder?.freight ?? 0),
    surcharge: Number(workOrder?.surcharge ?? 0),
    discount: Number(workOrder?.discount ?? 0),
    notes: workOrder?.notes ?? '',
    internal_notes: workOrder?.internal_notes ?? '',
  }
}

export function headerToInput(draft: WorkOrderHeaderDraft, id: string | null): WorkOrderHeaderInput {
  const { customer, scheduled_measurement_at, scheduled_install_at, deadline, ...rest } = draft
  return {
    ...rest,
    id,
    customer_id: customer?.id ?? '',
    deadline: deadline || null,
    scheduled_measurement_at: toIso(scheduled_measurement_at),
    scheduled_install_at: toIso(scheduled_install_at),
  }
}
