import * as React from 'react'
import Link from 'next/link'
import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnimatedNumber, type NumberFormat } from '@/components/shared/animated-number'

export type MetricTone = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'accent'

interface MetricCardProps {
  label: string
  /** Texto pronto, para o que não é número (datas, faixas, "—"). */
  value?: string | number
  /**
   * Valor numérico cru. Com ele o cartão conta até o número e formata sozinho
   * — uma fonte da verdade só, sem risco de o texto divergir do dado.
   */
  numeric?: number
  format?: NumberFormat
  hint?: string
  icon?: React.ElementType
  tone?: MetricTone
  trend?: { value: number; label?: string }
  /** Barra de proporção no rodapé (0–100). Só quando o número é uma fração real. */
  meter?: number
  href?: string
  /** Posição na grade: escalona a entrada. */
  index?: number
  className?: string
}

/** Tinta do ícone e da barra. Fundo baixo, traço saturado: legível sem gritar. */
const TONE = {
  default: { chip: 'bg-primary/12 text-primary ring-primary/20', bar: 'bg-primary' },
  success: { chip: 'bg-success/12 text-success ring-success/20', bar: 'bg-success' },
  warning: { chip: 'bg-warning/14 text-warning ring-warning/25', bar: 'bg-warning' },
  destructive: { chip: 'bg-destructive/12 text-destructive ring-destructive/20', bar: 'bg-destructive' },
  info: { chip: 'bg-info/12 text-info ring-info/20', bar: 'bg-info' },
  accent: { chip: 'bg-accent/12 text-accent ring-accent/20', bar: 'bg-accent' },
} as const satisfies Record<MetricTone, { chip: string; bar: string }>

export function MetricCard({
  label,
  value,
  numeric,
  format = 'integer',
  hint,
  icon: Icon,
  tone = 'default',
  trend,
  meter,
  href,
  index = 0,
  className,
}: MetricCardProps) {
  const palette = TONE[tone]

  const content = (
    <article
      className={cn(
        'motion-enter group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card p-5',
        'transition-[transform,border-color,background-color,box-shadow] duration-[var(--motion-hover)] ease-[var(--ease-out)]',
        href &&
          'hover:-translate-y-1 hover:border-border-strong hover:bg-card hover:shadow-[var(--shadow-lift)]',
        className,
      )}
      style={{ '--enter-index': index } as React.CSSProperties}
    >
      {/* Brilho diagonal que só acende no hover: dá vida sem poluir o repouso. */}
      {href && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full opacity-0 blur-2xl transition-opacity duration-[var(--motion-micro)] group-hover:opacity-100"
          style={{ background: 'color-mix(in oklab, currentColor 6%, transparent)' }}
        />
      )}

      <header className="flex items-center gap-2.5">
        {Icon && (
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
              'transition-transform duration-[var(--motion-hover)] ease-[var(--ease-out)] group-hover:scale-110',
              palette.chip,
            )}
          >
            <Icon className="size-5" strokeWidth={2} />
          </span>
        )}
        <span className="text-eyebrow min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
        {href && (
          <ArrowUpRight
            className="size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-[var(--motion-hover)] group-hover:translate-x-0 group-hover:opacity-100"
            aria-hidden
          />
        )}
      </header>

      {/* O número é o elemento dominante do cartão, não o rótulo. */}
      <p className="text-metric mt-4 truncate">
        {numeric !== undefined ? <AnimatedNumber value={numeric} format={format} /> : value}
      </p>

      {(hint || trend) && (
        <div className="mt-1.5 flex min-h-5 items-center gap-2">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold',
                trend.value >= 0 ? 'bg-success/12 text-success' : 'bg-destructive/12 text-destructive',
              )}
            >
              {trend.value >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {Math.abs(trend.value).toFixed(0)}%
            </span>
          )}
          {hint && <span className="truncate text-sm text-muted-foreground">{hint}</span>}
        </div>
      )}

      {meter !== undefined && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <span
            className={cn('motion-grow-x block h-full rounded-full', palette.bar)}
            style={
              {
                width: `${Math.min(100, Math.max(2, meter))}%`,
                '--enter-index': index,
              } as React.CSSProperties
            }
          />
        </div>
      )}
    </article>
  )

  return href ? (
    <Link
      href={href}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {content}
    </Link>
  ) : (
    content
  )
}
