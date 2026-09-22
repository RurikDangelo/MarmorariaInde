'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FormSection } from '@/components/shared/form'
import { MoneyInput } from '@/components/shared/inputs'
import { DecimalField } from '@/components/shared/number-fields'
import { formatCurrency, maskPhone } from '@/lib/utils'
import { saveTechnicalReserve } from '../finance-actions'
import { useDocument } from './document-context'
import type { TechnicalReserve } from '@/types/database'

export function TechnicalReserveDialog({
  reserve,
  documentTotal,
  onClose,
}: {
  reserve: TechnicalReserve | null
  documentTotal: number
  onClose: () => void
}) {
  const { ensureDocument, refresh } = useDocument()
  const [name, setName] = React.useState(reserve?.professional_name ?? '')
  const [phone, setPhone] = React.useState(reserve?.professional_phone ?? '')
  const [document, setDocument] = React.useState(reserve?.professional_document ?? '')
  const [pix, setPix] = React.useState(reserve?.pix_key ?? '')
  const [percentage, setPercentage] = React.useState<number | null>(reserve?.percentage ?? 10)
  const [amount, setAmount] = React.useState(Number(reserve?.amount ?? 0))
  const [notes, setNotes] = React.useState(reserve?.notes ?? '')
  const [pending, startTransition] = React.useTransition()
  const preview = percentage !== null ? Math.round(documentTotal * percentage) / 100 : amount

  function submit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const doc = await ensureDocument()
      if (!doc) return
      const result = await saveTechnicalReserve(doc, {
        id: reserve?.id ?? null,
        professional_name: name,
        professional_phone: phone,
        professional_document: document,
        pix_key: pix,
        percentage,
        amount: percentage !== null ? 0 : amount,
        notes,
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
          <DialogTitle>{reserve ? 'Editar RT' : 'Nova RT'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FormSection columns={2}>
            <Field label="Profissional (arquiteto, designer)" required span="full">
              <Input value={name} onChange={(event) => setName(event.target.value)} required autoFocus maxLength={120} />
            </Field>
            <Field label="Telefone">
              <Input
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(maskPhone(event.target.value))}
                placeholder="(12) 98888-8888"
              />
            </Field>
            <Field label="CPF / CNPJ">
              <Input value={document} onChange={(event) => setDocument(event.target.value)} maxLength={30} />
            </Field>
            <Field label="Chave PIX" span="full">
              <Input value={pix} onChange={(event) => setPix(event.target.value)} maxLength={120} />
            </Field>
            <Field label="Percentual sobre o total" hint="Vazio = valor fixo">
              <DecimalField
                value={percentage}
                onValueChange={(value) => setPercentage(Number.isFinite(value) && value > 0 ? value : null)}
                suffix="%"
              />
            </Field>
            <Field label={percentage !== null ? 'Valor (calculado)' : 'Valor fixo'}>
              {percentage !== null ? (
                <p className="flex h-9 items-center text-sm font-medium tabular">{formatCurrency(preview)}</p>
              ) : (
                <MoneyInput value={amount} onValueChange={setAmount} />
              )}
            </Field>
            <Field label="Observações" span="full">
              <Input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />
            </Field>
          </FormSection>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Salvar RT
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
