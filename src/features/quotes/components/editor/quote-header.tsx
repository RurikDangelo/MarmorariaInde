'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field } from '@/components/shared/form'
import { CustomerPicker } from '@/features/customers/components/customer-picker'
import { LookupCombobox } from '@/features/catalog/components/lookup-combobox'
import { PaymentTypeToggle } from '@/features/composition/components/payment-type-toggle'
import { useDocument } from '@/features/composition/components/document-context'
import { addDays } from '@/features/composition/installments'
import type { PersonOption } from '@/features/work-orders/components/editor/work-order-header'
import type { EditableQuoteStatus, QuoteHeaderDraft } from './quote-header-draft'

const STATUSES: { value: EditableQuoteStatus; label: string }[] = [
  { value: 'RASCUNHO', label: 'Rascunho' },
  { value: 'ENVIADO', label: 'Enviado ao cliente' },
  { value: 'RECUSADO', label: 'Recusado' },
  { value: 'EXPIRADO', label: 'Expirado' },
  { value: 'CANCELADO', label: 'Cancelado' },
]

/** Cabecalho do orcamento com os campos da janela "Orcamentos" do sistema antigo. */
export function QuoteHeader({
  draft,
  onChange,
  users,
  number,
  canCreateCustomer,
  showErrors,
}: {
  draft: QuoteHeaderDraft
  onChange: (patch: Partial<QuoteHeaderDraft>) => void
  users: PersonOption[]
  number: string | null
  canCreateCustomer: boolean
  showErrors: boolean
}) {
  const { canEdit, catalog, addLookup, canAddToLists } = useDocument()
  const readOnly = !canEdit
  const lookups = (list: 'VALIDADE' | 'PREVISAO_ENTREGA') => catalog.lookups.filter((option) => option.list === list)
  const validityLabel =
    lookups('VALIDADE').find((option) => option.days === draft.validity_days)?.label ??
    (draft.validity_days != null ? `${draft.validity_days} dias` : '')

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle>Dados do Orçamento</CardTitle>
        <p className="text-xs text-muted-foreground">{number ? `Nº ${number}` : 'Novo orçamento — o número sai ao gravar'}</p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Cliente" required className="sm:col-span-2" error={showErrors && !draft.customer ? 'Escolha o cliente' : undefined}>
          <CustomerPicker
            value={draft.customer}
            onChange={(customer) => onChange({ customer })}
            canCreate={canCreateCustomer}
            disabled={readOnly}
            invalid={showErrors && !draft.customer}
          />
        </Field>
        <Field label="Status do Orçamento">
          <Select value={draft.status} onValueChange={(status) => onChange({ status: status as EditableQuoteStatus })} disabled={readOnly}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Vendedor">
          <Select value={draft.seller_id ?? 'NENHUM'} onValueChange={(value) => onChange({ seller_id: value === 'NENHUM' ? null : value })} disabled={readOnly}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NENHUM">Sem vendedor</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Data Emissão">
          <Input
            type="date"
            value={draft.issue_date}
            onChange={(event) => {
              const issue_date = event.target.value
              onChange({
                issue_date,
                valid_until: draft.validity_days != null && issue_date ? addDays(issue_date, draft.validity_days) : draft.valid_until,
              })
            }}
            disabled={readOnly}
          />
        </Field>
        <Field label="Validade">
          <LookupCombobox
            list="VALIDADE"
            options={lookups('VALIDADE')}
            value={validityLabel}
            onSelect={(_label, option) => {
              if (option?.days == null) return
              onChange({ validity_days: option.days, valid_until: addDays(draft.issue_date, option.days) })
            }}
            onCreated={addLookup}
            placeholder="15 dias…"
            canAddToList={canAddToLists}
            allowFreeText={false}
            disabled={readOnly}
          />
        </Field>
        <Field label="Data Validade">
          <Input type="date" value={draft.valid_until} onChange={(event) => onChange({ valid_until: event.target.value })} disabled={readOnly} />
        </Field>
        <Field label="Tipo de Pagamento">
          <PaymentTypeToggle value={draft.payment_type} onChange={(payment_type) => onChange({ payment_type })} disabled={readOnly} />
        </Field>

        <Field label="Previsão de Entrega" className="sm:col-span-2">
          <LookupCombobox
            list="PREVISAO_ENTREGA"
            options={lookups('PREVISAO_ENTREGA')}
            value={draft.delivery_term}
            onSelect={(label, option) =>
              onChange({
                delivery_term: label,
                delivery_days: option?.days ?? null,
                delivery_date: option?.days != null ? addDays(draft.issue_date, option.days, option.business_days) : draft.delivery_date,
              })
            }
            onCreated={addLookup}
            placeholder="20 dias úteis após a medição…"
            canAddToList={canAddToLists}
            disabled={readOnly}
          />
        </Field>
        <Field label="Previsão Entrega (data)">
          <Input type="date" value={draft.delivery_date} onChange={(event) => onChange({ delivery_date: event.target.value })} disabled={readOnly} />
        </Field>
        <div className="hidden lg:block" />

        <Field label="Dados da Obra" hint="Endereço, contato na obra, acesso" className="sm:col-span-2">
          <Textarea rows={3} value={draft.site_details} onChange={(event) => onChange({ site_details: event.target.value })} maxLength={2000} disabled={readOnly} />
        </Field>
        <Field label="Observações (saem na impressão)" className="sm:col-span-2">
          <Textarea rows={3} value={draft.notes} onChange={(event) => onChange({ notes: event.target.value })} maxLength={4000} disabled={readOnly} />
        </Field>
        <Field label="Observações internas" hint="Não saem para o cliente" className="sm:col-span-2 lg:col-span-4">
          <Input value={draft.internal_notes} onChange={(event) => onChange({ internal_notes: event.target.value })} maxLength={4000} disabled={readOnly} />
        </Field>
      </CardContent>
    </Card>
  )
}
