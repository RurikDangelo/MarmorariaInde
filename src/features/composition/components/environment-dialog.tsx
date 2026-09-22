'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/shared/form'
import { LookupCombobox } from '@/features/catalog/components/lookup-combobox'
import { saveEnvironment } from '../actions'
import { useDocument } from './document-context'
import type { Environment } from '@/types/database'

/** "Cadastro de Ambientes": Item, Nome do Ambiente e Descricao do Ambiente. */
export function EnvironmentDialog({
  environment,
  onClose,
}: {
  environment: Environment | null
  onClose: () => void
}) {
  const { ensureDocument, refresh, environments, catalog, addLookup, canAddToLists } = useDocument()
  const nextNumber = environments.reduce((max, row) => Math.max(max, row.number), 0) + 1
  const [number, setNumber] = React.useState(String(environment?.number ?? nextNumber))
  const [name, setName] = React.useState(environment?.name ?? '')
  const [description, setDescription] = React.useState(environment?.description ?? '')
  const [pending, startTransition] = React.useTransition()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      toast.error('Informe o nome do ambiente.')
      return
    }
    startTransition(async () => {
      const doc = await ensureDocument()
      if (!doc) return
      const result = await saveEnvironment(doc, {
        id: environment?.id ?? null,
        number: Number.parseInt(number, 10) || null,
        name,
        description,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message)
      onClose()
      refresh()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastro de Ambientes</DialogTitle>
          <DialogDescription>Cozinha, banheiro, lavabo… Os produtos são lançados dentro de cada ambiente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-[5rem_1fr] gap-3">
            <Field label="Item">
              <Input value={number} onChange={(event) => setNumber(event.target.value.replace(/\D/g, ''))} inputMode="numeric" />
            </Field>
            <Field label="Nome do Ambiente" required>
              <LookupCombobox
                list="AMBIENTE"
                options={catalog.lookups.filter((option) => option.list === 'AMBIENTE')}
                value={name}
                onSelect={(label) => setName(label)}
                onCreated={addLookup}
                placeholder="Escolha ou digite"
                canAddToList={canAddToLists}
              />
            </Field>
          </div>
          <Field label="Descrição do Ambiente">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={500} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Gravar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
