'use client'

import * as React from 'react'
import { CalendarRange, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field } from '@/components/shared/form'
import { MoneyInput } from '@/components/shared/inputs'
import { LookupCombobox, inferLookupFields } from '@/features/catalog/components/lookup-combobox'
import { PAYMENT_METHODS } from '@/lib/labels'
import { cn, formatCurrency } from '@/lib/utils'
import { buildInstallments, sumInstallments, todayIso, type InstallmentDraft } from '../installments'
import { useDocument } from './document-context'
import type { PaymentMethod } from '@/types/database'

/**
 * Fatura: Especie + Forma de Pagamento geram as parcelas (Titulo, Vencimento,
 * Valor), que podem ser ajustadas antes de salvar/lancar.
 */
export function InstallmentsEditor({
  total,
  initialRows,
  paymentMethod,
  paymentTerms,
  readOnly,
  saveLabel,
  onSave,
}: {
  total: number
  initialRows: InstallmentDraft[]
  paymentMethod: PaymentMethod | null
  paymentTerms: string
  readOnly: boolean
  saveLabel: string
  onSave: (rows: InstallmentDraft[], payment: { payment_method: PaymentMethod | null; payment_terms: string }) => Promise<boolean>
}) {
  const { catalog, addLookup, canAddToLists } = useDocument()
  const [method, setMethod] = React.useState<PaymentMethod | null>(paymentMethod)
  const [terms, setTerms] = React.useState(paymentTerms)
  const [pattern, setPattern] = React.useState<string | null>(
    catalog.lookups.find((option) => option.list === 'FORMA_PAGAMENTO' && option.label === paymentTerms)?.installments ?? null,
  )
  const [baseDate, setBaseDate] = React.useState(todayIso())
  const [rows, setRows] = React.useState<InstallmentDraft[]>(initialRows)
  const [saving, startSaving] = React.useTransition()
  const sum = sumInstallments(rows)
  const mismatch = rows.length > 0 && Math.abs(sum - total) >= 0.005

  const setRow = (index: number, patch: Partial<InstallmentDraft>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[12rem_minmax(0,1fr)_10rem_auto] lg:items-end">
        <Field label="Espécie">
          <Select value={method ?? 'NENHUM'} onValueChange={(value) => setMethod(value === 'NENHUM' ? null : (value as PaymentMethod))} disabled={readOnly}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NENHUM">Não definida</SelectItem>
              {PAYMENT_METHODS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Forma de Pagamento">
          <LookupCombobox
            list="FORMA_PAGAMENTO"
            options={catalog.lookups.filter((option) => option.list === 'FORMA_PAGAMENTO')}
            value={terms}
            onSelect={(label, option) => {
              setTerms(label)
              setPattern(option?.installments ?? null)
            }}
            onCreated={addLookup}
            placeholder="À vista, 30/60/90…"
            canAddToList={canAddToLists}
            disabled={readOnly}
          />
        </Field>
        <Field label="Contar a partir de">
          <Input type="date" value={baseDate} onChange={(event) => setBaseDate(event.target.value)} disabled={readOnly} />
        </Field>
        <Button
          type="button"
          variant="secondary"
          disabled={readOnly || total <= 0}
          onClick={() =>
            setRows(
              buildInstallments({
                total,
                pattern: pattern ?? inferLookupFields('FORMA_PAGAMENTO', terms).installments,
                baseDate,
                paymentMethod: method,
              }),
            )
          }
        >
          <CalendarRange />
          Gerar parcelas
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          Escolha a forma de pagamento e clique em “Gerar parcelas”.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Título</th>
                <th className="px-2 py-2 text-left font-medium">Vencimento</th>
                <th className="px-2 py-2 text-right font-medium">Valor</th>
                <th className="px-2 py-2 text-left font-medium">Espécie</th>
                <th className="w-9" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t">
                  <td className="px-2 py-1.5 tabular">{index + 1}/{rows.length}</td>
                  <td className="px-2 py-1.5">
                    <Input type="date" value={row.due_date} onChange={(event) => setRow(index, { due_date: event.target.value })} className="h-8 w-40" disabled={readOnly} />
                  </td>
                  <td className="px-2 py-1.5">
                    <MoneyInput value={row.amount} onValueChange={(amount) => setRow(index, { amount })} className="ml-auto h-8 w-32 text-right" disabled={readOnly} />
                  </td>
                  <td className="px-2 py-1.5">
                    <Select value={row.payment_method ?? 'NENHUM'} onValueChange={(value) => setRow(index, { payment_method: value === 'NENHUM' ? null : (value as PaymentMethod) })} disabled={readOnly}>
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NENHUM">—</SelectItem>
                        {PAYMENT_METHODS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-1">
                    {!readOnly && (
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover parcela" onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>
                        <Trash2 className="text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {!readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRows((current) => [...current, { due_date: baseDate, amount: 0, payment_method: method, notes: '' }])}
          >
            <Plus />
            Adicionar parcela
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          <span className={cn('text-sm tabular', mismatch ? 'text-destructive' : 'text-muted-foreground')}>
            Soma {formatCurrency(sum)} {mismatch ? `≠ total ${formatCurrency(total)}` : ''}
          </span>
          {!readOnly && (
            <Button
              type="button"
              size="sm"
              loading={saving}
              onClick={() =>
                startSaving(async () => {
                  const saved = await onSave(rows, { payment_method: method, payment_terms: terms })
                  if (saved && saveLabel.startsWith('Lançar')) setRows([])
                })
              }
            >
              {saveLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
