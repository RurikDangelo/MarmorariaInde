'use client'

import * as React from 'react'
import { PlusCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDocument } from './document-context'
import { EnvironmentsPanel } from './environments-panel'
import { ItemEditorDialog } from './item-editor/item-editor-dialog'
import { draftFromItem, emptyDraft } from './item-editor/use-item-draft'
import { ProductsGrid } from './products-grid'
import type { LineItem } from '@/types/database'
import type { ItemDraft } from '../types'

/** Ambientes a esquerda, produtos a direita e "Incluir" — o miolo da tela da OS/orcamento. */
export function CompositionSection({ items }: { items: LineItem[] }) {
  const { environments, canEdit, missingForCreate } = useDocument()
  const [selected, setSelected] = React.useState<string>('all')
  const [editing, setEditing] = React.useState<ItemDraft | null>(null)

  const visible = selected === 'all' ? items : items.filter((item) => item.environment_id === selected)

  function include() {
    const missing = missingForCreate()
    if (missing) {
      toast.error(missing)
      return
    }
    const environmentId =
      selected !== 'all' ? selected : environments.length === 1 ? environments[0].id : null
    setEditing(emptyDraft(environmentId))
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Ambientes e produtos</CardTitle>
        {canEdit && (
          <Button type="button" size="sm" onClick={include}>
            <PlusCircle />
            Incluir produto
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <EnvironmentsPanel items={items} selected={selected} onSelect={setSelected} />
        <ProductsGrid items={visible} onOpen={(item) => setEditing(draftFromItem(item))} />
      </CardContent>

      {editing && (
        <ItemEditorDialog key={editing.id} initial={editing} readOnly={!canEdit} onClose={() => setEditing(null)} />
      )}
    </Card>
  )
}
