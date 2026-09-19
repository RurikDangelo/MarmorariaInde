'use client'

import * as React from 'react'
import { useActionForm } from '@/lib/hooks/use-action-form'
import { CheckCircle2, Import, Plus, Ruler, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FormSection } from '@/components/shared/form'
import { DimensionInput } from '@/components/shared/inputs'
import { EmptyState } from '@/components/shared/states'
import { GenericStatusBadge } from '@/components/shared/status-badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { formatArea, formatDateTime, formatDimensions } from '@/lib/utils'
import {
  approveMeasurement,
  deleteMeasurementItem,
  importMeasurementItems,
  saveMeasurement,
  saveMeasurementItem,
} from '@/features/measurements/actions'
import type { Measurement, WorkOrder } from '@/types/database'

const CHECKLIST: { name: string; label: string }[] = [
  { name: 'check_measures', label: 'Conferiu as medidas' },
  { name: 'check_square', label: 'Conferiu o esquadro' },
  { name: 'check_level', label: 'Conferiu o nível' },
  { name: 'check_wall', label: 'Conferiu a parede' },
  { name: 'check_sink', label: 'Conferiu a cuba' },
  { name: 'check_cooktop', label: 'Conferiu o cooktop' },
  { name: 'check_faucet', label: 'Conferiu a torneira' },
  { name: 'check_outlets', label: 'Conferiu as tomadas' },
  { name: 'check_hydraulics', label: 'Conferiu a hidráulica' },
  { name: 'check_photos', label: 'Fotos registradas' },
  { name: 'customer_present', label: 'Cliente/responsável acompanhou' },
]

