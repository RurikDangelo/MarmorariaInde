'use client'

import { CheckCircle2, CircleDot, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Barra fixa no topo da tela da OS/orcamento: situacao da gravacao, Salvar (F2)
 * e as acoes do documento (Emitir, Aprovar...).
 */
export function EditorActionBar({
  isNew,
  dirty,
  saving,
  canEdit,
  onSave,
  children,
}: {
  isNew: boolean
  dirty: boolean
  saving: boolean
  canEdit: boolean
  onSave: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="no-print sticky top-14 z-20 -mx-4 flex flex-wrap items-center justify-between gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {isNew ? (
          <>
            <CircleDot className="size-3.5 text-warning" />
            Ainda não gravado — escolha o cliente e salve, ou já inclua os produtos
          </>
        ) : dirty ? (
          <>
            <CircleDot className="size-3.5 text-warning" />
            Alterações nos dados ainda não salvas
          </>
        ) : (
          <>
            <CheckCircle2 className="size-3.5 text-success" />
            Tudo gravado
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {canEdit && (
          <Button type="button" size="sm" onClick={onSave} loading={saving} variant={dirty || isNew ? 'default' : 'outline'}>
            <Save />
            Salvar <span className="hidden text-xs opacity-70 sm:inline">F2</span>
          </Button>
        )}
      </div>
    </div>
  )
}
