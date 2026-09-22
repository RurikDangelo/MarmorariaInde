'use client'

import * as React from 'react'
import { cn, mmToMetersInput, parseDecimal } from '@/lib/utils'
import { Input } from '@/components/ui/input'

type BaseProps = Omit<React.ComponentProps<'input'>, 'value' | 'defaultValue' | 'onChange' | 'type'>

function toText(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  return String(value).replace('.', ',')
}

function sanitize(text: string) {
  return text.replace(/[^\d,.]/g, '')
}

/**
 * Numero decimal controlado (quantidade, % perda, metros lineares...).
 * O texto digitado fica local ("2," enquanto digita) e o numero sobe pelo onValueChange.
 */
export function DecimalField({
  value,
  onValueChange,
  suffix,
  className,
  ...props
}: BaseProps & {
  value: number | null | undefined
  onValueChange: (value: number) => void
  suffix?: string
}) {
  const [text, setText] = React.useState(() => toText(value))
  const [synced, setSynced] = React.useState(value)

  // valor mudou por fora (ex.: "Gerar pecas", preco do cadastro)
  if (value !== synced) {
    setSynced(value)
    if (parseDecimal(text) !== (value ?? 0)) setText(toText(value))
  }

  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        value={text}
        onChange={(event) => {
          const next = sanitize(event.target.value)
          setText(next)
          const parsed = parseDecimal(next)
          setSynced(parsed)
          onValueChange(parsed)
        }}
        className={cn('tabular', suffix && 'pr-8', className)}
        {...props}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  )
}

/** Medida controlada: digita metros ("2,45" ou "2.45"), sobe milimetros. */
export function MetersField({
  valueMm,
  onValueChange,
  className,
  ...props
}: BaseProps & {
  valueMm: number | null | undefined
  onValueChange: (mm: number | null) => void
}) {
  const [text, setText] = React.useState(() => mmToMetersInput(valueMm))
  const [synced, setSynced] = React.useState(valueMm)

  if (valueMm !== synced) {
    setSynced(valueMm)
    if (Math.round(parseDecimal(text) * 1000) !== (valueMm ?? 0)) setText(mmToMetersInput(valueMm))
  }

  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        value={text}
        placeholder="0,00"
        onChange={(event) => {
          const next = sanitize(event.target.value)
          setText(next)
          const mm = next === '' ? null : Math.round(parseDecimal(next) * 1000)
          setSynced(mm)
          onValueChange(mm)
        }}
        className={cn('pr-7 tabular', className)}
        {...props}
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        m
      </span>
    </div>
  )
}
