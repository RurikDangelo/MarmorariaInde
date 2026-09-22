'use client'

import * as React from 'react'
import { Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field } from '@/components/shared/form'
import { DecimalField, MetersField } from '@/components/shared/number-fields'
import { CatalogPicker } from '@/features/catalog/components/catalog-picker'
import { ProductDialog } from '@/features/catalog/components/product-dialog'
import { UNITS } from '@/lib/labels'
import { useDocument } from '../document-context'
import type { Product, UnitCode } from '@/types/database'
import type { ItemDraft } from '../../types'
import { EnvironmentSelect } from './environment-select'
import { generatePieces } from './generate-pieces'
import type { ItemDraftDispatch } from './use-item-draft'

/** Topo da "Edicao de Item": produto, ambiente, quantidade e as medidas gerais. */
export function ItemHeaderFields({
  draft,
  dispatch,
  onNeedMaterial,
  onPiecesGenerated,
  showErrors,
}: {
  draft: ItemDraft
  dispatch: ItemDraftDispatch
  onNeedMaterial: () => void
  onPiecesGenerated: () => void
  showErrors: boolean
}) {
  const { catalog, addProduct, canManageCatalog, defaultWastePct } = useDocument()
  const [creating, setCreating] = React.useState<string | null>(null)
  const products = catalog.products.filter((product) => product.kind === 'PRODUTO')
  const set = (patch: Partial<ItemDraft>) => dispatch({ type: 'item', patch })

  function chooseProduct(product: Product) {
    set({ product_id: product.id, code: product.code, description: product.name, unit: product.unit })
  }

  function generate() {
    if (!draft.length_mm || !draft.width_mm) {
      toast.error('Informe Comprimento e Largura para gerar as peças.')
      return
    }
    const material = draft.materials[0]
    if (!material) {
      toast.error('Escolha o material primeiro.')
      onNeedMaterial()
      return
    }
    const pieces = generatePieces(draft, material.id, defaultWastePct)
    dispatch({ type: 'piece:add', pieces })
    toast.success(`${pieces.length} peça(s) gerada(s) em ${material.description}.`)
    onPiecesGenerated()
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <Field label="Produto" required className="col-span-2 lg:col-span-3">
        <CatalogPicker
          options={products.map((product) => ({ id: product.id, code: product.code, name: product.name }))}
          value={draft.product_id}
          selectedLabel={draft.description || undefined}
          placeholder="Pia e balcão, bancada, soleira…"
          onSelect={(id) => {
            const product = products.find((row) => row.id === id)
            if (product) chooseProduct(product)
          }}
          onCreate={
            canManageCatalog
              ? (term) => setCreating(term)
              : (term) => term && set({ product_id: null, code: null, description: term })
          }
          createLabel={canManageCatalog ? 'Cadastrar produto' : 'Usar o texto'}
          invalid={showErrors && !draft.description}
        />
      </Field>
      <Field label="Complemento" className="col-span-2 lg:col-span-3">
        <Input value={draft.complement} onChange={(event) => set({ complement: event.target.value })} maxLength={200} />
      </Field>

      <Field label="Ambiente" required className="col-span-2">
        <EnvironmentSelect
          environmentId={draft.environment_id}
          environmentName={draft.environment_name}
          onChange={set}
          invalid={showErrors && !draft.environment_id}
        />
      </Field>
      <Field label="Quantidade">
        <DecimalField value={draft.quantity} onValueChange={(quantity) => set({ quantity })} className="text-right" />
      </Field>
      <Field label="Unidade">
        <Select value={draft.unit} onValueChange={(unit) => set({ unit: unit as UnitCode })}>
          <SelectTrigger>
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
      </Field>
      <Field label="Comprimento">
        <MetersField valueMm={draft.length_mm} onValueChange={(length_mm) => set({ length_mm })} />
      </Field>
      <Field label="Largura">
        <MetersField valueMm={draft.width_mm} onValueChange={(width_mm) => set({ width_mm })} />
      </Field>
      <Field label="Borda">
        <MetersField valueMm={draft.edge_mm} onValueChange={(edge_mm) => set({ edge_mm })} />
      </Field>
      <Field label="Rodabanca">
        <MetersField valueMm={draft.backsplash_mm} onValueChange={(backsplash_mm) => set({ backsplash_mm })} />
      </Field>
      <Field label="Pé">
        <MetersField valueMm={draft.foot_mm} onValueChange={(foot_mm) => set({ foot_mm })} />
      </Field>
      <div className="col-span-2 flex items-end lg:col-span-3">
        <Button type="button" variant="secondary" onClick={generate} className="w-full sm:w-auto">
          <Wand2 />
          Gerar peças
        </Button>
      </div>

      {creating !== null && (
        <ProductDialog
          open
          onOpenChange={(open) => !open && setCreating(null)}
          kind="PRODUTO"
          defaultName={creating}
          onSaved={(product) => {
            addProduct(product)
            chooseProduct(product)
            setCreating(null)
          }}
        />
      )}
    </div>
  )
}
