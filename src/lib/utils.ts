import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ------------------------------------------------------------------ */
/* Formatadores                                                        */
/* ------------------------------------------------------------------ */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const NUM = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatCurrency(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0)
  return BRL.format(Number.isFinite(n) ? n : 0)
}

export function formatNumber(value: number | string | null | undefined, digits = 2): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0)
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(n) ? n : 0)
}

/** Area em m2 com 2 casas: "3,45 m²" */
export function formatArea(value: number | string | null | undefined): string {
  return `${NUM.format(Number(value ?? 0))} m²`
}

/** Milimetros para a notacao usada na oficina: 2450 -> "2,45 m" */
export function mmToMeters(mm: number | null | undefined): string {
  if (mm == null) return '—'
  return `${formatNumber(mm / 1000, 2)} m`
}

export function formatDimensions(
  length_mm: number | null | undefined,
  width_mm: number | null | undefined,
): string {
  if (!length_mm && !width_mm) return '—'
  return `${mmToMeters(length_mm)} × ${mmToMeters(width_mm)}`
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "há 3 dias", "em 2 dias", "hoje" */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  const diff = Math.round((d.getTime() - Date.now()) / 86_400_000)
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'amanhã'
  if (diff === -1) return 'ontem'
  if (diff > 0) return `em ${diff} dias`
  return `há ${Math.abs(diff)} dias`
}

export function daysUntil(value: string | Date | null | undefined): number | null {
  if (!value) return null
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

/* ------------------------------------------------------------------ */
/* Mascaras                                                            */
/* ------------------------------------------------------------------ */

export function maskPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) {
    return d
      .replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
        [a && `(${a}`, a.length === 2 ? ') ' : '', b, c && `-${c}`].filter(Boolean).join(''),
      )
      .trim()
  }
  return d
    .replace(/^(\d{0,2})(\d{0,5})(\d{0,4}).*/, (_, a, b, c) =>
      [a && `(${a}`, a.length === 2 ? ') ' : '', b, c && `-${c}`].filter(Boolean).join(''),
    )
    .trim()
}

export function maskDocument(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11) {
    return d.replace(/^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2}).*/, (_, a, b, c, e) =>
      [a, b && `.${b}`, c && `.${c}`, e && `-${e}`].filter(Boolean).join(''),
    )
  }
  return d.replace(/^(\d{0,2})(\d{0,3})(\d{0,3})(\d{0,4})(\d{0,2}).*/, (_, a, b, c, e, f) =>
    [a, b && `.${b}`, c && `.${c}`, e && `/${e}`, f && `-${f}`].filter(Boolean).join(''),
  )
}

export function maskZipCode(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8)
  return d.replace(/^(\d{0,5})(\d{0,3}).*/, (_, a, b) => [a, b && `-${b}`].filter(Boolean).join(''))
}

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

/** Link de WhatsApp com DDI do Brasil. */
export function whatsappLink(phone: string | null | undefined, message?: string): string | null {
  const digits = onlyDigits(phone)
  if (digits.length < 10) return null
  const full = digits.startsWith('55') ? digits : `55${digits}`
  const text = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${full}${text}`
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Converte "2,45", "2.45", "1.234,56" ou 620.5 para number.
 * Com virgula, e o formato brasileiro (ponto = milhar). Sem virgula, o ponto e
 * o separador decimal — e o que chega de <input type="number"> e dos campos de
 * dinheiro, e o que o marmorista digita no teclado numerico ("2.45" = 2,45 m).
 */
export function parseDecimal(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (!value) return 0
  const raw = String(value).replace(/\s/g, '')
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

/** Metros com ate 3 casas, sem zeros sobrando: 2450 -> "2,45", 1234 -> "1,234". */
export function mmToMetersInput(mm: number | null | undefined): string {
  if (!mm) return ''
  return (mm / 1000).toFixed(3).replace(/\.?0+$/, '').replace('.', ',')
}

/** Aceita metros ("2,45") ou milimetros ("2450") e devolve sempre milimetros. */
export function toMillimeters(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const raw = String(value).trim()
  if (raw.includes(',') || raw.includes('.')) return Math.round(parseDecimal(raw) * 1000)
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  // Numero inteiro pequeno provavelmente foi digitado em metros.
  return n <= 20 ? Math.round(n * 1000) : Math.round(n)
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function truncate(value: string, max = 60): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}
