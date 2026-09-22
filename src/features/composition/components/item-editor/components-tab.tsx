'use client'

import * as React from 'react'
import { Lock, LockOpen, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MoneyInput } from '@/components/shared/inputs'
import { DecimalField } from '@/components/shared/number-fields'
import { CatalogPicker } from '@/features/catalog/components/catalog-picker'
import { ProductDialog } from '@/features/catalog/components/product-dialog'
import { UNITS, productKindLabel, unitLabel } from '@/lib/labels'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { centsToMoney, componentTotals } from '../../pricing'
import { useDocument } from '../document-context'
import type { ComponentKind, Product, UnitCode } from '@/types/database'
import type { ItemDraft } from '../../types'
import { newId, type ItemDraftDispatch } from './use-item-draft'

const PLACEHOLDER: Record<ComponentKind, string> = {
  ACABAMENTO: 'Incluir acabamento (ex.: Acabamento 45°)…',
  SERVICO: 'Incluir serviço (ex.: Furar e colar cuba)…',
  REVENDA: 'Incluir produto para revenda (ex.: Cuba inox)…',
  INSUMO: 'Incluir insumo (ex.: Cola)…',
}

/** Abas Acabamentos, Servicos, Revendas e Insumos (mesma grade, muda o cadastro). */
export function ComponentsTab({
  kind,
  draft,
  dispatch,
}: {
  kind: ComponentKind
  draft: ItemDraft
  dispatch: ItemDraftDispatch
}) {
  const { catalog, addProduct, canManageCatalog } = useDocument()
  const [creating, setCreating] = React.useState<string | null>(null)
  const rows = draft.components.filter((component) => component.kind === kind)
  const catalogOf = catalog.products.filter((product) => product.kind === kind)
  const priceOf = (product: Product) => Number(kind === 'INSUMO' ? (product.cost ?? product.price) : product.price)

  function include(product: Product) {
    dispatch({
      type: 'component:add',
      component: {
        id: newId(),
        kind,
        product_id: product.id,
        code: product.code,
        description: product.name,
        unit: product.unit,
        quantity: 1,
        unit_price: priceOf(product),
        price_overridden: false,
        notes: '',
      },
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <CatalogPicker
        options={catalogOf.map((product) => ({
          id: product.id,
          code: product.code,
          name: product.name,
          hint: `${formatCurrency(priceOf(product))}/${unitLabel(product.unit)}`,
        }))}
        value={null}
        placeholder={PLACEHOLDER[kind]}
        onSelect={(id) => {
          const product = catalogOf.find((row) => row.id === id)
          if (product) include(product)
        }}
        onCreate={canManageCatalog ? (term) => setCreating(term) : undefined}
        createLabel={`Cadastrar ${productKindLabel(kind).toLowerCase()}`}
      />

      {kind === 'INSUMO' && (
        <p className="text-xs text-muted-foreground">Insumo é custo interno: não compõe o Total Geral do Item.</p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          Nada lançado em {productKindLabel(kind).toLowerCase()}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Código</th>
                <th className="px-2 py-2 text-left font-medium">Descrição</th>
                <th className="px-2 py-2 text-left font-medium">Unid.</th>
                <th className="px-2 py-2 text-right font-medium">Quant.</th>
                <th className="px-2 py-2 text-right font-medium">QTD Total</th>
                <th className="px-2 py-2 text-right font-medium">{kind === 'INSUMO' ? 'Custo unit.' : 'Valor unit.'}</th>
                <th className="px-2 py-2 text-right font-medium">Valor</th>
                <th className="w-9" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const totals = componentTotals(row, draft.quantity)
                const product = catalog.products.find((option) => option.id === row.product_id)
                const set = (patch: Partial<typeof row>) => dispatch({ type: 'component:set', id: row.id, patch })
                return (
                  <tr key={row.id} className="border-t align-middle">
                    <td className="px-2 py-1.5 tabular text-muted-foreground">{row.code ?? '—'}</td>
                    <td className="px-2 py-1.5">
                      <Input value={row.description} onChange={(event) => set({ description: event.target.value })} className="h-8" />
                    </td>
                    <td className="w-24 px-2 py-1.5">
                      <Select value={row.unit} onValueChange={(unit) => set({ unit: unit as UnitCode })}>
                        <SelectTrigger className="h-8" aria-label="Unidade">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((unit) => (
                            <SelectItem key={unit.value} value={unit.value}>
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="w-24 px-2 py-1.5">
                      <DecimalField value={row.quantity} onValueChange={(quantity) => set({ quantity })} className="h-8 text-right" />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular text-muted-foreground">
                      {formatNumber(totals.totalQuantity4 / 10_000, 4)}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-end gap-1">
                        <MoneyInput
                          value={row.unit_price}
                          onValueChange={(unit_price) => set({ unit_price })}
                          disabled={!row.price_overridden && row.product_id !== null}
                          className="h-8 w-28 text-right"
                          aria-label="Valor unitário"
                        />
                        {row.product_id && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title={row.price_overridden ? 'Voltar ao preço do cadastro' : 'Liberar para alterar o preço'}
                            onClick={() =>
                              set(
                                row.price_overridden
                                  ? { price_overridden: false, unit_price: product ? priceOf(product) : row.unit_price }
                                  : { price_overridden: true },
                              )
                            }
                          >
                            {row.price_overridden ? <LockOpen className="text-warning" /> : <Lock />}
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium tabular">
                      {formatCurrency(centsToMoney(totals.valueCents))}
                    </td>
                    <td className="px-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remover"
                        onClick={() => dispatch({ type: 'component:remove', id: row.id })}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating !== null && (
        <ProductDialog
          open
          onOpenChange={(open) => !open && setCreating(null)}
          kind={kind}
          defaultName={creating}
          onSaved={(product) => {
            addProduct(product)
            include(product)
            setCreating(null)
          }}
        />
      )}
    </div>
  )
}
