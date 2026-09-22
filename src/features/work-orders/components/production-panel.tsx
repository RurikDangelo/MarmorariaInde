'use client'

import * as React from 'react'
import { useActionForm } from '@/lib/hooks/use-action-form'
import { CheckCircle2, Pause, Play, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FormSection } from '@/components/shared/form'
import { GenericStatusBadge } from '@/components/shared/status-badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { formatDateTime } from '@/lib/utils'
import {
  deleteProductionRecord,
  startProductionStep,
  updateProductionStatus,
} from '@/features/production/actions'
import type { ActionState } from '@/features/work-orders/schema'
import type { ProductionRecord, ProductionStep } from '@/types/database'

/** Peca da montagem para apontar a producao (ex.: Cozinha · Pia e Balcao · Peca 3 - Saia). */
export interface PieceOption {
  id: string
  label: string
}

export function ProductionPanel({
  workOrderId,
  records,
  steps,
  pieces,
  users,
  canWrite,
}: {
  workOrderId: string
  records: ProductionRecord[]
  steps: ProductionStep[]
  pieces: PieceOption[]
  users: { id: string; full_name: string }[]
  canWrite: boolean
}) {
  const done = records.filter((record) => record.status === 'CONCLUIDO').length
  const rework = records.filter((record) => record.is_rework).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Apontamento de produção</h2>
          <p className="text-xs text-muted-foreground">
            {records.length} apontamento(s) · {done} concluído(s)
            {rework > 0 ? ` · ${rework} retrabalho(s)` : ''}
          </p>
        </div>
        {canWrite && (
          <StartStepDialog workOrderId={workOrderId} steps={steps} pieces={pieces} users={users} />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {steps.map((step) => {
          const stepRecords = records.filter((record) => record.step_code === step.code)
          const last = stepRecords[stepRecords.length - 1]

          return (
            <Card key={step.code} className={last?.status === 'CONCLUIDO' ? 'border-success/35' : undefined}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-sm">
                  {step.label}
                  {last ? <GenericStatusBadge status={last.status} /> : <span className="text-xs font-normal text-muted-foreground">não iniciada</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {stepRecords.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem apontamento nesta etapa.</p>
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {stepRecords.map((record) => (
                      <li key={record.id} className="text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">
                            {record.responsible?.full_name ?? 'Sem responsável'}
                          </span>
                          {record.is_rework && (
                            <span className="rounded bg-destructive/12 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                              retrabalho
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground">
                          {record.started_at ? formatDateTime(record.started_at) : '—'}
                          {record.finished_at ? ` → ${formatDateTime(record.finished_at)}` : ''}
                          {record.duration_minutes != null ? ` · ${formatDuration(record.duration_minutes)}` : ''}
                        </p>
                        {record.notes && <p className="mt-0.5 text-muted-foreground">{record.notes}</p>}

                        {canWrite && record.status !== 'CONCLUIDO' && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => run(() => updateProductionStatus(record.id, workOrderId, 'CONCLUIDO'))}
                            >
                              <CheckCircle2 className="size-3" />
                              Concluir
                            </Button>
                            {record.status === 'EM_ANDAMENTO' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => run(() => updateProductionStatus(record.id, workOrderId, 'PAUSADO'))}
                              >
                                <Pause className="size-3" />
                                Pausar
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => run(() => updateProductionStatus(record.id, workOrderId, 'EM_ANDAMENTO'))}
                              >
                                <Play className="size-3" />
                                Retomar
                              </Button>
                            )}
                          </div>
                        )}

                        {canWrite && record.status === 'CONCLUIDO' && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => run(() => updateProductionStatus(record.id, workOrderId, 'RETRABALHO'))}
                            >
                              <RotateCcw className="size-3" />
                              Marcar retrabalho
                            </Button>
                            <ConfirmDialog
                              trigger={
                                <Button variant="ghost" size="icon-sm" aria-label="Remover apontamento">
                                  <Trash2 className="size-3 text-destructive" />
                                </Button>
                              }
                              title="Remover apontamento"
                              variant="destructive"
                              confirmLabel="Remover"
                              onConfirm={() => run(() => deleteProductionRecord(record.id, workOrderId))}
                            />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

async function run(fn: () => Promise<ActionState>) {
  const result = await fn()
  if (result.error) toast.error(result.error)
  else toast.success(result.success ?? 'Atualizado.')
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`
}

function StartStepDialog({
  workOrderId,
  steps,
  pieces,
  users,
}: {
  workOrderId: string
  steps: ProductionStep[]
  pieces: PieceOption[]
  users: { id: string; full_name: string }[]
}) {
  const [open, setOpen] = React.useState(false)
  const [isRework, setIsRework] = React.useState(false)
  const [, formAction, pending] = useActionForm(startProductionStep, { onSuccess: () => setOpen(false) })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Play />
          Iniciar etapa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iniciar etapa de produção</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="work_order_id" value={workOrderId} />
          <FormSection columns={2}>
            <Field label="Etapa" required span="full">
              <Select name="step_code" defaultValue={steps[0]?.code} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {steps.map((step) => (
                    <SelectItem key={step.code} value={step.code}>
                      {step.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Responsável">
              <Select name="responsible_id" defaultValue="NENHUM">
                <SelectTrigger>
                  <SelectValue />
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

            <Field label="Peça (opcional)">
              <Select name="piece_id" defaultValue="NENHUM">
                <SelectTrigger>
                  <SelectValue placeholder="Toda a OS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NENHUM">Toda a OS</SelectItem>
                  {pieces.map((piece) => (
                    <SelectItem key={piece.id} value={piece.id}>
                      {piece.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormSection>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="is_rework" checked={isRework} onCheckedChange={(value) => setIsRework(!!value)} />
            É retrabalho
          </label>

          {isRework && (
            <Field label="Motivo do retrabalho" required>
              <Textarea name="rework_reason" rows={2} required />
            </Field>
          )}

          <Field label="Observação">
            <Textarea name="notes" rows={2} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Iniciar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
