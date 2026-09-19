import * as React from 'react'
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ElementType
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingState({ label = 'Carregando…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground', className)}>
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  )
}

export function ErrorState({
  title = 'Não foi possível carregar',
  description,
  onRetry,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-destructive/25 bg-destructive/5 px-6 py-10 text-center',
        className,
      )}
    >
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-5 text-destructive" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}

/** Skeleton de tabela para Suspense. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-lg border">
      <div className="flex gap-4 border-b px-3 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b px-3 py-3.5 last:border-0">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" style={{ opacity: 1 - r * 0.1 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-32" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  )
}
