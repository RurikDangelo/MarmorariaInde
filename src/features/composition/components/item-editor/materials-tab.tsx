'use client'

import * as React from 'react'
import { Lock, LockOpen, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MoneyInput } from '@/components/shared/inputs'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { CatalogPicker } from '@/features/catalog/components/catalog-picker'
import { MaterialDialog } from '@/features/stock/components/stock-dialogs'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { area4ToM2, centsToMoney, materialTotals } from '../../pricing'
import { useDocument } from '../document-context'
import type { ItemDraft, MaterialOption } from '../../types'
import { newId, type ItemDraftDispatch } from './use-item-draft'

/** Aba Materiais: Codigo · Descricao · Quantidade M2 · QTD M2 Total · Valor por M2 · Valor Total. */
export function MaterialsTab({ draft, dispatch }: { draft: ItemDraft; dispatch: ItemDraftDispatch }) {
  const { catalog, addMaterial, canManageCatalog } = useDocument()
  const [creating, setCreating] = React.useState<string | null>(null)

  const options = React.useMemo(
    () =>
      catalog.materials.map((material) => ({
        id: material.id,
        code: material.code,
        name: material.name,
        hint: material.price_per_m2 ? `${formatCurrency(material.price_per_m2)}/m²` : undefined,
      })),
    [catalog.materials],
  )

  function include(material: MaterialOption) {
    if (draft.materials.some((row) => row.material_id === material.id)) return
    dispatch({
      type: 'material:add',
      material: {
        id: newId(),
        material_id: material.id,
        code: material.code,
        description: material.name,
        thickness_mm: material.thickness_mm,
        price_per_m2: Number(material.price_per_m2 ?? 0),
        price_overridden: false,
      },
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <CatalogPicker
        options={options}
        value={null}
        placeholder="Incluir material (código ou descrição)…"
        onSelect={(id) => {
          const material = catalog.materials.find((row) => row.id === id)
          if (material) include(material)
        }}
        onCreate={canManageCatalog ? (term) => setCreating(term) : undefined}
        createLabel="Cadastrar material"
      />

      {draft.materials.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          Escolha o material (ex.: Gran. Preto São Gabriel). O m² vem das peças.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Código</th>
                <th className="px-2 py-2 text-left font-medium">Descrição do material</th>
                <th className="px-2 py-2 text-right font-medium">Quantidade M²</th>
                <th className="px-2 py-2 text-right font-medium">QTD M² Total</th>
                <th className="px-2 py-2 text-right font-medium">Valor por M²</th>
                <th className="px-2 py-2 text-right font-medium">Valor Total</th>
                <th className="w-9" />
              </tr>
            </thead>
            <tbody>
              {draft.materials.map((material) => {
                const totals = materialTotals(material, draft.pieces, draft.quantity)
                const pieces = draft.pieces.filter((piece) => piece.line_item_material_id === material.id).length
                const catalogPrice = Number(catalog.materials.find((row) => row.id === material.material_id)?.price_per_m2 ?? 0)
                return (
                  <tr key={material.id} className="border-t">
                    <td className="px-2 py-1.5 tabular text-muted-foreground">{material.code ?? '—'}</td>
                    <td className="px-2 py-1.5">
                      {material.description}
                      <span className="block text-xs text-muted-foreground">
                        {pieces} {pieces === 1 ? 'peça' : 'peças'}
                        {material.thickness_mm ? ` · ${material.thickness_mm} mm` : ''}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular">{formatNumber(area4ToM2(totals.areaWithWaste4), 4)}</td>
                    <td className="px-2 py-1.5 text-right tabular">{formatNumber(area4ToM2(totals.totalArea4), 4)}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-end gap-1">
                        <MoneyInput
                          value={material.price_per_m2}
                          onValueChange={(price) => dispatch({ type: 'material:set', id: material.id, patch: { price_per_m2: price } })}
                          disabled={!material.price_overridden && material.material_id !== null}
                          className="h-8 w-32 text-right"
                          aria-label="Valor por M²"
                        />
                        {material.material_id && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title={material.price_overridden ? 'Voltar ao preço do cadastro' : 'Liberar para alterar o preço'}
                            onClick={() =>
                              dispatch({
                                type: 'material:set',
                                id: material.id,
                                patch: material.price_overridden
                                  ? { price_overridden: false, price_per_m2: catalogPrice }
                                  : { price_overridden: true },
                              })
                            }
                          >
                            {material.price_overridden ? <LockOpen className="text-warning" /> : <Lock />}
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium tabular">{formatCurrency(centsToMoney(totals.valueCents))}</td>
                    <td className="px-1">
                      <ConfirmDialog
                        trigger={
                          <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover material">
                            <Trash2 className="text-destructive" />
                          </Button>
                        }
                        title="Remover material"
                        description={
                          pieces
                            ? `${material.description} e as ${pieces} peça(s) dele saem deste produto.`
                            : `${material.description} sai deste produto.`
                        }
                        variant="destructive"
                        confirmLabel="Remover"
                        onConfirm={() => dispatch({ type: 'material:remove', id: material.id, withPieces: true })}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating !== null && (
        <MaterialDialog
          types={catalog.materialTypes}
          open
          onOpenChange={(open) => !open && setCreating(null)}
          defaultName={creating}
          onSaved={(material) => {
            addMaterial(material)
            include(material)
            setCreating(null)
          }}
        />
      )}
    </div>
  )
}
