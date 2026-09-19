'use client'

import * as React from 'react'
import { useActionForm } from '@/lib/hooks/use-action-form'
import { ArrowRight, Ban } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { cancelWorkOrder, changeWorkOrderStatus } from '@/features/work-orders/actions'
import type { WorkOrderStatus } from '@/types/database'

export function StatusChanger({
  workOrderId,
  currentStatus,
  statuses,
}: {
  workOrderId: string
  currentStatus: string
  statuses: WorkOrderStatus[]
}) {
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState(currentStatus)
  const [, formAction, pending] = useActionForm(changeWorkOrderStatus, { onSuccess: () => setOpen(false) })

  const flow = statuses.filter((status) => status.code !== 'CANCELADA')
  const currentIndex = flow.findIndex((status) => status.code === currentStatus)
  const next = currentIndex >= 0 ? flow[currentIndex + 1] : undefined

  return (
    <div className="flex items-center gap-2">
      {next && (
        <form action={formAction}>
          <input type="hidden" name="work_order_id" value={workOrderId} />
          <input type="hidden" name="status_code" value={next.code} />
          <Button type="submit" size="sm" loading={pending}>
            <ArrowRight />
            Avançar para {next.label}
          </Button>
        </form>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            Mudar etapa
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover a OS de etapa</DialogTitle>
            <DialogDescription>A mudança fica registrada na timeline com seu nome.</DialogDescription>
          </DialogHeader>

          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="work_order_id" value={workOrderId} />
            <input type="hidden" name="status_code" value={selected} />

            <div className="grid gap-1.5 sm:grid-cols-2">
              {flow.map((status) => (
                <button
                  key={status.code}
                  type="button"
                  onClick={() => setSelected(status.code)}
                  className={cn(
                    'rounded-md border px-3 py-2 text-left text-sm transition-colors',
                    selected === status.code
                      ? 'border-primary bg-primary/10 font-medium text-primary'
                      : 'hover:bg-secondary',
                    status.code === currentStatus && 'opacity-60',
                  )}
                >
                  {status.label}
                  {status.code === currentStatus && (
                    <span className="ml-1 text-xs text-muted-foreground">(atual)</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note">Observação (opcional)</Label>
              <Textarea id="note" name="note" rows={2} placeholder="Ex.: chapa separada, aguardando corte" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={pending} disabled={selected === currentStatus}>
                Mover
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function CancelWorkOrderDialog({ workOrderId }: { workOrderId: string }) {
  const [open, setOpen] = React.useState(false)
  const [, formAction, pending] = useActionForm(cancelWorkOrder, { onSuccess: () => setOpen(false) })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
          <Ban />
          Cancelar OS
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar ordem de serviço</DialogTitle>
          <DialogDescription>
            A OS deixa de aparecer no Kanban. O histórico e os lançamentos continuam registrados.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="work_order_id" value={workOrderId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason" required>
              Motivo do cancelamento
            </Label>
            <Textarea id="reason" name="reason" rows={3} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <Button type="submit" variant="destructive" loading={pending}>
              Cancelar OS
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
