'use client'

import * as React from 'react'
import { ChevronDown, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/shared/form'
import { cn, maskZipCode } from '@/lib/utils'
import type { WorkOrderHeaderDraft } from './header-draft'

function Section({
  title,
  summary,
  defaultOpen,
  children,
}: {
  title: string
  summary?: string
  defaultOpen: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <section className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="text-sm font-medium">{title}</span>
          {!open && summary && <span className="ml-2 truncate text-xs text-muted-foreground">{summary}</span>}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t px-3 py-3">{children}</div>}
    </section>
  )
}

/** Dados da Obra (endereco de execucao, agenda) e observacoes — recolhiveis para a tela ficar limpa. */
export function WorkOrderSiteFields({
  draft,
  onChange,
  readOnly,
}: {
  draft: WorkOrderHeaderDraft
  onChange: (patch: Partial<WorkOrderHeaderDraft>) => void
  readOnly: boolean
}) {
  const address = [draft.address, draft.address_number, draft.district, draft.city].filter(Boolean).join(', ')
  const text = (key: keyof WorkOrderHeaderDraft) => ({
    value: String(draft[key] ?? ''),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ [key]: event.target.value }),
    disabled: readOnly,
  })

  function copyCustomerAddress() {
    const customer = draft.customer
    if (!customer) return
    onChange({
      zip_code: customer.zip_code ?? '',
      address: customer.address ?? '',
      address_number: customer.address_number ?? '',
      complement: customer.complement ?? '',
      district: customer.district ?? '',
      city: customer.city ?? '',
      state: customer.state ?? '',
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <Section title="Dados da Obra" summary={address || draft.site_details} defaultOpen={!address && !draft.site_details}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Dados da Obra" hint="Contato na obra, portaria, andar, observações de acesso" className="sm:col-span-2 lg:col-span-6">
            <Textarea rows={2} maxLength={2000} {...text('site_details')} />
          </Field>
          <Field label="CEP">
            <Input
              inputMode="numeric"
              value={draft.zip_code}
              onChange={(event) => onChange({ zip_code: maskZipCode(event.target.value) })}
              disabled={readOnly}
            />
          </Field>
          <Field label="Endereço" className="sm:col-span-2 lg:col-span-3">
            <Input {...text('address')} />
          </Field>
          <Field label="Número">
            <Input {...text('address_number')} />
          </Field>
          <Field label="Complemento">
            <Input {...text('complement')} />
          </Field>
          <Field label="Bairro" className="lg:col-span-2">
            <Input {...text('district')} />
          </Field>
          <Field label="Cidade" className="lg:col-span-2">
            <Input {...text('city')} />
          </Field>
          <Field label="UF">
            <Input maxLength={2} {...text('state')} />
          </Field>
          <Field label="Medição agendada" className="lg:col-span-2">
            <Input type="datetime-local" {...text('scheduled_measurement_at')} />
          </Field>
          <Field label="Instalação prevista" className="lg:col-span-2">
            <Input type="datetime-local" {...text('scheduled_install_at')} />
          </Field>
          {!readOnly && draft.customer && (
            <div className="flex items-end lg:col-span-2">
              <Button type="button" variant="outline" size="sm" onClick={copyCustomerAddress}>
                <MapPin />
                Usar endereço do cliente
              </Button>
            </div>
          )}
        </div>
      </Section>

      <Section title="Observações" summary={draft.notes} defaultOpen={false}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Observações (saem na OS impressa)">
            <Textarea rows={3} maxLength={4000} {...text('notes')} />
          </Field>
          <Field label="Observações internas" hint="Não saem em documentos para o cliente">
            <Textarea rows={3} maxLength={4000} {...text('internal_notes')} />
          </Field>
        </div>
      </Section>
    </div>
  )
}