export function MeasurementPanel({
  workOrder,
  measurements,
  users,
  canWrite,
  canWriteWorkOrder,
}: {
  workOrder: WorkOrder
  measurements: Measurement[]
  users: { id: string; full_name: string }[]
  canWrite: boolean
  canWriteWorkOrder: boolean
}) {
  const current = measurements[0]

  if (!current) {
    return (
      <EmptyState
        icon={Ruler}
        title="Nenhuma medição registrada"
        description="Registre a medição feita em campo com o checklist de conferência."
        action={
          canWrite ? (
            <MeasurementDialog workOrder={workOrder} users={users} trigger={<Button size="sm"><Plus />Registrar medição</Button>} />
          ) : undefined
        }
      />
    )
  }

  const checked = CHECKLIST.filter((entry) => (current as unknown as Record<string, boolean>)[entry.name]).length

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              Medição
              <GenericStatusBadge status={current.status} />
              {current.revision > 1 && (
                <span className="text-xs font-normal text-muted-foreground">rev. {current.revision}</span>
              )}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {current.responsible?.full_name ?? 'Sem responsável'}
              {current.measured_at ? ` · medida em ${formatDateTime(current.measured_at)}` : ''}
              {!current.measured_at && current.scheduled_at
                ? ` · agendada para ${formatDateTime(current.scheduled_at)}`
                : ''}
            </p>
          </div>
          {canWrite && (
            <MeasurementDialog
              workOrder={workOrder}
              users={users}
              measurement={current}
              trigger={<Button variant="outline" size="sm">Editar</Button>}
            />
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Checklist de conferência</span>
              <span className="tabular">
                {checked}/{CHECKLIST.length}
              </span>
            </div>
            <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {CHECKLIST.map((entry) => {
                const done = (current as unknown as Record<string, boolean>)[entry.name]
                return (
                  <li
                    key={entry.name}
                    className={`flex items-center gap-2 text-sm ${done ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    <CheckCircle2 className={`size-4 shrink-0 ${done ? 'text-success' : 'opacity-30'}`} />
                    {entry.label}
                  </li>
                )
              })}
            </ul>
          </div>

          {(current.obstacles || current.hydraulics_notes || current.electrical_notes || current.wall_notes || current.notes) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <NoteBlock label="Obstáculos" value={current.obstacles} />
              <NoteBlock label="Hidráulica" value={current.hydraulics_notes} />
              <NoteBlock label="Elétrica" value={current.electrical_notes} />
              <NoteBlock label="Parede" value={current.wall_notes} />
              <NoteBlock label="Observações" value={current.notes} />
            </div>
          )}

          {canWrite && !current.approved && (
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <ConfirmDialog
                trigger={
                  <Button size="sm">
                    <CheckCircle2 />
                    Aprovar medição
                  </Button>
                }
                title="Aprovar medição"
                description="A medição aprovada libera a OS para planejamento e produção."
                confirmLabel="Aprovar"
                onConfirm={async () => {
                  const result = await approveMeasurement(current.id, workOrder.id)
                  if (result.error) toast.error(result.error)
                  else toast.success(result.success ?? 'Medição aprovada.')
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <MeasurementItems
        measurement={current}
        workOrderId={workOrder.id}
        canWrite={canWrite}
        canImport={canWriteWorkOrder}
      />
    </div>
  )
}

function NoteBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="rounded-md bg-secondary/50 px-3 py-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  )
}

function MeasurementItems({
  measurement,
  workOrderId,
  canWrite,
  canImport,
}: {
  measurement: Measurement
  workOrderId: string
  canWrite: boolean
  canImport: boolean
}) {
  const [, formAction, pending] = useActionForm(saveMeasurementItem, { onSuccess: () => setOpen(false) })
  const [open, setOpen] = React.useState(false)
  const items = measurement.items ?? []

  const totalArea = items.reduce((sum, item) => sum + Number(item.area_m2 ?? 0), 0)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Medidas tiradas em campo</CardTitle>
        <div className="flex gap-2">
          {canImport && items.length > 0 && (
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm">
                  <Import />
                  Gerar peças da OS
                </Button>
              }
              title="Importar medidas para as peças"
              description={`${items.length} medida(s) serão adicionadas como peças da OS. Você poderá ajustar preço e acabamento depois.`}
              confirmLabel="Importar"
              onConfirm={async () => {
                const result = await importMeasurementItems(measurement.id, workOrderId)
                if (result.error) toast.error(result.error)
                else toast.success(result.success ?? 'Importado.')
              }}
            />
          )}
          {canWrite && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus />
                  Medida
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova medida</DialogTitle>
                </DialogHeader>
                <form action={formAction} className="flex flex-col gap-4">
                  <input type="hidden" name="measurement_id" value={measurement.id} />
                  <input type="hidden" name="work_order_id" value={workOrderId} />
                  <FormSection columns={2}>
                    <Field label="Descrição" required span="full">
                      <Input name="description" required placeholder="Ex.: Bancada da pia" autoFocus />
                    </Field>
                    <Field label="Ambiente">
                      <Input name="environment" placeholder="Cozinha" />
                    </Field>
                    <Field label="Quantidade">
                      <Input name="quantity" type="number" min={1} step="0.01" defaultValue={1} />
                    </Field>
                    <Field label="Comprimento">
                      <DimensionInput name="length_mm" />
                    </Field>
                    <Field label="Largura">
                      <DimensionInput name="width_mm" />
                    </Field>
                    <Field label="Espessura (mm)">
                      <Input name="thickness_mm" type="number" min={0} placeholder="20" />
                    </Field>
                    <Field label="Observação" span="full">
                      <Textarea name="notes" rows={2} />
                    </Field>
                  </FormSection>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" loading={pending}>
                      Salvar medida
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma medida registrada nesta medição.
          </p>
        ) : (
          <>
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.environment ? `${item.environment} · ` : ''}
                      {formatDimensions(item.length_mm, item.width_mm)} · {item.quantity}×
                      {item.thickness_mm ? ` · ${item.thickness_mm}mm` : ''}
                    </p>
                  </div>
                  <span className="tabular text-sm text-muted-foreground">{formatArea(item.area_m2)}</span>
                  {canWrite && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Remover medida">
                          <Trash2 className="text-destructive" />
                        </Button>
                      }
                      title="Remover medida"
                      variant="destructive"
                      confirmLabel="Remover"
                      onConfirm={async () => {
                        const result = await deleteMeasurementItem(item.id, workOrderId)
                        if (result.error) toast.error(result.error)
                        else toast.success(result.success ?? 'Removida.')
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t pt-2.5 text-right text-sm">
              Total medido: <span className="tabular font-semibold">{formatArea(totalArea)}</span>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function MeasurementDialog({
  workOrder,
  users,
  measurement,
  trigger,
}: {
  workOrder: WorkOrder
  users: { id: string; full_name: string }[]
  measurement?: Measurement
  trigger: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [, formAction, pending] = useActionForm(saveMeasurement, { onSuccess: () => setOpen(false) })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{measurement ? 'Editar medição' : 'Registrar medição'}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="work_order_id" value={workOrder.id} />
          {measurement && <input type="hidden" name="id" value={measurement.id} />}

          <FormSection columns={2}>
            <Field label="Responsável">
              <Select name="responsible_id" defaultValue={measurement?.responsible_id ?? 'NENHUM'}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NENHUM">Não definido</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Situação">
              <Select name="status" defaultValue={measurement?.status ?? 'AGENDADA'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                  <SelectItem value="AGENDADA">Agendada</SelectItem>
                  <SelectItem value="REALIZADA">Realizada</SelectItem>
                  <SelectItem value="APROVADA">Aprovada</SelectItem>
                  <SelectItem value="REPROVADA">Reprovada</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Agendada para">
              <Input
                name="scheduled_at"
                type="datetime-local"
                defaultValue={toLocalInput(measurement?.scheduled_at ?? workOrder.scheduled_measurement_at)}
              />
            </Field>

            <Field label="Medida em">
              <Input name="measured_at" type="datetime-local" defaultValue={toLocalInput(measurement?.measured_at)} />
            </Field>

            <Field label="Endereço" span="full">
              <Input name="address" defaultValue={measurement?.address ?? workOrder.address ?? ''} />
            </Field>
            <Field label="Bairro">
              <Input name="district" defaultValue={measurement?.district ?? workOrder.district ?? ''} />
            </Field>
            <Field label="Cidade">
              <Input name="city" defaultValue={measurement?.city ?? workOrder.city ?? ''} />
            </Field>
          </FormSection>

          <FormSection title="Condições do local" columns={2}>
            <Field label="Obstáculos">
              <Textarea name="obstacles" rows={2} defaultValue={measurement?.obstacles ?? ''} />
            </Field>
            <Field label="Hidráulica">
              <Textarea name="hydraulics_notes" rows={2} defaultValue={measurement?.hydraulics_notes ?? ''} />
            </Field>
            <Field label="Elétrica">
              <Textarea name="electrical_notes" rows={2} defaultValue={measurement?.electrical_notes ?? ''} />
            </Field>
            <Field label="Parede / nível">
              <Textarea name="wall_notes" rows={2} defaultValue={measurement?.wall_notes ?? ''} />
            </Field>
            <Field label="Observações gerais" span="full">
              <Textarea name="notes" rows={2} defaultValue={measurement?.notes ?? ''} />
            </Field>
          </FormSection>

          <FormSection title="Checklist" columns={1}>
            <div className="grid gap-2 sm:grid-cols-2">
              {CHECKLIST.map((entry) => (
                <label key={entry.name} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    name={entry.name}
                    defaultChecked={
                      measurement ? !!(measurement as unknown as Record<string, boolean>)[entry.name] : false
                    }
                  />
                  {entry.label}
                </label>
              ))}
            </div>
          </FormSection>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Salvar medição
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function toLocalInput(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
