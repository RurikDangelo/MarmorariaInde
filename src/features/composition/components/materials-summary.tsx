import { formatCurrency, formatNumber } from '@/lib/utils'
import type { LineItem } from '@/types/database'

export interface MaterialNeed {
  key: string
  materialId: string | null
  code: string | null
  description: string
  thicknessMm: number | null
  area: number
  areaWithWaste: number
  value: number
}

/** Soma por material de todos os produtos (m² ja com perda e x quantidade). */
export function summarizeMaterials(items: LineItem[]): MaterialNeed[] {
  const byKey = new Map<string, MaterialNeed>()
  for (const item of items) {
    for (const material of item.materials ?? []) {
      const key = material.material_id ?? `sem-cadastro:${material.description}`
      const current = byKey.get(key) ?? {
        key,
        materialId: material.material_id,
        code: material.code,
        description: material.description,
        thicknessMm: material.thickness_mm,
        area: 0,
        areaWithWaste: 0,
        value: 0,
      }
      current.area += Number(material.area_m2) * Number(item.quantity)
      current.areaWithWaste += Number(material.total_area_m2)
      current.value += Number(material.total_value)
      byKey.set(key, current)
    }
  }
  return [...byKey.values()].sort((a, b) => b.areaWithWaste - a.areaWithWaste)
}

/** Aba "Total de Materiais": quanto de cada pedra o documento consome. */
export function MaterialsSummary({ items }: { items: LineItem[] }) {
  const rows = summarizeMaterials(items)
  if (!rows.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum material lançado ainda.</p>
  }
  const totalArea = rows.reduce((sum, row) => sum + row.areaWithWaste, 0)
  const totalValue = rows.reduce((sum, row) => sum + row.value, 0)

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-2 py-2 text-left font-medium">Código</th>
            <th className="px-2 py-2 text-left font-medium">Material</th>
            <th className="px-2 py-2 text-right font-medium">M² das peças</th>
            <th className="px-2 py-2 text-right font-medium">M² com perda</th>
            <th className="px-2 py-2 text-right font-medium">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t">
              <td className="px-2 py-1.5 tabular text-muted-foreground">{row.code ?? '—'}</td>
              <td className="px-2 py-1.5">
                {row.description}
                {row.thicknessMm ? <span className="text-xs text-muted-foreground"> · {row.thicknessMm} mm</span> : null}
              </td>
              <td className="px-2 py-1.5 text-right tabular">{formatNumber(row.area, 4)}</td>
              <td className="px-2 py-1.5 text-right font-medium tabular">{formatNumber(row.areaWithWaste, 4)}</td>
              <td className="px-2 py-1.5 text-right tabular">{formatCurrency(row.value)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/30 font-medium">
            <td className="px-2 py-1.5" colSpan={3}>
              Área total
            </td>
            <td className="px-2 py-1.5 text-right tabular">{formatNumber(totalArea, 4)} m²</td>
            <td className="px-2 py-1.5 text-right tabular">{formatCurrency(totalValue)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
