'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FormSection } from '@/components/shared/form'
import { MoneyInput } from '@/components/shared/inputs'
import { PRODUCT_KINDS, UNITS } from '@/lib/labels'
import { saveProduct } from '@/features/catalog/actions'
import type { Product, ProductKind, UnitCode } from '@/types/database'

const KIND_HINTS: Record<ProductKind, string> = {
  PRODUTO: 'O que se vende: pia, bancada, soleira, lavatório. O valor sai da montagem.',
  ACABAMENTO: 'Cobrado normalmente por metro linear (MT): 45°, boleado, reto simples.',
  SERVICO: 'Furo de cuba, furo de cooktop, instalação, frete de montagem.',
  REVENDA: 'Produto comprado pronto e revendido: cuba inox, torneira, válvula.',
  INSUMO: 'Custo interno (cola, silicone). Não compõe o total do cliente.',
}

/**
 * Cadastro de produto/servico. Usado na tela de Cadastros e, em modo rapido,
 * dentro da montagem da OS (ja volta selecionado).
 */
export function ProductDialog({
  open,
  onOpenChange,
  kind: fixedKind,
  product,
  defaultName,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Tipo fixo (cadastro rapido de um acabamento, por exemplo). */
  kind?: ProductKind
  product?: Product
  defaultName?: string
  onSaved?: (product: Product) => void
}) {
  const initialKind = product?.kind ?? fixedKind ?? 'SERVICO'
  const [kind, setKind] = React.useState<ProductKind>(initialKind)
  const [name, setName] = React.useState(product?.name ?? defaultName ?? '')
  const [code, setCode] = React.useState(product?.code ?? '')
  const [unit, setUnit] = React.useState<UnitCode>(
    product?.unit ?? PRODUCT_KINDS.find((option) => option.value === initialKind)?.defaultUnit ?? 'UN',
  )
  const [price, setPrice] = React.useState(Number(product?.price ?? 0))
  const [cost, setCost] = React.useState(Number(product?.cost ?? 0))
  const [description, setDescription] = React.useState(product?.description ?? '')
  const [pending, startTransition] = React.useTransition()

  function changeKind(next: ProductKind) {
    setKind(next)
    if (!product) setUnit(PRODUCT_KINDS.find((option) => option.value === next)?.defaultUnit ?? 'UN')
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await saveProduct({
        id: product?.id ?? null,
        kind,
        code,
        name,
        unit,
        price,
        cost: kind === 'INSUMO' || cost > 0 ? cost : null,
        description,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message)
      onSaved?.(result.data)
      onOpenChange(false)
    })
  }

  const kindLabel = PRODUCT_KINDS.find((option) => option.value === kind)?.label ?? 'Cadastro'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{product ? `Editar ${kindLabel.toLowerCase()}` : `Novo ${kindLabel.toLowerCase()}`}</DialogTitle>
          <DialogDescription>{KIND_HINTS[kind]}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <FormSection columns={2}>
            {!fixedKind && (
              <Field label="Tipo" span="full">
                <Select value={kind} onValueChange={(value) => changeKind(value as ProductKind)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_KINDS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Descrição" required span="full">
              <Input value={name} onChange={(event) => setName(event.target.value)} required autoFocus maxLength={200} />
            </Field>
            <Field label="Código" hint="Vazio = próximo número">
              <Input value={code} onChange={(event) => setCode(event.target.value)} maxLength={40} />
            </Field>
            <Field label="Unidade">
              <Select value={unit} onValueChange={(value) => setUnit(value as UnitCode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.long}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {kind !== 'INSUMO' && (
              <Field label={kind === 'PRODUTO' ? 'Valor fixo (opcional)' : 'Valor de venda'}>
                <MoneyInput value={price} onValueChange={setPrice} />
              </Field>
            )}
            <Field label="Custo" hint={kind === 'INSUMO' ? 'Entra no custo do item' : 'Opcional, para margem'}>
              <MoneyInput value={cost} onValueChange={setCost} />
            </Field>
            <Field label="Observações" span="full">
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
            </Field>
          </FormSection>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
