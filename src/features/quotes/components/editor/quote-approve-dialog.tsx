'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/shared/form'
import { approveQuote } from '@/features/quotes/actions'
import type { DocumentRef } from '@/features/composition/types'
import { formatCurrency } from '@/lib/utils'

/**
 * Aprovar e gerar OS: copia a montagem inteira para a OS e, se marcado,
 * transforma a fatura em contas a receber. Antes, salva o que estiver pendente.
 */
export function QuoteApproveDialog({
  defaultDeadline,
  installmentsCount,
  installmentsTotal,
  total,
  canFinancial,
  beforeApprove,
}: {
  defaultDeadline: string
  installmentsCount: number
  installmentsTotal: number
  total: number
  canFinancial: boolean
  /** Salva o cabecalho se estiver sujo e devolve o documento. */
  beforeApprove: () => Promise<DocumentRef | null>
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [deadline, setDeadline] = React.useState(defaultDeadline)
  const canGenerate = canFinancial && installmentsCount > 0
  const [generate, setGenerate] = React.useState(canGenerate)
  const [pending, startTransition] = React.useTransition()
  const mismatch = installmentsCount > 0 && Math.abs(installmentsTotal - total) >= 0.005

  function approve() {
    startTransition(async () => {
      const doc = await beforeApprove()
      if (!doc) return
      const result = await approveQuote(doc.id, { deadline: deadline || null, generateReceivables: generate })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message)
      router.push(`/os/${result.data.workOrderId}`)
    })
  }

  return (
    <>
      <Button type="button" size="sm" variant="success" onClick={() => setOpen(true)}>
        <CheckCircle2 />
        Aprovar e gerar OS
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar orçamento</DialogTitle>
            <DialogDescription>
              Ambientes, produtos, materiais, peças, RT e anexos vão para a nova OS. O orçamento aprovado fica travado.
            </DialogDescription>
          </DialogHeader>
          <Field label="Prazo de entrega da OS">
            <Input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={generate} onCheckedChange={(value) => setGenerate(!!value)} disabled={!canGenerate} className="mt-0.5" />
            <span>
              Lançar as {installmentsCount} parcela(s) da fatura em contas a receber
              <span className="block text-xs text-muted-foreground">
                {!canFinancial
                  ? 'Exige permissão do financeiro.'
                  : installmentsCount === 0
                    ? 'Monte a fatura na aba Fatura para lançar junto.'
                    : `Soma ${formatCurrency(installmentsTotal)} — total ${formatCurrency(total)}`}
              </span>
            </span>
          </label>
          {generate && mismatch && (
            <p className="rounded-md bg-destructive/8 px-3 py-2 text-xs text-destructive">
              A soma das parcelas não bate com o total. Ajuste a fatura ou aprove sem lançar.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={approve} loading={pending} disabled={generate && mismatch}>
              Aprovar e gerar OS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
