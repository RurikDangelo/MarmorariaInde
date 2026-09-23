'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog'
import { deleteWorkOrder, reactivateWorkOrder } from '@/features/work-orders/actions'

/** Desfaz o cancelamento: a OS volta para a etapa em que estava. */
export function ReactivateWorkOrderButton({ workOrderId }: { workOrderId: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <RotateCcw />
          Reativar OS
        </Button>
      }
      title="Reativar esta OS?"
      description="O cancelamento é desfeito e a OS volta para a etapa em que estava antes, com o histórico inteiro."
      confirmLabel="Reativar"
      onConfirm={async () => {
        const result = await reactivateWorkOrder(workOrderId)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success(result.message ?? 'OS reativada.')
      }}
    />
  )
}

/** Exclusão definitiva da OS. Cancelar continua sendo o caminho normal. */
export function DeleteWorkOrderButton({ workOrderId, number }: { workOrderId: string; number: string }) {
  const router = useRouter()

  return (
    <ConfirmDeleteDialog
      trigger={
        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
          <Trash2 />
          Excluir
        </Button>
      }
      title={`Excluir a ${number}?`}
      description="A OS some do sistema. Se a ideia é só tirar do Kanban guardando o histórico, use Cancelar OS."
      removes={[
        'ambientes, produtos, peças e composição',
        'medições, apontamentos de produção e instalação',
        'anexos, fotos e desenhos',
        'títulos ainda não pagos no financeiro (os pagos impedem a exclusão)',
        'as chapas reservadas voltam para o estoque',
      ]}
      confirmText={number}
      confirmLabel="Excluir a OS"
      onConfirm={(reason) => deleteWorkOrder(workOrderId, reason)}
      onDeleted={() => router.push('/os')}
    />
  )
}
