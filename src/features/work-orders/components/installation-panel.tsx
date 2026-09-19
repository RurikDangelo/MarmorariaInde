'use client'

import * as React from 'react'
import { useActionForm } from '@/lib/hooks/use-action-form'
import { CheckCircle2, MapPin, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FormSection } from '@/components/shared/form'
import { EmptyState } from '@/components/shared/states'
import { GenericStatusBadge } from '@/components/shared/status-badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { formatDateTime } from '@/lib/utils'
import { finishInstallation, saveInstallation } from '@/features/installations/actions'
import type { Installation, WorkOrder } from '@/types/database'

const CHECKLIST = [
  { name: 'check_material', label: 'Material conferido' },
  { name: 'check_pieces', label: 'Peças conferidas' },
  { name: 'check_measures', label: 'Medidas conferidas' },
  { name: 'check_site_ready', label: 'Local preparado' },
  { name: 'check_installed', label: 'Instalação concluída' },
  { name: 'check_finish', label: 'Acabamento conferido' },
  { name: 'check_photos', label: 'Fotos finais' },
  { name: 'customer_present', label: 'Cliente/responsável acompanhou' },
]

export function InstallationPanel({
  workOrder,
  installations,
  teams,
  users,
  canWrite,
}: {
  workOrder: WorkOrder
  installations: Installation[]
  teams: { id: string; name: string }[]
  users: { id: string; full_name: string }[]
  canWrite: boolean
}) {
  const current = installations[0]

  if (!current) {
    return (
      <EmptyState
        icon={MapPin}
        title="Instalação não agendada"
        description="Agende a equipe, a data e registre o checklist de instalação."
        action={
          canWrite ? (
            <InstallationDialog
              workOrder={workOrder}
              teams={teams}
              users={users}
              trigger={
                <Button size="sm">
                  <Plus />
                  Agendar instalação
                </Button>
              }
            />
          ) : undefined
        }
      />
    )
  }

  const checked = CHECKLIST.filter((entry) => (current as unknown as Record<string, boolean>)[entry.name]).length

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            Instalação
            <GenericStatusBadge status={current.status} />
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {current.team?.name ?? 'Sem equipe'}
            {current.scheduled_at ? ` · ${formatDateTime(current.scheduled_at)}` : ''}
            {current.responsible?.full_name ? ` · ${current.responsible.full_name}` : ''}
          </p>
        </div>
        {canWrite && (
          <InstallationDialog
            workOrder={workOrder}
            teams={teams}
            users={users}
            installation={current}
            trigger={<Button variant="outline" size="sm">Editar</Button>}
          />
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {(current.address || workOrder.address) && (
          <p className="text-sm text-muted-foreground">
            <MapPin className="mr-1 inline size-3.5" />
            {current.address ?? workOrder.address}
            {current.address_number ? `, ${current.address_number}` : ''}
            {current.district ? ` · ${current.district}` : ''}
            {current.city ? ` · ${current.city}` : ''}
          </p>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Checklist de instalação</span>
            <span className="tabular">
              {checked}/{CHECKLIST.length}
            </span>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
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

        {current.notes && <p className="rounded-md bg-secondary/50 px-3 py-2 text-sm">{current.notes}</p>}

        {canWrite && current.status !== 'CONCLUIDA' && (
          <div className="border-t pt-3">
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="success">
                  <CheckCircle2 />
                  Concluir instalação e finalizar OS
                </Button>
              }
              title="Concluir instalação"
              description="A OS será marcada como finalizada e as peças como instaladas."
              confirmLabel="Concluir"
              onConfirm={async () => {
                const result = await finishInstallation(current.id, workOrder.id)
                if (result.error) toast.error(result.error)
                else toast.success(result.success ?? 'Instalação concluída.')
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function InstallationDialog({
  workOrder,
  teams,
  users,
  installation,
  trigger,
}: {
  workOrder: WorkOrder
  teams: { id: string; name: string }[]
  users: { id: string; full_name: string }[]
  installation?: Installation
  trigger: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [, formAction, pending] = useActionForm(saveInstallation, { onSuccess: () => setOpen(false) })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{installation ? 'Editar instalação' : 'Agendar instalação'}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="work_order_id" value={workOrder.id} />
          {installation && <input type="hidden" name="id" value={installation.id} />}

          <FormSection columns={2}>
            <Field label="Equipe">
              <Select name="team_id" defaultValue={installation?.team_id ?? workOrder.team_id ?? 'NENHUM'}>
                <SelectTrigger>
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

            <Field label="Responsável">
              <Select name="responsible_id" defaultValue={installation?.responsible_id ?? 'NENHUM'}>
                <SelectTrigger>
                  <SelectValue placeholder="Não definido" />
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

            <Field label="Agendada para">
              <Input
                name="scheduled_at"
                type="datetime-local"
                defaultValue={toLocalInput(installation?.scheduled_at ?? workOrder.scheduled_install_at)}
              />
            </Field>

            <Field label="Situação">
              <Select name="status" defaultValue={installation?.status ?? 'AGENDADA'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AGENDADA">Agendada</SelectItem>
                  <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                  <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                  <SelectItem value="REAGENDADA">Reagendada</SelectItem>
                  <SelectItem value="CANCELADA">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Endereço" span="full">
              <Input name="address" defaultValue={installation?.address ?? workOrder.address ?? ''} />
            </Field>
            <Field label="Número">
              <Input name="address_number" defaultValue={installation?.address_number ?? workOrder.address_number ?? ''} />
            </Field>
            <Field label="Bairro">
              <Input name="district" defaultValue={installation?.district ?? workOrder.district ?? ''} />
            </Field>
            <Field label="Cidade">
              <Input name="city" defaultValue={installation?.city ?? workOrder.city ?? ''} />
            </Field>
            <Field label="Motivo do reagendamento">
              <Input name="reschedule_reason" defaultValue={installation?.reschedule_reason ?? ''} />
            </Field>
          </FormSection>

          <FormSection title="Checklist" columns={1}>
            <div className="grid gap-2 sm:grid-cols-2">
              {CHECKLIST.map((entry) => (
                <label key={entry.name} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    name={entry.name}
                    defaultChecked={
                      installation ? !!(installation as unknown as Record<string, boolean>)[entry.name] : false
                    }
                  />
                  {entry.label}
                </label>
              ))}
            </div>
          </FormSection>

          <Field label="Observações">
            <Textarea name="notes" rows={2} defaultValue={installation?.notes ?? ''} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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

function toLocalInput(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
