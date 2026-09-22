import type { PaymentMethod } from '@/types/database'

export interface InstallmentDraft {
  due_date: string
  amount: number
  payment_method: PaymentMethod | null
  notes: string
}

/** Hoje em America/Sao_Paulo, no formato do <input type="date">. */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function fromIso(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toIso(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Soma dias corridos ou uteis (sem sabado e domingo; feriados ficam por conta de quem ajusta a data). */
export function addDays(iso: string, days: number, businessDays = false): string {
  const date = fromIso(iso)
  if (!businessDays) {
    date.setDate(date.getDate() + days)
    return toIso(date)
  }
  let left = days
  while (left > 0) {
    date.setDate(date.getDate() + 1)
    const weekDay = date.getDay()
    if (weekDay !== 0 && weekDay !== 6) left--
  }
  return toIso(date)
}

/** "0/30/60" -> [0, 30, 60]. Vazio = a vista. */
export function parseInstallmentPattern(pattern: string | null | undefined): number[] {
  const days = (pattern ?? '')
    .split('/')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isFinite(value) && value >= 0)
  return days.length ? days.slice(0, 48) : [0]
}

/**
 * Parcelas iguais a partir de uma forma de pagamento ("0/30/60"). Os centavos
 * que sobram da divisao vao para a ultima parcela, para a soma bater com o total.
 */
export function buildInstallments(input: {
  total: number
  pattern: string | null | undefined
  baseDate: string
  paymentMethod: PaymentMethod | null
}): InstallmentDraft[] {
  const days = parseInstallmentPattern(input.pattern)
  const totalCents = Math.round(input.total * 100)
  const each = Math.floor(totalCents / days.length)
  return days.map((offset, index) => ({
    due_date: addDays(input.baseDate, offset),
    amount: (index === days.length - 1 ? totalCents - each * (days.length - 1) : each) / 100,
    payment_method: input.paymentMethod,
    notes: '',
  }))
}

export function sumInstallments(rows: { amount: number }[]): number {
  return Math.round(rows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0)) / 100
}
