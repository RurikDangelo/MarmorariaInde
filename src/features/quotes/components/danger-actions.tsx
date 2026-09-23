'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog'
import { deleteQuote, reactivateQuote } from '@/features/quotes/actions'

/** Orçamento cancelado ou recusado volta a ser rascunho e pode ser editado. */
export function ReactivateQuoteButton({ quoteId }: { quoteId: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <RotateCcw />
          Reabrir
        </Button>
      }
      title="Reabrir este orçamento?"
      description="Ele volta para rascunho e pode ser editado e aprovado de novo."
      confirmLabel="Reabrir"
      onConfirm={async () => {
        const result = await reactivateQuote(quoteId)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success(result.message ?? 'Orçamento reaberto.')
      }}
    />
  )
}

/** Exclusão definitiva do orçamento. */
export function DeleteQuoteButton({ quoteId, number }: { quoteId: string; number: string }) {
  const router = useRouter()

  return (
    <ConfirmDeleteDialog
      trigger={
        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
          <Trash2 />
          Excluir
        </Button>
      }
      title={`Excluir o orçamento ${number}?`}
      description="Some do sistema. Para guardar o histórico, mude a situação para Cancelado em vez de excluir."
      removes={[
        'ambientes, produtos, peças e composição',
        'fatura (parcelas), RT e arquivos anexos',
        'orçamento que já virou OS não pode ser excluído',
      ]}
      confirmText={number}
      confirmLabel="Excluir o orçamento"
      onConfirm={(reason) => deleteQuote(quoteId, reason)}
      onDeleted={() => router.push('/orcamentos')}
    />
  )
}
