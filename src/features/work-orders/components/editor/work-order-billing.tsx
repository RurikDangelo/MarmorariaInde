'use client'

import { toast } from 'sonner'
import { GenericStatusBadge } from '@/components/shared/status-badge'
import { InstallmentsEditor } from '@/features/composition/components/installments-editor'
import { useDocument } from '@/features/composition/components/document-context'
import { generateReceivables } from '@/features/composition/finance-actions'
import { paymentMethodLabel } from '@/lib/labels'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { FinancialTransaction, PaymentMethod } from '@/types/database'

/** Fatura da OS: o que ja esta no contas a receber e o gerador de novas parcelas. */
export function WorkOrderBilling({
  total,
  receivables,
  canFinancial,
  paymentMethod,
  paymentTerms,
}: {
  total: number
  receivables: FinancialTransaction[]
  canFinancial: boolean
  paymentMethod: PaymentMethod | null
  paymentTerms: string
}) {
  const { ensureDocument, refresh } = useDocument()
  const active = receivables.filter((transaction) => transaction.status !== 'CANCELADO')
  const launched = active.reduce((sum, transaction) => sum + Number(transaction.amount), 0)
  const remaining = Math.max(0, Math.round((total - launched) * 100) / 100)

  return (
    <div className="flex flex-col gap-4">
      {active.length > 0 && (
        <ul className="divide-y rounded-md border">
          {active.map((transaction) => (
            <li key={transaction.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <span className="w-12 tabular text-muted-foreground">
                {transaction.installment}/{transaction.installments}
              </span>
              <span className="flex-1 tabular">vence {formatDate(transaction.due_date)}</span>
              <span className="text-muted-foreground">{paymentMethodLabel(transaction.payment_method)}</span>
              <GenericStatusBadge status={transaction.status} />
              <span className="font-medium tabular">{formatCurrency(transaction.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-muted-foreground">
        Lançado no contas a receber: <strong className="tabular text-foreground">{formatCurrency(launched)}</strong> ·
        falta lançar <strong className="tabular text-foreground">{formatCurrency(remaining)}</strong>
      </p>

      {canFinancial ? (
        remaining > 0 && (
          <InstallmentsEditor
            key={remaining}
            total={remaining}
            initialRows={[]}
            paymentMethod={paymentMethod}
            paymentTerms={paymentTerms}
            readOnly={false}
            saveLabel="Lançar no contas a receber"
            onSave={async (rows) => {
              const doc = await ensureDocument()
              if (!doc) return false
              const result = await generateReceivables(doc.id, rows)
              if (!result.ok) {
                toast.error(result.error)
                return false
              }
              toast.success(result.message)
              refresh()
              return true
            }}
          />
        )
      ) : (
        <p className="text-xs text-muted-foreground">Lançar parcelas exige permissão do financeiro.</p>
      )}
    </div>
  )
}
