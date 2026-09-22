'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Power } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/shared/states'
import { filterCatalog } from '@/features/catalog/components/catalog-picker'
import { ProductDialog } from '@/features/catalog/components/product-dialog'
import { setProductActive } from '@/features/catalog/actions'
import { productKindLabel, unitLabel } from '@/lib/labels'
import { formatCurrency } from '@/lib/utils'
import type { Product, ProductKind } from '@/types/database'

/** Lista de um tipo de cadastro (produtos, acabamentos...) com busca, inclusao e edicao. */
export function ProductsManager({ kind, products, canWrite }: { kind: ProductKind; products: Product[]; canWrite: boolean }) {
  const router = useRouter()
  const [term, setTerm] = React.useState('')
  const [editing, setEditing] = React.useState<Product | 'novo' | null>(null)
  const rows = filterCatalog(products, term, 500)

  async function toggle(product: Product) {
    const result = await setProductActive(product.id, !product.active)
    if (!result.ok) toast.error(result.error)
    else {
      toast.success(result.message)
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar por código ou descrição"
          className="max-w-sm"
        />
        {canWrite && (
          <Button type="button" onClick={() => setEditing('novo')} className="ml-auto">
            <Plus />
            Novo {productKindLabel(kind).toLowerCase()}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={term ? 'Nada encontrado' : `Nenhum ${productKindLabel(kind).toLowerCase()} cadastrado`}
          description="Também dá para cadastrar direto na tela da OS, na hora de lançar o produto."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Código</th>
                <th className="px-3 py-2 text-left font-medium">Descrição</th>
                <th className="px-3 py-2 text-left font-medium">Unid.</th>
                <th className="px-3 py-2 text-right font-medium">{kind === 'INSUMO' ? 'Custo' : 'Valor'}</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => (
                <tr key={product.id} className="border-t">
                  <td className="px-3 py-2 tabular text-muted-foreground">{product.code ?? '—'}</td>
                  <td className="px-3 py-2">
                    {product.name}
                    {!product.active && (
                      <Badge variant="muted" size="sm" className="ml-2">
                        inativo
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">{unitLabel(product.unit)}</td>
                  <td className="px-3 py-2 text-right tabular">
                    {formatCurrency(kind === 'INSUMO' ? (product.cost ?? product.price) : product.price)}
                  </td>
                  <td className="px-2 py-1">
                    {canWrite && (
                      <div className="flex justify-end">
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => setEditing(product)}>
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={product.active ? 'Desativar' : 'Reativar'}
                          title={product.active ? 'Desativar' : 'Reativar'}
                          onClick={() => toggle(product)}
                        >
                          <Power className={product.active ? 'text-destructive' : 'text-success'} />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ProductDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          kind={kind}
          product={editing === 'novo' ? undefined : editing}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  )
}
