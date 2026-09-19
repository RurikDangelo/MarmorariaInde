import { notFound } from 'next/navigation'
import { requirePermission, getCompanySettings } from '@/lib/auth/session'
import { getWorkOrder, getWorkOrderItems, getWorkOrderMeasurements } from '@/features/work-orders/queries'
import { formatArea, formatCurrency, formatDate, formatDimensions } from '@/lib/utils'
import { PrintButton } from './print-button'

export const metadata = { title: 'Imprimir OS' }

/** Layout de impressão: uma folha A4 limpa para a oficina e para o cliente. */
export default async function PrintWorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requirePermission('work_orders.read')

  const [workOrder, items, settings, measurements] = await Promise.all([
    getWorkOrder(id),
    getWorkOrderItems(id),
    getCompanySettings(),
    user.permissions.has('measurements.read') ? getWorkOrderMeasurements(id) : Promise.resolve([]),
  ])

  if (!workOrder) notFound()

  const measurement = measurements[0]
  const totalArea = items.reduce((sum, item) => sum + Number(item.area_m2 ?? 0), 0)

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 text-black print:p-0">
      <PrintButton />

      <header className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <h1 className="text-lg font-bold uppercase">{settings?.company_name ?? 'Marmoraria Independência'}</h1>
          <p className="text-xs">
            {[settings?.phone, settings?.whatsapp, settings?.email].filter(Boolean).join(' · ')}
          </p>
          <p className="text-xs">
            {[settings?.address, settings?.city, settings?.state].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide">Ordem de serviço</p>
          <p className="text-xl font-bold">{workOrder.number}</p>
          <p className="text-xs">Emissão: {formatDate(workOrder.created_at)}</p>
          {workOrder.deadline && <p className="text-xs">Prazo: {formatDate(workOrder.deadline)}</p>}
        </div>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <h2 className="text-xs font-bold uppercase">Cliente</h2>
          <p>{workOrder.customer?.name}</p>
          <p className="text-xs">{workOrder.customer?.document}</p>
          <p className="text-xs">{workOrder.customer?.phone ?? workOrder.customer?.whatsapp}</p>
        </div>
        <div>
          <h2 className="text-xs font-bold uppercase">Local de execução</h2>
          <p className="text-xs">
            {workOrder.address}
            {workOrder.address_number ? `, ${workOrder.address_number}` : ''}
          </p>
          <p className="text-xs">
            {[workOrder.district, workOrder.city, workOrder.state].filter(Boolean).join(' · ')}
          </p>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-1 text-xs font-bold uppercase">Peças</h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-y border-black">
              <th className="py-1 text-left">Descrição</th>
              <th className="py-1 text-left">Ambiente</th>
              <th className="py-1 text-left">Material</th>
              <th className="py-1 text-left">Medidas</th>
              <th className="py-1 text-right">Qtd</th>
              <th className="py-1 text-right">m²</th>
              <th className="py-1 text-left">Acabamento</th>
              <th className="py-1 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-300 align-top">
                <td className="py-1">
                  {item.description}
                  <ExtrasLine item={item} />
                </td>
                <td className="py-1">{item.environment ?? '—'}</td>
                <td className="py-1">
                  {item.material?.name ?? '—'}
                  {item.color ? ` / ${item.color}` : ''}
                  {item.thickness_mm ? ` ${item.thickness_mm}mm` : ''}
                </td>
                <td className="py-1">{formatDimensions(item.length_mm, item.width_mm)}</td>
                <td className="py-1 text-right">{item.quantity}</td>
                <td className="py-1 text-right">{formatArea(item.area_m2)}</td>
                <td className="py-1">
                  {[item.finish, item.edge].filter(Boolean).join(' / ') || '—'}
                </td>
                <td className="py-1 text-right">{formatCurrency(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black font-bold">
              <td className="py-1.5" colSpan={5}>
                Total
              </td>
              <td className="py-1.5 text-right">{formatArea(totalArea)}</td>
              <td />
              <td className="py-1.5 text-right">{formatCurrency(workOrder.total_value)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {measurement && (
        <section className="mt-5 text-xs">
          <h2 className="mb-1 text-xs font-bold uppercase">Medição</h2>
          <p>
            Responsável: {measurement.responsible?.full_name ?? '—'} ·{' '}
            {measurement.measured_at ? formatDate(measurement.measured_at) : 'não realizada'}
          </p>
          {measurement.obstacles && <p>Obstáculos: {measurement.obstacles}</p>}
          {measurement.hydraulics_notes && <p>Hidráulica: {measurement.hydraulics_notes}</p>}
          {measurement.electrical_notes && <p>Elétrica: {measurement.electrical_notes}</p>}
        </section>
      )}

      {workOrder.notes && (
        <section className="mt-5 text-xs">
          <h2 className="mb-1 text-xs font-bold uppercase">Observações</h2>
          <p className="whitespace-pre-line">{workOrder.notes}</p>
        </section>
      )}

      <section className="mt-6 grid grid-cols-3 gap-3 text-xs">
        <div className="rounded border border-gray-400 p-2">
          <p className="text-[10px] uppercase text-gray-600">Valor total</p>
          <p className="font-bold">{formatCurrency(workOrder.total_value)}</p>
        </div>
        <div className="rounded border border-gray-400 p-2">
          <p className="text-[10px] uppercase text-gray-600">Recebido</p>
          <p className="font-bold">{formatCurrency(workOrder.received_value)}</p>
        </div>
        <div className="rounded border border-gray-400 p-2">
          <p className="text-[10px] uppercase text-gray-600">Em aberto</p>
          <p className="font-bold">{formatCurrency(workOrder.pending_value)}</p>
        </div>
      </section>

      <section className="mt-12 grid grid-cols-2 gap-10 text-center text-xs">
        <div className="border-t border-black pt-1">Responsável pela marmoraria</div>
        <div className="border-t border-black pt-1">Cliente</div>
      </section>
    </div>
  )
}

function ExtrasLine({
  item,
}: {
  item: {
    has_sink: boolean
    sink_type: string | null
    sink_quantity: number
    has_cooktop: boolean
    cooktop_type: string | null
    cutouts: number
    faucet_holes: number
    outlet_holes: number
    skirt_mm: number | null
    backsplash_mm: number | null
    notes: string | null
  }
}) {
  const extras: string[] = []
  if (item.has_sink) extras.push(`cuba ${item.sink_type ?? ''} ×${item.sink_quantity || 1}`.trim())
  if (item.has_cooktop) extras.push(`cooktop ${item.cooktop_type ?? ''}`.trim())
  if (item.cutouts) extras.push(`${item.cutouts} recorte(s)`)
  if (item.faucet_holes) extras.push(`${item.faucet_holes} furo(s) torneira`)
  if (item.outlet_holes) extras.push(`${item.outlet_holes} furo(s) tomada`)
  if (item.skirt_mm) extras.push(`saia ${item.skirt_mm}mm`)
  if (item.backsplash_mm) extras.push(`frontão ${item.backsplash_mm}mm`)
  if (item.notes) extras.push(item.notes)

  if (!extras.length) return null
  return <span className="block text-[10px] text-gray-600">{extras.join(' · ')}</span>
}
