'use client'

import * as React from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { cn, formatCurrency } from '@/lib/utils'
import { deleteEnvironment } from '../actions'
import { useDocument } from './document-context'
import { EnvironmentDialog } from './environment-dialog'
import type { Environment, LineItem } from '@/types/database'

/** Coluna "Ambientes" do sistema antigo: Todos, 1 - Cozinha, 2 - Banheiro… */
export function EnvironmentsPanel({
  items,
  selected,
  onSelect,
}: {
  items: LineItem[]
  selected: string
  onSelect: (environmentId: string) => void
}) {
  const { environments, canEdit, doc, refresh, missingForCreate } = useDocument()
  const [editing, setEditing] = React.useState<Environment | null | 'novo'>(null)
  const totalOf = (environmentId: string) =>
    items.filter((item) => item.environment_id === environmentId).reduce((sum, item) => sum + Number(item.total), 0)

  async function remove(environment: Environment) {
    if (!doc) return
    const result = await deleteEnvironment(doc, environment.id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(result.message)
    if (selected === environment.id) onSelect('all')
    refresh()
  }

  const chip = (active: boolean) =>
    cn(
      'flex min-w-0 shrink-0 items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
      active ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-secondary',
    )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ambientes</p>
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Novo ambiente"
            onClick={() => {
              const missing = missingForCreate()
              if (missing) toast.error(missing)
              else setEditing('novo')
            }}
          >
            <Plus />
          </Button>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        <button type="button" className={chip(selected === 'all')} onClick={() => onSelect('all')}>
          Todos
        </button>
        {environments.map((environment) => (
          <div key={environment.id} className={cn(chip(selected === environment.id), 'pr-1')}>
            <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => onSelect(environment.id)}>
              {environment.number} - {environment.name}
              <span className="block text-[11px] font-normal text-muted-foreground tabular">
                {formatCurrency(totalOf(environment.id))}
              </span>
            </button>
            {canEdit && (
              <span className="flex shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Editar ${environment.name}`}
                  onClick={() => setEditing(environment)}
                >
                  <Pencil />
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Excluir ${environment.name}`}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  }
                  title={`Excluir ${environment.name}?`}
                  description="Os produtos deste ambiente também serão excluídos."
                  variant="destructive"
                  confirmLabel="Excluir"
                  onConfirm={() => remove(environment)}
                />
              </span>
            )}
          </div>
        ))}
        {environments.length === 0 && (
          <p className="px-2.5 py-1.5 text-xs text-muted-foreground">
            Nenhum ambiente. Crie aqui ou direto ao incluir o produto.
          </p>
        )}
      </div>

      {editing && (
        <EnvironmentDialog environment={editing === 'novo' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
