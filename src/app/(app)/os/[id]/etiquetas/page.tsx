import { notFound } from 'next/navigation'
import { getCompanySettings, requirePermission } from '@/lib/auth/session'
import { cn, formatNumber } from '@/lib/utils'
import { getWorkOrder, loadWorkOrder } from '@/features/work-orders/queries'
import { ensureNewItemsModel, getComposition } from '@/features/composition/queries'
import { EmptyState } from '@/components/shared/states'
import { LabelsToolbar } from './labels-toolbar'

export const metadata = { title: 'Etiquetas das peças' }

const meters = (mm: number) => formatNumber(mm / 1000, 2)

const PAGE_CSS = {
  a4: '@page { size: A4; margin: 8mm; }',
  termica: '@page { size: 100mm 50mm; margin: 0; }',
}

/** Etiquetas de producao: uma por "QTD de Etiquetas" de cada peca da montagem. */
export default async function WorkOrderLabelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ formato?: string }>
}) {
  const [{ id }, { formato }] = await Promise.all([params, searchParams])
  await requirePermission('work_orders.read')
  let workOrder = await getWorkOrder(id)
  if (!workOrder) notFound()
  if (workOrder.items_model === 1) {
    await ensureNewItemsModel({ kind: 'work_order', id }, 1)
    workOrder = (await loadWorkOrder(id)) ?? workOrder
  }

  const [composition, settings] = await Promise.all([getComposition({ kind: 'work_order', id }), getCompanySettings()])
  const format = formato === 'termica' ? 'termica' : 'a4'

  const labels = composition.items.flatMap((item) => {
    const environment = composition.environments.find((row) => row.id === item.environment_id)
    return (item.pieces ?? []).flatMap((piece) => {
      const material = (item.materials ?? []).find((row) => row.id === piece.line_item_material_id)
      return Array.from({ length: piece.label_count }, (_, copy) => ({
        key: `${piece.id}-${copy}`,
        environment: environment ? `${environment.number} - ${environment.name}` : '',
        product: [item.description, item.complement].filter(Boolean).join(' — '),
        piece: `Peça ${piece.number ?? ''}${piece.name ? ` — ${piece.name}` : ''}`,
        size: `${meters(piece.length_mm)} × ${meters(piece.width_mm)} m${Number(piece.quantity) > 1 ? ` · ${formatNumber(piece.quantity, 0)} pç` : ''}`,
        material: material ? `${material.description}${material.thickness_mm ? ` · ${material.thickness_mm} mm` : ''}` : 'Material não definido',
        specs: piece.specs,
        copy: piece.label_count > 1 ? `${copy + 1}/${piece.label_count}` : null,
      }))
    })
  })

  return (
    <div className="bg-muted/30 py-4 print:bg-white print:py-0">
      <style>{PAGE_CSS[format]}</style>
      <LabelsToolbar format={format} count={labels.length} workOrderId={id} />
      {labels.length === 0 ? (
        <div className="mx-auto max-w-[210mm]">
          <EmptyState title="Nenhuma etiqueta" description="Lance as peças na montagem da OS (QTD de Etiquetas por peça)." />
        </div>
      ) : (
        <div
          className={cn(
            'mx-auto bg-white text-black',
            format === 'a4' ? 'grid max-w-[210mm] grid-cols-2 gap-[3mm] p-[8mm] print:p-0' : 'flex max-w-[100mm] flex-col gap-2 print:gap-0',
          )}
        >
          {labels.map((label) => (
            <div
              key={label.key}
              className={cn(
                'flex flex-col overflow-hidden border border-dashed border-gray-400 p-[3mm] text-[9pt] leading-tight break-inside-avoid',
                format === 'a4' ? 'h-[48mm]' : 'h-[50mm] w-[100mm] print:break-after-page print:border-0',
              )}
            >
              <div className="flex items-baseline justify-between gap-2 text-[7.5pt]">
                <span className="truncate uppercase">{settings?.company_name ?? 'Marmoraria'}</span>
                <span className="shrink-0 text-[10pt] font-bold">{workOrder.number}</span>
              </div>
              <p className="truncate font-semibold">{workOrder.customer?.name}</p>
              <p className="truncate text-[8pt]">
                {label.environment} · {label.product}
              </p>
              <p className="mt-1 truncate text-[12pt] font-bold">{label.piece}</p>
              <p className="text-[11pt] font-semibold tabular">{label.size}</p>
              <p className="truncate text-[8.5pt]">{label.material}</p>
              {label.specs && <p className="line-clamp-2 text-[7.5pt]">{label.specs}</p>}
              {label.copy && <p className="mt-auto text-right text-[7pt]">{label.copy}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
