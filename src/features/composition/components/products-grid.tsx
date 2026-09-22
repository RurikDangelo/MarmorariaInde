'use client'

import * as React from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { unitLabel } from '@/lib/labels'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { deleteLineItem, duplicateLineItem } from '../actions'
import { useDocument } from './document-context'
import type { LineItem } from '@/types/database'

/** Grade "Produtos" do sistema antigo: Ambiente, Codigo, Produto, Complemento, Quant., Material... Total. */
export function ProductsGrid({ items, onOpen }: { items: LineItem[]; onOpen: (item: LineItem) => void }) {
  const { environments, canEdit, doc, refresh } = useDocument()
  const environmentOf = (item: LineItem) => environments.find((environment) => environment.id === item.environment_id)
  const total = items.reduce((sum, item) => sum + Number(item.total), 0)

  async function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    const result = await action()
    if (!result.ok) toast.error(result.error)
    else {
      toast.success(result.message)
      refresh()
    }
  }

  const actions = (item: LineItem) =>
    canEdit && doc ? (
      <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Duplicar produto"
          onClick={() => run(() => duplicateLineItem(doc, item.id))}
        >
          <Copy />
        </Button>
        <ConfirmDialog
          trigger={
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover produto">
              <Trash2 className="text-destructive" />
            </Button>
          }
          title="Remover produto"
          description={`"${item.description}" sai deste documento com materiais, peças e composição.`}
          variant="destructive"
          confirmLabel="Remover"
          onConfirm={() => run(() => deleteLineItem(doc, item.id))}
        />
      </div>
    ) : null

  if (!items.length) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        Produtos — nenhum item lançado. Use “Incluir”.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left font-medium">Ambiente</th>
              <th className="px-2 py-2 text-left font-medium">Código</th>
              <th className="px-2 py-2 text-left font-medium">Produto</th>
              <th className="px-2 py-2 text-left font-medium">Complemento</th>
              <th className="px-2 py-2 text-right font-medium">Quant.</th>
              <th className="px-2 py-2 text-right font-medium">Material</th>
              <th className="px-2 py-2 text-right font-medium">Acabamento</th>
              <th className="px-2 py-2 text-right font-medium">Serviço</th>
              <th className="px-2 py-2 text-right font-medium">Revenda</th>
              <th className="px-2 py-2 text-right font-medium">Total</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="cursor-pointer border-t hover:bg-secondary/50" onClick={() => onOpen(item)}>
                <td className="px-2 py-2">{environmentOf(item)?.name ?? '—'}</td>
                <td className="px-2 py-2 tabular text-muted-foreground">{item.code ?? '—'}</td>
                <td className="px-2 py-2 font-medium">{item.description}</td>
                <td className="px-2 py-2 text-muted-foreground">{item.complement ?? ''}</td>
                <td className="px-2 py-2 text-right tabular">
                  {formatNumber(item.quantity, Number(item.quantity) % 1 ? 2 : 0)} {unitLabel(item.unit)}
                </td>
                <td className="px-2 py-2 text-right tabular">
                  {formatCurrency(item.materials_total)}
                  <span className="block text-[11px] text-muted-foreground">
                    {formatNumber(item.materials_area_m2, 4)} m²
                  </span>
                </td>
                <td className="px-2 py-2 text-right tabular">{formatCurrency(item.finishes_total)}</td>
                <td className="px-2 py-2 text-right tabular">{formatCurrency(item.services_total)}</td>
                <td className="px-2 py-2 text-right tabular">{formatCurrency(item.resale_total)}</td>
                <td className="px-2 py-2 text-right font-semibold tabular">{formatCurrency(item.total)}</td>
                <td className="px-1">{actions(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {items.map((item) => (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(item)}
            onKeyDown={(event) => event.key === 'Enter' && onOpen(item)}
            className="rounded-lg border bg-card p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{item.description}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[environmentOf(item)?.name, item.complement].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular">{formatCurrency(item.total)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="tabular">
                {formatNumber(item.materials_area_m2, 4)} m² · material {formatCurrency(item.materials_total)}
              </span>
              {actions(item)}
            </div>
          </div>
        ))}
      </div>

      <p className="text-right text-sm">
        <span className="text-muted-foreground">Total deste ambiente: </span>
        <strong className="tabular">{formatCurrency(total)}</strong>
      </p>
    </div>
  )
}
