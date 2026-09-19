'use client'

import * as React from 'react'
import { useActionForm } from '@/lib/hooks/use-action-form'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FormSection } from '@/components/shared/form'
import { saveActionPlan, updateActionPlanStatus } from '@/features/management/actions'
import type { ActionPlan } from '@/types/database'

export function ActionPlanDialog({
  users,
  workOrders,
  plan,
  trigger,
}: {
  users: { id: string; full_name: string }[]
  workOrders: { id: string; number: string }[]
  plan?: ActionPlan
  trigger?: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [, formAction, pending] = useActionForm(saveActionPlan, {
    onSuccess: () => {
      setOpen(false)
      router.refresh()
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus />
            Novo plano
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{plan ? 'Editar plano de ação' : 'Novo plano de ação'}</DialogTitle>
          <DialogDescription>
            Registre o problema, a ação combinada, quem resolve e até quando.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-5">
          {plan && <input type="hidden" name="id" value={plan.id} />}

          <FormSection columns={2}>
            <Field label="Título" required span="full">
              <Input name="title" defaultValue={plan?.title ?? ''} required autoFocus />
            </Field>

            <Field label="Problema" span="full">
              <Textarea name="problem" rows={2} defaultValue={plan?.problem ?? ''} />
            </Field>

            <Field label="Ação" span="full">
              <Textarea name="action" rows={2} defaultValue={plan?.action ?? ''} />
            </Field>

            <Field label="Responsável">
              <Select name="responsible_id" defaultValue={plan?.responsible_id ?? 'NENHUM'}>
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

            <Field label="Prazo">
              <Input name="due_date" type="date" defaultValue={plan?.due_date ?? ''} />
            </Field>

            <Field label="Prioridade">
              <Select name="priority" defaultValue={plan?.priority ?? 'NORMAL'}>
                <SelectTrigger>
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

            <Field label="Situação">
              <Select name="status" defaultValue={plan?.status ?? 'ABERTO'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ABERTO">Aberto</SelectItem>
                  <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                  <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="OS relacionada" span="full">
              <Select name="work_order_id" defaultValue={plan?.work_order_id ?? 'NENHUM'}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NENHUM">Nenhuma</SelectItem>
                  {workOrders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormSection>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Salvar plano
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ActionPlanStatusSelect({ planId, status }: { planId: string; status: string }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={(value) =>
        startTransition(async () => {
          const result = await updateActionPlanStatus(planId, value)
          if (result.error) toast.error(result.error)
          else {
            toast.success(result.success ?? 'Atualizado.')
            router.refresh()
          }
        })
      }
    >
      <SelectTrigger size="sm" className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ABERTO">Aberto</SelectItem>
        <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
        <SelectItem value="CONCLUIDO">Concluído</SelectItem>
        <SelectItem value="CANCELADO">Cancelado</SelectItem>
      </SelectContent>
    </Select>
  )
}
