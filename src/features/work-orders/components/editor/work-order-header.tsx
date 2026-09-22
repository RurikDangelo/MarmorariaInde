'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field } from '@/components/shared/form'
import { CustomerPicker } from '@/features/customers/components/customer-picker'
import { LookupCombobox } from '@/features/catalog/components/lookup-combobox'
import { PaymentTypeToggle } from '@/features/composition/components/payment-type-toggle'
import { useDocument } from '@/features/composition/components/document-context'
import { addDays, todayIso } from '@/features/composition/installments'
import { formatDate } from '@/lib/utils'
import type { Priority } from '@/types/database'
import type { WorkOrderHeaderDraft } from './header-draft'
import { WorkOrderSiteFields } from './work-order-site-fields'

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
]

export interface PersonOption {
  id: string
  full_name: string
}

/** Cabecalho da OS: cliente, vendedor, prazos e pagamento — na mesma tela da montagem. */
export function WorkOrderHeader({
  draft,
  onChange,
  users,
  teams,
  number,
  createdAt,
  canCreateCustomer,
  showErrors,
}: {
  draft: WorkOrderHeaderDraft
  onChange: (patch: Partial<WorkOrderHeaderDraft>) => void
  users: PersonOption[]
  teams: { id: string; name: string }[]
  number: string | null
  createdAt: string | null
  canCreateCustomer: boolean
  showErrors: boolean
}) {
  const { canEdit, catalog, addLookup, canAddToLists } = useDocument()
  const [deliveryTerm, setDeliveryTerm] = React.useState('')
  const readOnly = !canEdit

  const personSelect = (value: string | null, key: 'seller_id' | 'assigned_to', empty: string) => (
    <Select value={value ?? 'NENHUM'} onValueChange={(next) => onChange({ [key]: next === 'NENHUM' ? null : next })} disabled={readOnly}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="NENHUM">{empty}</SelectItem>
        {users.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            {user.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle>Dados da OS</CardTitle>
        <p className="text-xs text-muted-foreground">
          {number ? `Nº ${number}` : 'Nova OS — o número sai ao gravar'}
          {' · '}Emissão {formatDate(createdAt ?? todayIso() + 'T12:00:00')}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Cliente" required className="sm:col-span-2" error={showErrors && !draft.customer ? 'Escolha o cliente' : undefined}>
            <CustomerPicker
              value={draft.customer}
              canCreate={canCreateCustomer}
              disabled={readOnly}
              invalid={showErrors && !draft.customer}
              onChange={(customer) => {
                const patch: Partial<WorkOrderHeaderDraft> = { customer }
                // primeira escolha: a obra e no endereco do cliente, ate alguem mudar
                if (!draft.address && !draft.zip_code) {
                  Object.assign(patch, {
                    zip_code: customer.zip_code ?? '',
                    address: customer.address ?? '',
                    address_number: customer.address_number ?? '',
                    complement: customer.complement ?? '',
                    district: customer.district ?? '',
                    city: customer.city ?? '',
                    state: customer.state ?? '',
                  })
                }
                onChange(patch)
              }}
            />
          </Field>
          <Field label="Vendedor">{personSelect(draft.seller_id, 'seller_id', 'Sem vendedor')}</Field>
          <Field label="Prioridade">
            <Select value={draft.priority} onValueChange={(priority) => onChange({ priority: priority as Priority })} disabled={readOnly}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Serviço" hint="Ex.: Cozinha e banheiros em granito preto" className="sm:col-span-2">
            <Input value={draft.title} onChange={(event) => onChange({ title: event.target.value })} maxLength={120} disabled={readOnly} />
          </Field>
          <Field label="Previsão de Entrega">
            <LookupCombobox
              list="PREVISAO_ENTREGA"
              options={catalog.lookups.filter((option) => option.list === 'PREVISAO_ENTREGA')}
              value={deliveryTerm}
              onSelect={(label, option) => {
                setDeliveryTerm(label)
                if (option?.days != null) onChange({ deadline: addDays(todayIso(), option.days, option.business_days) })
              }}
              onCreated={addLookup}
              placeholder="20 dias úteis…"
              canAddToList={canAddToLists}
              disabled={readOnly}
            />
          </Field>
          <Field label="Prazo de entrega">
            <Input type="date" value={draft.deadline} onChange={(event) => onChange({ deadline: event.target.value })} disabled={readOnly} />
          </Field>

          <Field label="Tipo de Pagamento">
            <PaymentTypeToggle value={draft.payment_type} onChange={(payment_type) => onChange({ payment_type })} disabled={readOnly} />
          </Field>
          <Field label="Responsável">{personSelect(draft.assigned_to, 'assigned_to', 'Sem responsável')}</Field>
          <Field label="Equipe">
            <Select value={draft.team_id ?? 'NENHUM'} onValueChange={(team) => onChange({ team_id: team === 'NENHUM' ? null : team })} disabled={readOnly}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NENHUM">Sem equipe</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <WorkOrderSiteFields draft={draft} onChange={onChange} readOnly={readOnly} />
      </CardContent>
    </Card>
  )
}
