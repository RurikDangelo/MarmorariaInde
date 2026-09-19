'use client'

import * as React from 'react'
import { cn, maskDocument, maskPhone, maskZipCode, parseDecimal } from '@/lib/utils'
import { Input } from '@/components/ui/input'

/** Campo de dinheiro. Digita em centavos e formata em R$ automaticamente. */
export function MoneyInput({
  name,
  defaultValue = 0,
  value: controlledValue,
  onValueChange,
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'value' | 'defaultValue' | 'onChange'> & {
  defaultValue?: number
  value?: number
  onValueChange?: (value: number) => void
}) {
  const [numeric, setNumeric] = React.useState(controlledValue ?? defaultValue)
  const [display, setDisplay] = React.useState(() => formatMoney(controlledValue ?? defaultValue))
  const [syncedValue, setSyncedValue] = React.useState(controlledValue)

  // Valor controlado mudou por fora (ex.: escolher o material preenche o preco).
  if (controlledValue !== undefined && controlledValue !== syncedValue) {
    setSyncedValue(controlledValue)
    setNumeric(controlledValue)
    setDisplay(formatMoney(controlledValue))
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, '')
    const next = Number(digits) / 100
    setNumeric(next)
    setDisplay(formatMoney(next))
    onValueChange?.(next)
  }

  return (
    <>
      <Input
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        className={cn('tabular', className)}
        {...props}
      />
      <input type="hidden" name={name} value={numeric} />
    </>
  )
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0)
}

/**
 * Campo de medida. O marmorista digita em metros ("2,45") e o sistema
 * envia milimetros para o banco.
 */
export function DimensionInput({
  name,
  defaultValueMm = 0,
  onMmChange,
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'defaultValue' | 'onChange' | 'name'> & {
  name?: string
  defaultValueMm?: number
  onMmChange?: (mm: number) => void
}) {
  const [text, setText] = React.useState(() => (defaultValueMm ? (defaultValueMm / 1000).toFixed(2).replace('.', ',') : ''))
  const mm = React.useMemo(() => Math.round(parseDecimal(text) * 1000), [text])

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value.replace(/[^\d,.]/g, '')
    setText(next)
    onMmChange?.(Math.round(parseDecimal(next) * 1000))
  }

  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        value={text}
        onChange={handleChange}
        placeholder="0,00"
        className={cn('pr-8 tabular', className)}
        {...props}
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        m
      </span>
      {name && <input type="hidden" name={name} value={mm} />}
    </div>
  )
}

export function PhoneInput({ defaultValue = '', ...props }: React.ComponentProps<'input'>) {
  const [value, setValue] = React.useState(maskPhone(String(defaultValue ?? '')))
  return (
    <Input
      inputMode="tel"
      value={value}
      onChange={(event) => setValue(maskPhone(event.target.value))}
      placeholder="(12) 98888-8888"
      {...props}
    />
  )
}

export function DocumentInput({ defaultValue = '', ...props }: React.ComponentProps<'input'>) {
  const [value, setValue] = React.useState(maskDocument(String(defaultValue ?? '')))
  return (
    <Input
      inputMode="numeric"
      value={value}
      onChange={(event) => setValue(maskDocument(event.target.value))}
      placeholder="CPF ou CNPJ"
      {...props}
    />
  )
}

export function ZipCodeInput({ defaultValue = '', ...props }: React.ComponentProps<'input'>) {
  const [value, setValue] = React.useState(maskZipCode(String(defaultValue ?? '')))
  return (
    <Input
      inputMode="numeric"
      value={value}
      onChange={(event) => setValue(maskZipCode(event.target.value))}
      placeholder="00000-000"
      {...props}
    />
  )
}
