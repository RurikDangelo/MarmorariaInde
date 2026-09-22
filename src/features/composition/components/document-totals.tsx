'use client'

import { Card, CardContent } from '@/components/ui/card'
import { MoneyInput } from '@/components/shared/inputs'
import { cn, formatCurrency } from '@/lib/utils'

export interface TotalsValues {
  freight: number
  surcharge: number
  discount: number
}

/**
 * Rodape do documento: Total dos Produtos, Frete, Outras Despesas, Desconto e
 * Total. Frete/outras/desconto fazem parte do cabecalho (gravam no Salvar).
 */
export function DocumentTotals({
  productsTotal,
  values,
  onChange,
  readOnly,
  totalLabel,
  dirty,
}: {
  productsTotal: number
  values: TotalsValues
  onChange: (patch: Partial<TotalsValues>) => void
  readOnly: boolean
  totalLabel: string
  dirty: boolean
}) {
  const total = Math.round((productsTotal + values.freight + values.surcharge - values.discount) * 100) / 100

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-3 pt-5 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <p className="text-xs text-muted-foreground">Total dos Produtos</p>
          <p className="mt-2 text-sm font-medium tabular">{formatCurrency(productsTotal)}</p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Frete</span>
          <MoneyInput value={values.freight} onValueChange={(freight) => onChange({ freight })} disabled={readOnly} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Outras Despesas</span>
          <MoneyInput value={values.surcharge} onValueChange={(surcharge) => onChange({ surcharge })} disabled={readOnly} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Desconto (R$)</span>
          <MoneyInput
            value={values.discount}
            onValueChange={(discount) => onChange({ discount })}
            disabled={readOnly}
            className="text-destructive"
          />
        </label>
        <div className={cn('col-span-2 rounded-md bg-primary/8 px-3 py-2 sm:col-span-1')}>
          <p className="text-xs text-muted-foreground">{totalLabel}</p>
          <p className="text-lg font-semibold tabular text-primary">{formatCurrency(total)}</p>
          {dirty && <p className="text-[11px] text-warning">Salve para gravar os valores</p>}
        </div>
      </CardContent>
    </Card>
  )
}
