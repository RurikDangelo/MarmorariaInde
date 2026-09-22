'use client'

import { PAYMENT_TYPES } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { PaymentType } from '@/types/database'

/** Tipo de Pagamento: À Vista / A Prazo (radio do sistema antigo). */
export function PaymentTypeToggle({
  value,
  onChange,
  disabled,
}: {
  value: PaymentType
  onChange: (value: PaymentType) => void
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label="Tipo de Pagamento" className="inline-flex h-9 w-full rounded-md border bg-muted/40 p-0.5">
      {PAYMENT_TYPES.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 rounded px-3 text-sm transition-colors disabled:opacity-60',
            value === option.value ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
