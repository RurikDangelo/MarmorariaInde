import { unitLabel } from '@/lib/labels'
import { formatNumber } from '@/lib/utils'
import type { LineItem } from '@/types/database'
import type { PrintOptions } from '../../print-options'

const qty4 = (value: number) => formatNumber(value, 4)
const money = (value: number) => formatNumber(value, 2)
const meters = (mm: number) => formatNumber(mm / 1000, 2)

function Row({
  indent,
  code,
  label,
  unit,
  quantity,
  unitValue,
  subtotal,
  options,
  strong,
}: {
  indent: number
  code?: string | null
  label: React.ReactNode
  unit?: string
  quantity?: string
  unitValue?: string
  subtotal?: string
  options: PrintOptions
  strong?: boolean
}) {
  return (
    <tr className={strong ? 'font-semibold' : undefined}>
      <td className="py-0.5 pr-2 align-top tabular">{code ?? ''}</td>
      <td className="py-0.5 pr-2 align-top" style={{ paddingLeft: `${indent * 14}px` }}>
        {label}
      </td>
      <td className="py-0.5 pr-2 text-center align-top">{unit ?? ''}</td>
      {options.quantidade && <td className="py-0.5 pr-2 text-right align-top tabular">{quantity ?? ''}</td>}
      {options.valor_unitario && <td className="py-0.5 pr-2 text-right align-top tabular">{unitValue ?? ''}</td>}
      {options.subtotal && <td className="py-0.5 text-right align-top tabular">{subtotal ?? ''}</td>}
    </tr>
  )
}

function Heading({ label, options }: { label: string; options: PrintOptions }) {
  const span = 3 + Number(options.quantidade) + Number(options.valor_unitario) + Number(options.subtotal)
  return (
    <tr>
      <td colSpan={span} className="pt-1 text-[10px] italic" style={{ paddingLeft: '14px' }}>
        {label}
      </td>
    </tr>
  )
}

/** Um produto e sua composicao, no formato da impressao do sistema antigo. */
export function PrintItem({ item, options, drawingUrl }: { item: LineItem; options: PrintOptions; drawingUrl?: string | null }) {
  const quantity = Number(item.quantity)
  const materials = item.materials ?? []
  const pieces = item.pieces ?? []
  const components = item.components ?? []
  const byKind = (kind: string) => components.filter((component) => component.kind === kind)

  return (
    <>
      <Row
        indent={0}
        code={item.code}
        strong
        label={[item.description, item.complement].filter(Boolean).join(' — ')}
        unit={unitLabel(item.unit)}
        quantity={formatNumber(quantity, quantity % 1 ? 2 : 0)}
        unitValue={money(Number(item.total) / quantity)}
        subtotal={money(Number(item.total))}
        options={options}
      />

      {options.materiais && materials.length > 0 && (
        <>
          <Heading label="Materiais Utilizados" options={options} />
          {materials.map((material) => (
            <Row
              key={material.id}
              indent={2}
              code={material.code}
              label={`${material.description}${material.thickness_mm ? ` ${material.thickness_mm} mm` : ''}`}
              unit="M²"
              quantity={qty4(Number(material.total_area_m2))}
              unitValue={money(Number(material.price_per_m2))}
              subtotal={options.subtotal_composicao ? money(Number(material.total_value)) : ''}
              options={options}
            />
          ))}
        </>
      )}

      {options.pecas && pieces.length > 0 && (
        <>
          <Heading label="Peças" options={options} />
          {pieces.map((piece) => {
            const material = materials.find((row) => row.id === piece.line_item_material_id)
            const area = Math.round(Number(piece.area_with_waste_m2) * quantity * 10_000) / 10_000
            const dims = options.medidas
              ? ` (${formatNumber(piece.quantity, 0)} Pç ${meters(piece.length_mm)} x ${meters(piece.width_mm)})`
              : ''
            return (
              <Row
                key={piece.id}
                indent={3}
                label={`Peça ${piece.number ?? ''}${piece.name ? ` — ${piece.name}` : ''}${dims}`}
                quantity={qty4(area)}
                unitValue={material ? money(Number(material.price_per_m2)) : ''}
                subtotal={
                  material && options.subtotal_composicao
                    ? money(Math.round(area * Number(material.price_per_m2) * 100) / 100)
                    : ''
                }
                options={options}
              />
            )
          })}
        </>
      )}

      {(
        [
          ['ACABAMENTO', 'Acabamentos', options.acabamentos],
          ['SERVICO', 'Serviços', options.servicos],
          ['REVENDA', 'Produtos para Revenda', options.revendas],
        ] as const
      ).map(([kind, label, visible]) =>
        visible && byKind(kind).length > 0 ? (
          <FragmentRows key={kind} label={label} options={options}>
            {byKind(kind).map((component) => (
              <Row
                key={component.id}
                indent={3}
                code={component.code}
                label={component.description}
                unit={unitLabel(component.unit)}
                quantity={qty4(Number(component.total_quantity))}
                unitValue={money(Number(component.unit_price))}
                subtotal={options.subtotal_composicao ? money(Number(component.total_value)) : ''}
                options={options}
              />
            ))}
          </FragmentRows>
        ) : null,
      )}

      {options.desenhos && drawingUrl && (
        <tr>
          <td />
          <td colSpan={5} className="py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={drawingUrl} alt="Desenho do produto" className="max-h-[70mm] max-w-full border border-gray-300 object-contain" />
          </td>
        </tr>
      )}
    </>
  )
}

function FragmentRows({ label, options, children }: { label: string; options: PrintOptions; children: React.ReactNode }) {
  return (
    <>
      <Heading label={label} options={options} />
      {children}
    </>
  )
}
