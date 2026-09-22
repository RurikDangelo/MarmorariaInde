import { notFound } from 'next/navigation'
import { getCompanySettings, requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatDateTime } from '@/lib/utils'
import { paymentMethodLabel, PAYMENT_TYPES } from '@/lib/labels'
import { getWorkOrder, loadWorkOrder } from '@/features/work-orders/queries'
import { ensureNewItemsModel, getComposition } from '@/features/composition/queries'
import { parsePrintOptions } from '@/features/composition/print-options'
import { drawingUrlsFor } from '@/features/composition/print-data'
import { DocumentPrint } from '@/features/composition/components/print/document-print'
import { PrintToolbar } from '@/features/composition/components/print/print-toolbar'
import type { FinancialTransaction, PaymentMethod } from '@/types/database'

export const metadata = { title: 'Emitir OS' }

/** Emissao da OS com o logo da marmoraria. "Valores" desligado = via da oficina. */
export default async function PrintWorkOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ocultar?: string }>
}) {
  const [{ id }, { ocultar }] = await Promise.all([params, searchParams])
  const [user, loadedWorkOrder] = await Promise.all([requirePermission('work_orders.read'), getWorkOrder(id)])
  let workOrder = loadedWorkOrder
  if (!workOrder) notFound()
  if (workOrder.items_model === 1) {
    await ensureNewItemsModel({ kind: 'work_order', id }, 1)
    workOrder = (await loadWorkOrder(id)) ?? workOrder
  }

  const supabase = await createClient()
  const [composition, settings, { data: receivables }] = await Promise.all([
    getComposition({ kind: 'work_order', id }),
    getCompanySettings(),
    user.permissions.has('financial.read')
      ? supabase
          .from('financial_transactions')
          .select('*')
          .eq('work_order_id', id)
          .eq('kind', 'RECEITA')
          .neq('status', 'CANCELADO')
          .order('due_date')
          .returns<FinancialTransaction[]>()
      : Promise.resolve({ data: [] as FinancialTransaction[] }),
  ])
  const options = parsePrintOptions(ocultar)
  const drawingUrls = options.desenhos ? await drawingUrlsFor(composition.items) : {}
  const siteAddress = [workOrder.address, workOrder.address_number, workOrder.complement, workOrder.district, workOrder.city, workOrder.state]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="bg-muted/30 py-4 print:bg-white print:py-0">
      <PrintToolbar options={options} />
      <DocumentPrint
        settings={settings}
        title={`Ordem de Serviço Nº ${workOrder.number}`}
        subtitle={[
          `Emissão ${formatDate(workOrder.created_at)}`,
          workOrder.deadline ? `Prazo de entrega ${formatDate(`${workOrder.deadline}T12:00:00`)}` : null,
          workOrder.title,
        ]
          .filter(Boolean)
          .join(' · ')}
        customer={workOrder.customer}
        siteDetails={[siteAddress && `Local: ${siteAddress}`, workOrder.site_details].filter(Boolean).join('\n') || null}
        composition={composition}
        options={options}
        totals={{
          products: Number(workOrder.products_total),
          freight: Number(workOrder.freight),
          surcharge: Number(workOrder.surcharge),
          discount: Number(workOrder.discount),
          total: Number(workOrder.total_value),
        }}
        installments={(receivables ?? []).map((row) => ({
          number: row.installment,
          count: row.installments,
          dueDate: row.due_date,
          amount: Number(row.amount),
          method: row.payment_method as PaymentMethod | null,
        }))}
        info={[
          { label: 'Vendedor', value: workOrder.seller?.full_name },
          { label: 'Responsável', value: workOrder.assignee?.full_name },
          { label: 'Tipo de pagamento', value: PAYMENT_TYPES.find((type) => type.value === workOrder.payment_type)?.label },
          { label: 'Forma de pagamento', value: workOrder.payment_terms },
          { label: 'Espécie', value: workOrder.payment_method ? paymentMethodLabel(workOrder.payment_method) : null },
          { label: 'Medição', value: workOrder.scheduled_measurement_at ? formatDateTime(workOrder.scheduled_measurement_at) : null },
          { label: 'Instalação', value: workOrder.scheduled_install_at ? formatDateTime(workOrder.scheduled_install_at) : null },
        ]}
        notes={workOrder.notes}
        drawingUrls={drawingUrls}
        signatures={['Responsável pela marmoraria', 'Cliente']}
      />
    </div>
  )
}
