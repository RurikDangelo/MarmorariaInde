'use client'

import * as React from 'react'
import { useActionForm } from '@/lib/hooks/use-action-form'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FormSection } from '@/components/shared/form'
import { MoneyInput } from '@/components/shared/inputs'
import { saveTransaction } from '@/features/financial/actions'
import { PAYMENT_METHODS } from '@/lib/labels'
import type { FinancialAccount, FinancialCategory, FinancialTransaction } from '@/types/database'

export function TransactionDialog({
  categories,
  accounts,
  workOrders,
  transaction,
  defaultWorkOrderId,
  openByDefault,
  trigger,
}: {
  categories: FinancialCategory[]
  accounts: FinancialAccount[]
  workOrders: { id: string; number: string; customer_id: string }[]
  transaction?: FinancialTransaction
  defaultWorkOrderId?: string
  openByDefault?: boolean
  trigger?: React.ReactNode
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = React.useState(!!openByDefault)
  const [kind, setKind] = React.useState<'RECEITA' | 'DESPESA'>(transaction?.kind ?? 'RECEITA')
  const [, formAction, pending] = useActionForm(saveTransaction, {
    onSuccess: () => {
      setOpen(false)
      router.refresh()
    },
  })

  function handleOpenChange(value: boolean) {
    setOpen(value)
    if (!value && searchParams.get('novo')) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('novo')
      params.delete('os')
      router.replace(`/financeiro?${params.toString()}`, { scroll: false })
    }
  }

  const visibleCategories = categories.filter((category) => category.kind === kind)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus />
            Novo lançamento
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{transaction ? 'Editar lançamento' : 'Novo lançamento'}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-5">
          {transaction && <input type="hidden" name="id" value={transaction.id} />}
          <input type="hidden" name="kind" value={kind} />

          <FormSection columns={2}>
            <Field label="Tipo">
              <Select value={kind} onValueChange={(value) => setKind(value as 'RECEITA' | 'DESPESA')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECEITA">Receita (a receber)</SelectItem>
                  <SelectItem value="DESPESA">Despesa (a pagar)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Valor" required>
              <MoneyInput name="amount" defaultValue={Number(transaction?.amount ?? 0)} />
            </Field>

            <Field label="Descrição" required span="full">
              <Input name="description" defaultValue={transaction?.description ?? ''} required autoFocus />
            </Field>

            <Field label="Categoria">
              <Select name="category_id" defaultValue={transaction?.category_id ?? 'NENHUM'}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NENHUM">Sem categoria</SelectItem>
                  {visibleCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Conta">
              <Select name="account_id" defaultValue={transaction?.account_id ?? accounts[0]?.id ?? 'NENHUM'}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NENHUM">Sem conta</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Vencimento" required>
              <Input
                name="due_date"
                type="date"
                defaultValue={transaction?.due_date ?? new Date().toISOString().slice(0, 10)}
                required
              />
            </Field>

            <Field label="Situação">
              <Select name="status" defaultValue={transaction?.status ?? 'PENDENTE'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                  <SelectItem value="PAGO">{kind === 'RECEITA' ? 'Recebido' : 'Pago'}</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Forma de pagamento">
              <Select name="payment_method" defaultValue={transaction?.payment_method ?? 'NENHUM'}>
                <SelectTrigger>
                  <SelectValue placeholder="Não definida" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NENHUM">Não definida</SelectItem>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Ordem de serviço" hint="Receitas vinculadas atualizam o recebido da OS">
              <Select
                name="work_order_id"
                defaultValue={transaction?.work_order_id ?? defaultWorkOrderId ?? 'NENHUM'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem OS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NENHUM">Sem OS</SelectItem>
                  {workOrders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormSection>

          <Field label="Observações">
            <Textarea name="notes" rows={2} defaultValue={transaction?.notes ?? ''} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Salvar lançamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function SettleButton({ transactionId, workOrderId }: { transactionId: string; workOrderId?: string | null }) {
  const [pending, startTransition] = React.useTransition()
  const router = useRouter()

  return (
    <Button
      variant="outline"
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const { settleTransaction } = await import('@/features/financial/actions')
          const result = await settleTransaction(transactionId, workOrderId)
          if (result.error) toast.error(result.error)
          else {
            toast.success(result.success ?? 'Baixa registrada.')
            router.refresh()
          }
        })
      }
    >
      Dar baixa
    </Button>
  )
}
