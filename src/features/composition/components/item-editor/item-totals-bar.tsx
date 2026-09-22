import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { area4ToM2, centsToMoney, itemTotals } from '../../pricing'
import type { ItemDraft } from '../../types'

function Cell({ label, value, strong, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return (
    <div className="min-w-0 rounded-md bg-muted/40 px-2.5 py-1.5">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className={cn('truncate text-sm tabular', strong ? 'font-semibold text-primary' : 'font-medium')}>{value}</p>
      {hint && <p className="truncate text-[10px] text-destructive">{hint}</p>}
    </div>
  )
}

/** Rodape da "Edicao de Item" com os totais do sistema antigo. */
export function ItemTotalsBar({ draft }: { draft: ItemDraft }) {
  const totals = itemTotals(draft)
  const money = (cents: number) => formatCurrency(centsToMoney(cents))

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
      <Cell label="Total de Materiais" value={money(totals.materialsCents)} />
      <Cell label="Total M² de Materiais" value={formatNumber(area4ToM2(totals.materialsArea4), 4)} />
      <Cell label="Total de Acabamentos" value={money(totals.byKind.ACABAMENTO)} />
      <Cell label="Total de Serviços" value={money(totals.byKind.SERVICO)} />
      <Cell label="Total de Revendas" value={money(totals.byKind.REVENDA)} />
      <Cell label="Total de Insumos" value={money(totals.byKind.INSUMO)} hint="Não compõe o total geral" />
      <Cell label="Total Geral do Item" value={money(totals.totalCents)} strong />
    </div>
  )
}
