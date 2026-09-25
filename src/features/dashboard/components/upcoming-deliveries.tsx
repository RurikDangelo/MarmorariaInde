import Link from 'next/link'
import { CalendarCheck2, ChevronRight } from 'lucide-react'
import { cn, daysUntil, formatCurrency, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/states'
import type { WorkOrder } from '@/types/database'

/** Urgência do prazo em texto + cor. Nunca só cor. */
function deadlineState(deadline: string | null) {
  const days = daysUntil(deadline)

  if (!deadline) return { text: 'sem prazo', dot: 'bg-muted-foreground/50', tone: 'text-muted-foreground' }
  if (days === null) return { text: 'sem prazo', dot: 'bg-muted-foreground/50', tone: 'text-muted-foreground' }
  if (days < 0) {
    const n = Math.abs(days)
    return {
      text: `atrasada ${n} ${n === 1 ? 'dia' : 'dias'}`,
      dot: 'bg-destructive',
      tone: 'text-destructive font-semibold',
    }
  }
  if (days === 0) return { text: 'entrega hoje', dot: 'bg-warning', tone: 'text-warning font-semibold' }
  if (days === 1) return { text: 'entrega amanhã', dot: 'bg-warning', tone: 'text-warning font-semibold' }
  if (days <= 3)
    return { text: `entrega em ${days} dias`, dot: 'bg-warning', tone: 'text-warning font-medium' }
  return { text: `entrega ${formatDate(deadline)}`, dot: 'bg-success', tone: 'text-muted-foreground' }
}

/**
 * As OS em aberto com prazo mais próximo.
 *
 * Cada linha virou um bloco com superfície própria: o hover tem para onde
 * acontecer e a leitura fica em duas alturas (número + cliente / prazo +
 * valor), em vez de uma linha só apertada.
 */
export function UpcomingDeliveries({ orders }: { orders: WorkOrder[] }) {
  if (!orders.length) {
    return (
      <EmptyState
        icon={CalendarCheck2}
        title="Nenhuma OS em aberto"
        description="As próximas entregas aparecem aqui assim que houver ordens em andamento."
        className="border-0 py-12"
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {orders.map((order, index) => {
        const prazo = deadlineState(order.deadline)

        return (
          <li
            key={order.id}
            className="motion-enter"
            style={{ '--enter-index': index } as React.CSSProperties}
          >
            <Link
              href={`/os/${order.id}`}
              className={cn(
                'group relative flex items-center gap-4 overflow-hidden rounded-xl border border-transparent bg-surface px-4 py-3.5',
                'transition-[background-color,border-color,transform] duration-[var(--motion-hover)] ease-[var(--ease-out)]',
                'hover:translate-x-0.5 hover:border-border-strong hover:bg-card',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              {/* Trilho de urgência: a cor do prazo aparece antes do texto. */}
              <span className={cn('absolute inset-y-0 left-0 w-1', prazo.dot)} aria-hidden />

              <div className="min-w-0 flex-1 pl-1">
                <p className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-semibold tabular transition-colors group-hover:text-primary">
                    {order.number}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">{order.customer?.name}</span>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs">
                  <span className={cn('size-1.5 shrink-0 rounded-full', prazo.dot)} aria-hidden />
                  <span className={prazo.tone}>{prazo.text}</span>
                  {order.title && (
                    <span className="truncate text-muted-foreground">· {order.title}</span>
                  )}
                </p>
              </div>

              <StatusBadge label={order.status?.label ?? order.status_code} color={order.status?.color} />

              <span className="hidden w-24 shrink-0 text-right text-sm font-semibold tabular sm:block">
                {formatCurrency(order.total_value)}
              </span>

              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground/40 transition-all duration-[var(--motion-hover)] group-hover:translate-x-0.5 group-hover:text-foreground"
                aria-hidden
              />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
