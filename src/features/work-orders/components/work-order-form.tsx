'use client'

import * as React from 'react'
import { useActionForm } from '@/lib/hooks/use-action-form'
import Link from 'next/link'
import { AlertCircle, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { Field, FormActions, FormSection } from '@/components/shared/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MoneyInput, ZipCodeInput } from '@/components/shared/inputs'
import { createWorkOrder, updateWorkOrder } from '@/features/work-orders/actions'
import type { WorkOrder, WorkOrderStatus } from '@/types/database'

interface CustomerOption {
  id: string
  name: string
  phone: string | null
  city: string | null
  address: string | null
  address_number: string | null
  district: string | null
  zip_code: string | null
  state: string | null
}

interface WorkOrderFormProps {
  mode: 'create' | 'edit'
  workOrder?: WorkOrder
  customers: CustomerOption[]
  users: { id: string; full_name: string; role: string }[]
  teams: { id: string; name: string; kind: string }[]
  statuses: WorkOrderStatus[]
}

export function WorkOrderForm({ mode, workOrder, customers, users, teams, statuses }: WorkOrderFormProps) {
  const action = mode === 'create' ? createWorkOrder : updateWorkOrder
  const [state, formAction, pending] = useActionForm(action)
  const [customerId, setCustomerId] = React.useState(workOrder?.customer_id ?? '')
  const [address, setAddress] = React.useState({
    zip_code: workOrder?.zip_code ?? '',
    address: workOrder?.address ?? '',
    address_number: workOrder?.address_number ?? '',
    complement: workOrder?.complement ?? '',
    district: workOrder?.district ?? '',
    city: workOrder?.city ?? '',
    state: workOrder?.state ?? '',
  })

  const selectedCustomer = customers.find((customer) => customer.id === customerId)

  function useCustomerAddress() {
    if (!selectedCustomer) {
      toast.error('Selecione o cliente primeiro.')
      return
    }
    setAddress({
      zip_code: selectedCustomer.zip_code ?? '',
      address: selectedCustomer.address ?? '',
      address_number: selectedCustomer.address_number ?? '',
      complement: '',
      district: selectedCustomer.district ?? '',
      city: selectedCustomer.city ?? '',
      state: selectedCustomer.state ?? '',
    })
    toast.success('Endereço do cliente copiado.')
  }

  const error = (field: string) => state.fieldErrors?.[field]

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {workOrder && <input type="hidden" name="id" value={workOrder.id} />}

      <Card>
        <CardContent className="pt-5">
          <FormSection title="Dados da OS" columns={2}>
            <Field label="Cliente" required error={error('customer_id')} htmlFor="customer_id">
              <Select name="customer_id" value={customerId} onValueChange={setCustomerId} required>
                <SelectTrigger id="customer_id">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                      {customer.city ? ` · ${customer.city}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Serviço" hint="Ex.: Bancada de cozinha em granito preto" htmlFor="title">
              <Input id="title" name="title" defaultValue={workOrder?.title ?? ''} maxLength={120} />
            </Field>

            <Field label="Prioridade" htmlFor="priority">
              <Select name="priority" defaultValue={workOrder?.priority ?? 'NORMAL'}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="URGENTE">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {mode === 'edit' && (
              <Field label="Etapa" htmlFor="status_code">
                <Select name="status_code" defaultValue={workOrder?.status_code}>
                  <SelectTrigger id="status_code">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status.code} value={status.code}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field label="Responsável" htmlFor="assigned_to">
              <Select name="assigned_to" defaultValue={workOrder?.assigned_to ?? 'NENHUM'}>
                <SelectTrigger id="assigned_to">
                  <SelectValue placeholder="Sem responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NENHUM">Sem responsável</SelectItem>
                  {users.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Equipe" htmlFor="team_id">
              <Select name="team_id" defaultValue={workOrder?.team_id ?? 'NENHUM'}>
                <SelectTrigger id="team_id">
                  <SelectValue placeholder="Sem equipe" />
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

            <Field label="Prazo de entrega" htmlFor="deadline">
              <Input id="deadline" name="deadline" type="date" defaultValue={workOrder?.deadline ?? ''} />
            </Field>

            <Field label="Desconto" htmlFor="discount" hint="Abatido do total dos itens">
              <MoneyInput id="discount" name="discount" defaultValue={Number(workOrder?.discount ?? 0)} />
            </Field>

            <Field label="Medição agendada para" htmlFor="scheduled_measurement_at">
              <Input
                id="scheduled_measurement_at"
                name="scheduled_measurement_at"
                type="datetime-local"
                defaultValue={toLocalInput(workOrder?.scheduled_measurement_at)}
              />
            </Field>

            <Field label="Instalação prevista para" htmlFor="scheduled_install_at">
              <Input
                id="scheduled_install_at"
                name="scheduled_install_at"
                type="datetime-local"
                defaultValue={toLocalInput(workOrder?.scheduled_install_at)}
              />
            </Field>
          </FormSection>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Local de execução</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Onde a equipe vai medir e instalar. Pode ser diferente do cadastro do cliente.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={useCustomerAddress}>
              <MapPin />
              Usar endereço do cliente
            </Button>
          </div>

          <FormSection columns={3}>
            <Field label="CEP" htmlFor="zip_code">
              <ZipCodeInput
                id="zip_code"
                name="zip_code"
                key={address.zip_code}
                defaultValue={address.zip_code}
              />
            </Field>
            <Field label="Endereço" className="sm:col-span-2" htmlFor="address">
              <Input
                id="address"
                name="address"
                key={address.address}
                defaultValue={address.address}
              />
            </Field>
            <Field label="Número" htmlFor="address_number">
              <Input
                id="address_number"
                name="address_number"
                key={address.address_number}
                defaultValue={address.address_number}
              />
            </Field>
            <Field label="Complemento" htmlFor="complement">
              <Input id="complement" name="complement" defaultValue={address.complement} />
            </Field>
            <Field label="Bairro" htmlFor="district">
              <Input id="district" name="district" key={address.district} defaultValue={address.district} />
            </Field>
            <Field label="Cidade" htmlFor="city">
              <Input id="city" name="city" key={address.city} defaultValue={address.city} />
            </Field>
            <Field label="UF" htmlFor="state">
              <Input id="state" name="state" key={address.state} defaultValue={address.state} maxLength={2} />
            </Field>
          </FormSection>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <FormSection title="Observações" columns={1}>
            <Field label="Observações (visíveis na OS impressa)" htmlFor="notes">
              <Textarea id="notes" name="notes" rows={3} defaultValue={workOrder?.notes ?? ''} />
            </Field>
            <Field label="Observações internas" hint="Não saem em documentos para o cliente" htmlFor="internal_notes">
              <Textarea
                id="internal_notes"
                name="internal_notes"
                rows={3}
                defaultValue={workOrder?.internal_notes ?? ''}
              />
            </Field>
          </FormSection>
        </CardContent>
      </Card>

      {state.error && (
        <p role="alert" className="flex items-center gap-2 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <FormActions sticky>
        <Button type="button" variant="outline" asChild>
          <Link href={workOrder ? `/os/${workOrder.id}` : '/os'}>Cancelar</Link>
        </Button>
        <Button type="submit" loading={pending}>
          {mode === 'create' ? 'Criar ordem de serviço' : 'Salvar alterações'}
        </Button>
      </FormActions>
    </form>
  )
}

/** ISO -> valor aceito por <input type="datetime-local"> */
function toLocalInput(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
