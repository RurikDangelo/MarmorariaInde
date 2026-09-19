import * as React from 'react'
import Link from 'next/link'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

interface MetricCardProps {
  label: string
  value: string | number
  hint?: string
  icon?: React.ElementType
  tone?: 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'accent'
  trend?: { value: number; label?: string }
  href?: string
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
  hint,
  icon: Icon,
  tone = 'default',
  trend,
  href,
  className,
}: MetricCardProps) {
  const content = (
    <Card
      className={cn(
        'flex h-full items-start gap-3 p-4 transition-colors',
        href && 'hover:border-primary/40 hover:bg-secondary/30',
        className,
      )}
    >
      {Icon && (
        <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', TONE_CLASS[tone])}>
          <Icon className="size-4.5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-xl font-semibold tabular sm:text-2xl">{value}</p>
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
    </Card>
  )

  return href ? (
    <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
      {content}
    </Link>
  ) : (
    content
  )
}
