'use client'

import * as React from 'react'
import { Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { deleteTechnicalReserve, launchTechnicalReserve } from '../finance-actions'
import { addDays, todayIso } from '../installments'
import { useDocument } from './document-context'
import { TechnicalReserveDialog } from './technical-reserve-dialog'
import type { TechnicalReserve } from '@/types/database'

/** Aba "RT's": reserva tecnica do profissional que indicou a venda (custo, nao vai para o cliente). */
export function TechnicalReservesPanel({
  reserves,
  documentTotal,
  canLaunch,
}: {
  reserves: TechnicalReserve[]
  documentTotal: number
  canLaunch: boolean
}) {
  const { doc, canEdit, refresh } = useDocument()
  const [editing, setEditing] = React.useState<TechnicalReserve | 'novo' | null>(null)
  const [dueDate, setDueDate] = React.useState(addDays(todayIso(), 30))

  async function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    const result = await action()
    if (!result.ok) toast.error(result.error)
    else {
      toast.success(result.message)
      refresh()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        A RT é custo da marmoraria: não aparece para o cliente nem entra no total cobrado.
      </p>

      {reserves.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Nenhuma RT.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {reserves.map((reserve) => (
            <li key={reserve.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{reserve.professional_name}</p>
                <p className="text-xs text-muted-foreground">
                  {[reserve.professional_phone, reserve.pix_key && `PIX ${reserve.pix_key}`].filter(Boolean).join(' · ') || 'Sem contato'}
                </p>
              </div>
              <span className="text-sm tabular text-muted-foreground">
                {reserve.percentage !== null ? `${formatNumber(reserve.percentage, 2)}%` : 'valor fixo'}
              </span>
              <span className="font-semibold tabular">{formatCurrency(reserve.amount)}</span>
              {reserve.financial_transaction_id ? (
                <Badge variant="success">Lançada no financeiro</Badge>
              ) : (
                <div className="flex items-center gap-1">
                  {canLaunch && doc?.kind === 'work_order' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" size="sm">
                          <Send />
                          Lançar
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="flex w-64 flex-col gap-2">
                        <p className="text-sm font-medium">Conta a pagar da RT</p>
                        <label className="text-xs text-muted-foreground">
                          Vencimento
                          <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1" />
                        </label>
                        <Button type="button" size="sm" onClick={() => doc && run(() => launchTechnicalReserve(doc.id, reserve.id, dueDate))}>
                          Lançar em contas a pagar
                        </Button>
                      </PopoverContent>
                    </Popover>
                  )}
                  {canEdit && (
                    <>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar RT" onClick={() => setEditing(reserve)}>
                        <Pencil />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover RT">
                            <Trash2 className="text-destructive" />
                          </Button>
                        }
                        title="Remover RT"
                        variant="destructive"
                        confirmLabel="Remover"
                        onConfirm={() => (doc ? run(() => deleteTechnicalReserve(doc, reserve.id)) : undefined)}
                      />
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing('novo')}>
            <Plus />
            Incluir RT
          </Button>
        </div>
      )}

      {editing && (
        <TechnicalReserveDialog
          reserve={editing === 'novo' ? null : editing}
          documentTotal={documentTotal}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
