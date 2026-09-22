import { CheckCircle2, CircleAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNumber } from '@/lib/utils'
import type { MaterialNeed } from '@/features/composition/components/materials-summary'
import type { StockItem } from '@/types/database'

/**
 * Quanto a montagem pede de cada pedra (m² com perda) x chapas ja reservadas
 * para esta OS. Mostra o que falta separar antes do corte.
 */
export function MaterialNeeds({ needs, reserved }: { needs: MaterialNeed[]; reserved: StockItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Necessidade da montagem</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {needs.map((need) => {
            const reservedArea = reserved
              .filter((item) => need.materialId && item.material_id === need.materialId)
              .reduce((sum, item) => sum + Number(item.area_m2 ?? 0), 0)
            const missing = Math.max(0, need.areaWithWaste - reservedArea)
            const covered = need.materialId !== null && missing === 0
            return (
              <li key={need.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                {covered ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <CircleAlert className="size-4 text-warning" />
                )}
                <span className="min-w-0 flex-1 truncate font-medium">
                  {need.description}
                  {need.thicknessMm ? <span className="text-xs text-muted-foreground"> · {need.thicknessMm} mm</span> : null}
                </span>
                <span className="tabular text-muted-foreground">precisa {formatNumber(need.areaWithWaste, 4)} m²</span>
                <span className="tabular text-muted-foreground">reservado {formatNumber(reservedArea, 4)} m²</span>
                <span className={covered ? 'tabular text-success' : 'tabular font-medium text-warning'}>
                  {need.materialId === null
                    ? 'material sem cadastro'
                    : covered
                      ? 'coberto'
                      : `falta ${formatNumber(missing, 4)} m²`}
                </span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
