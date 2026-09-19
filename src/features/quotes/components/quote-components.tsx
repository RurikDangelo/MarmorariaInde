'use client'

import * as React from 'react'
import { useActionForm } from '@/lib/hooks/use-action-form'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FormSection } from '@/components/shared/form'
import { DimensionInput, MoneyInput } from '@/components/shared/inputs'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { formatArea, formatCurrency, formatDimensions } from '@/lib/utils'
import { approveQuote, createQuote, deleteQuoteItem, saveQuoteItem, updateQuoteStatus } from '@/features/quotes/actions'
import type { QuoteItem } from '@/types/database'

export function NewQuoteDialog({ customers }: { customers: { id: string; name: string }[] }) {
  const [open, setOpen] = React.useState(false)
  const [state, formAction, pending] = useActionForm(createQuote)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Novo orçamento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo orçamento</DialogTitle>
          <DialogDescription>Depois de criar, adicione os itens com medidas e preço.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <FormSection columns={2}>
            <Field label="Cliente" required span="full" error={state.fieldErrors?.customer_id}>
              <Select name="customer_id" required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Data">
              <Input name="issue_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </Field>

            <Field label="Validade até">
              <Input name="valid_until" type="date" />
            </Field>

            <Field label="Observações" span="full">
              <Textarea name="notes" rows={2} />
            </Field>
          </FormSection>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Criar orçamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function QuoteItemsEditor({
  quoteId,
  items,
  materials,
  canEdit,
}: {
  quoteId: string
  items: QuoteItem[]
  materials: { id: string; name: string; price_per_m2: number | null }[]
  canEdit: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [, formAction, pending] = useActionForm(saveQuoteItem, {
    onSuccess: () => {
      setOpen(false)
      router.refresh()
    },
  })
  const [unitPrice, setUnitPrice] = React.useState(0)
  const router = useRouter()

  const total = items.reduce((sum, item) => sum + Number(item.total_price ?? 0), 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Itens do orçamento</h2>
        {canEdit && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus />
            Adicionar item
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum item no orçamento ainda.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.description}</p>
                <p className="text-xs text-muted-foreground">
                  {item.environment ? `${item.environment} · ` : ''}
                  {formatDimensions(item.length_mm, item.width_mm)} · {formatArea(item.area_m2)}
                  {item.finish ? ` · ${item.finish}` : ''}
                </p>
              </div>
              <span className="text-sm font-medium tabular">{formatCurrency(item.total_price)}</span>
              {canEdit && (
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label="Remover item">
                      <Trash2 className="text-destructive" />
                    </Button>
                  }
                  title="Remover item"
                  variant="destructive"
                  confirmLabel="Remover"
                  onConfirm={async () => {
                    const result = await deleteQuoteItem(item.id, quoteId)
                    if (result.error) toast.error(result.error)
                    else {
                      toast.success(result.success ?? 'Removido.')
                      router.refresh()
                    }
                  }}
                />
              )}
            </li>
          ))}
          <li className="flex items-center justify-between px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">Total dos itens</span>
            <span className="font-semibold tabular">{formatCurrency(total)}</span>
          </li>
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo item</DialogTitle>
          </DialogHeader>
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="quote_id" value={quoteId} />
            <FormSection columns={3}>
              <Field label="Descrição" required span="full">
                <Input name="description" required autoFocus />
              </Field>
              <Field label="Ambiente">
                <Input name="environment" />
              </Field>
              <Field label="Material">
                <Select
                  name="material_id"
                  defaultValue="NENHUM"
                  onValueChange={(value) => {
                    const material = materials.find((option) => option.id === value)
                    if (material?.price_per_m2) setUnitPrice(Number(material.price_per_m2))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NENHUM">Sem material</SelectItem>
                    {materials.map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Espessura (mm)">
                <Input name="thickness_mm" type="number" min={0} />
              </Field>
              <Field label="Comprimento">
                <DimensionInput name="length_mm" />
              </Field>
              <Field label="Largura">
                <DimensionInput name="width_mm" />
              </Field>
              <Field label="Quantidade">
                <Input name="quantity" type="number" min={1} step="0.01" defaultValue={1} />
              </Field>
              <Field label="Cobrança por">
                <Select name="pricing_mode" defaultValue="M2">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M2">Metro quadrado</SelectItem>
                    <SelectItem value="ML">Metro linear</SelectItem>
                    <SelectItem value="UN">Unidade</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Preço unitário">
                <MoneyInput name="unit_price" value={unitPrice} onValueChange={setUnitPrice} />
              </Field>
              <Field label="Acabamento">
                <Input name="finish" />
              </Field>
              <Field label="Borda">
                <Input name="edge" />
              </Field>
            </FormSection>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={pending}>
                Adicionar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function QuoteActions({
  quoteId,
  status,
  canApprove,
  canWrite,
}: {
  quoteId: string
  status: string
  canApprove: boolean
  canWrite: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [deadline, setDeadline] = React.useState('')
  const [open, setOpen] = React.useState(false)

  const closed = status === 'APROVADO' || status === 'CANCELADO' || status === 'RECUSADO'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canWrite && status === 'RASCUNHO' && (
        <Button
          variant="outline"
          size="sm"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateQuoteStatus(quoteId, 'ENVIADO')
              if (result.error) toast.error(result.error)
              else {
                toast.success('Orçamento marcado como enviado.')
                router.refresh()
              }
            })
          }
        >
          Marcar como enviado
        </Button>
      )}

      {canApprove && !closed && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <CheckCircle2 />
              Aprovar e gerar OS
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aprovar orçamento</DialogTitle>
              <DialogDescription>
                Os itens do orçamento viram as peças da nova ordem de serviço.
              </DialogDescription>
            </DialogHeader>
            <Field label="Prazo de entrega (opcional)">
              <Input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                loading={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await approveQuote(quoteId, deadline || undefined)
                    if (result.error) toast.error(result.error)
                    else {
                      toast.success(result.success ?? 'OS criada.')
                      if (result.workOrderId) router.push(`/os/${result.workOrderId}`)
                    }
                  })
                }
              >
                Aprovar e gerar OS
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {canWrite && !closed && (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive/10"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateQuoteStatus(quoteId, 'RECUSADO')
              if (result.error) toast.error(result.error)
              else {
                toast.success('Orçamento marcado como recusado.')
                router.refresh()
              }
            })
          }
        >
          Recusar
        </Button>
      )}
    </div>
  )
}
