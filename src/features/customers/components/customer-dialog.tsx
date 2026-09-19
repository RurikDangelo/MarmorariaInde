'use client'

import * as React from 'react'
import { useActionForm } from '@/lib/hooks/use-action-form'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FormSection } from '@/components/shared/form'
import { DocumentInput, PhoneInput, ZipCodeInput } from '@/components/shared/inputs'
import { saveCustomer } from '@/features/customers/actions'
import type { Customer } from '@/types/database'

export function CustomerDialog({
  customer,
  trigger,
  openByDefault,
}: {
  customer?: Customer
  trigger?: React.ReactNode
  openByDefault?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = React.useState(!!openByDefault)
  const [state, formAction, pending] = useActionForm(saveCustomer, {
    onSuccess: () => {
      setOpen(false)
      router.refresh()
    },
  })

  function handleOpenChange(value: boolean) {
    setOpen(value)
    if (!value && searchParams.get('novo')) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('novo')
      router.replace(`/clientes?${params.toString()}`, { scroll: false })
    }
  }

  const error = (field: string) => state.fieldErrors?.[field]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus />
            Novo cliente
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{customer ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-5">
          {customer && <input type="hidden" name="id" value={customer.id} />}

          <FormSection columns={2}>
            <Field label="Nome" required span="full" error={error('name')}>
              <Input name="name" defaultValue={customer?.name ?? ''} required autoFocus />
            </Field>

            <Field label="Tipo">
              <Select name="person_type" defaultValue={customer?.person_type ?? 'PF'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PF">Pessoa física</SelectItem>
                  <SelectItem value="PJ">Pessoa jurídica</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="CPF / CNPJ">
              <DocumentInput name="document" defaultValue={customer?.document ?? ''} />
            </Field>

            <Field label="Telefone">
              <PhoneInput name="phone" defaultValue={customer?.phone ?? ''} />
            </Field>

            <Field label="WhatsApp">
              <PhoneInput name="whatsapp" defaultValue={customer?.whatsapp ?? ''} />
            </Field>

            <Field label="E-mail" span="full" error={error('email')}>
              <Input name="email" type="email" defaultValue={customer?.email ?? ''} />
            </Field>
          </FormSection>

          <FormSection title="Endereço" columns={3}>
            <Field label="CEP">
              <ZipCodeInput name="zip_code" defaultValue={customer?.zip_code ?? ''} />
            </Field>
            <Field label="Endereço" className="sm:col-span-2">
              <Input name="address" defaultValue={customer?.address ?? ''} />
            </Field>
            <Field label="Número">
              <Input name="address_number" defaultValue={customer?.address_number ?? ''} />
            </Field>
            <Field label="Complemento">
              <Input name="complement" defaultValue={customer?.complement ?? ''} />
            </Field>
            <Field label="Bairro">
              <Input name="district" defaultValue={customer?.district ?? ''} />
            </Field>
            <Field label="Cidade">
              <Input name="city" defaultValue={customer?.city ?? 'São José dos Campos'} />
            </Field>
            <Field label="UF">
              <Input name="state" defaultValue={customer?.state ?? 'SP'} maxLength={2} />
            </Field>
          </FormSection>

          <Field label="Observações">
            <Textarea name="notes" rows={2} defaultValue={customer?.notes ?? ''} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Salvar cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
