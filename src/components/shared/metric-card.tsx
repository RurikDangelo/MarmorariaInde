import * as React from 'react'
import Link from 'next/link'
import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { AnimatedNumber, type NumberFormat } from '@/components/shared/animated-number'

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
  tone?: 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'accent'
  trend?: { value: number; label?: string }
  href?: string
  /** Posição na grade: escalona a entrada dos cartões. */
  index?: number
  className?: string
}

const TONE_CLASS = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/16 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
  accent: 'bg-accent/12 text-accent',
} as const

export function MetricCard({
  label,
  value,
  numeric,
  format = 'integer',
  hint,
  icon: Icon,
  tone = 'default',
  trend,
  href,
  index = 0,
  className,
}: MetricCardProps) {
  const content = (
    <Card
      className={cn(
        'motion-enter motion-card group relative flex h-full items-start gap-3 overflow-hidden p-4',
        // Subir 2px em vez de escalar: escala em texto dá borrão de subpixel.
        href && 'hover:-translate-y-0.5 hover:border-primary/40 hover:bg-secondary/25 hover:shadow-md',
        className,
      )}
      style={{ '--enter-index': index } as React.CSSProperties}
    >
      {Icon && (
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md transition-transform duration-[var(--motion-hover)] ease-[var(--ease-out)] group-hover:scale-110',
            TONE_CLASS[tone],
          )}
        >
          <Icon className="size-4.5" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 truncate text-xl font-semibold tabular sm:text-2xl">
          {numeric !== undefined ? <AnimatedNumber value={numeric} format={format} /> : value}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium',
                trend.value >= 0 ? 'text-success' : 'text-destructive',
              )}
            >
              {trend.value >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {Math.abs(trend.value).toFixed(0)}%
            </span>
          )}
          {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
        </div>
      </div>

      {/* Só quem leva a algum lugar mostra a seta — não criar afordância falsa. */}
      {href && (
        <ArrowUpRight
          className="absolute right-3 top-3 size-4 text-muted-foreground/0 transition-colors duration-[var(--motion-hover)] group-hover:text-muted-foreground/70"
          aria-hidden
        />
      )}
    </Card>
  )

  return href ? (
    <Link
      href={href}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {content}
    </Link>
  ) : (
    content
  )
}
