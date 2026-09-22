'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { COMPONENT_KINDS, PRODUCT_KINDS } from '@/lib/labels'
import { saveLineItem } from '../../actions'
import { useDocument } from '../document-context'
import type { ItemDraft } from '../../types'
import { ComponentsTab } from './components-tab'
import { DrawingTab } from './drawing-tab'
import { ItemHeaderFields } from './item-header-fields'
import { ItemTotalsBar } from './item-totals-bar'
import { MaterialsTab } from './materials-tab'
import { PiecesTab } from './pieces-tab'
import { useItemDraft } from './use-item-draft'

/**
 * "Orcamento | Edicao de Item" do sistema antigo: produto + materiais, pecas,
 * acabamentos, servicos, revendas, insumos e desenho. F2 grava, Esc cancela.
 */
export function ItemEditorDialog({
  initial,
  onClose,
  readOnly,
}: {
  initial: ItemDraft
  onClose: () => void
  readOnly: boolean
}) {
  const { ensureDocument, refresh } = useDocument()
  const { draft, dispatch, dirty } = useItemDraft(initial)
  const [tab, setTab] = React.useState(initial.materials.length ? 'pecas' : 'materiais')
  const [showErrors, setShowErrors] = React.useState(false)
  const [confirmDiscard, setConfirmDiscard] = React.useState(false)
  const [saving, startSaving] = React.useTransition()

  const save = React.useCallback(() => {
    if (readOnly || saving) return
    if (!draft.environment_id || (!draft.description && !draft.product_id)) {
      setShowErrors(true)
      toast.error(!draft.environment_id ? 'Escolha o ambiente do produto.' : 'Informe o produto.')
      return
    }
    startSaving(async () => {
      const doc = await ensureDocument()
      if (!doc) return
      const result = await saveLineItem(doc, draft)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message)
      onClose()
      refresh()
    })
  }, [draft, ensureDocument, onClose, readOnly, refresh, saving])

  function requestClose() {
    if (dirty && !readOnly) setConfirmDiscard(true)
    else onClose()
  }

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'F2') {
        event.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  const count = (kind: string) => draft.components.filter((component) => component.kind === kind).length
  const tabs = [
    { value: 'materiais', label: 'Materiais', count: draft.materials.length },
    { value: 'pecas', label: 'Peças', count: draft.pieces.length },
    ...COMPONENT_KINDS.map((kind) => ({
      value: kind,
      label: PRODUCT_KINDS.find((option) => option.value === kind)?.plural ?? kind,
      count: count(kind),
    })),
    { value: 'desenho', label: 'Desenho', count: draft.drawing_path ? 1 : 0 },
  ]

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && requestClose()}>
        <DialogContent
          className="flex h-[min(94dvh,960px)] max-w-6xl flex-col gap-0 p-0 max-sm:inset-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            event.preventDefault()
            requestClose()
          }}
        >
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>Edição de Item</DialogTitle>
            <DialogDescription>
              {readOnly ? 'Somente leitura.' : 'Medidas em metros (2,45). F2 grava · Esc cancela.'}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <fieldset disabled={readOnly || saving}>
              <ItemHeaderFields
                draft={draft}
                dispatch={dispatch}
                showErrors={showErrors}
                onNeedMaterial={() => setTab('materiais')}
                onPiecesGenerated={() => setTab('pecas')}
              />
            </fieldset>

            <Tabs value={tab} onValueChange={setTab} className="mt-4 flex flex-col gap-3 lg:flex-row">
              <TabsList className="h-fit shrink-0 lg:w-40 lg:flex-col lg:items-stretch">
                {tabs.map((item) => (
                  <TabsTrigger key={item.value} value={item.value} className="justify-between gap-2 lg:w-full">
                    {item.label}
                    {item.count > 0 && <span className="text-xs tabular text-muted-foreground">{item.count}</span>}
                  </TabsTrigger>
                ))}
              </TabsList>
              <fieldset disabled={readOnly || saving} className="min-w-0 flex-1">
                <TabsContent value="materiais" className="mt-0">
                  <MaterialsTab draft={draft} dispatch={dispatch} />
                </TabsContent>
                <TabsContent value="pecas" className="mt-0">
                  <PiecesTab draft={draft} dispatch={dispatch} />
                </TabsContent>
                {COMPONENT_KINDS.map((kind) => (
                  <TabsContent key={kind} value={kind} className="mt-0">
                    <ComponentsTab kind={kind} draft={draft} dispatch={dispatch} />
                  </TabsContent>
                ))}
                <TabsContent value="desenho" className="mt-0">
                  <DrawingTab
                    itemId={draft.id}
                    path={draft.drawing_path}
                    readOnly={readOnly}
                    onChange={(drawing_path) => dispatch({ type: 'item', patch: { drawing_path } })}
                  />
                </TabsContent>
              </fieldset>
            </Tabs>
          </div>

          <div className="flex flex-col gap-3 border-t bg-card px-4 py-3">
            <ItemTotalsBar draft={draft} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={requestClose}>
                Esc | {readOnly ? 'Fechar' : 'Cancelar'}
              </Button>
              {!readOnly && (
                <Button type="button" onClick={save} loading={saving}>
                  F2 | Gravar
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar as alterações?</AlertDialogTitle>
            <AlertDialogDescription>O que você mudou neste produto ainda não foi gravado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onClose}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
