import Link from 'next/link'
import { CalendarCheck2, ChevronRight } from 'lucide-react'
import { cn, daysUntil, formatCurrency, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/states'
import type { WorkOrder } from '@/types/database'

/**
 * As OS em aberto com prazo mais próximo.
 *
 * Cada linha é um link de verdade, então o hover pode ser explícito: fundo,
 * seta e realce do número. Prazo vencido ou apertado é dito em texto
 * ("atrasada 3 dias", "vence amanhã") além da cor — quem não enxerga a cor
 * continua recebendo a informação.
 */
export function UpcomingDeliveries({ orders }: { orders: WorkOrder[] }) {
  if (!orders.length) {
    return (
      <EmptyState
        icon={CalendarCheck2}
        title="Nenhuma OS em aberto"
        description="As próximas entregas aparecem aqui assim que houver ordens em andamento."
        className="border-0 py-10"
      />
    )
  }

  return (
    <ul className="-mx-2 flex flex-col">
      {orders.map((order, index) => {
        const days = daysUntil(order.deadline)
        const late = days !== null && days < 0
        const soon = days !== null && days >= 0 && days <= 2

        const prazo = !order.deadline
          ? 'sem prazo'
          : late
            ? `atrasada ${Math.abs(days!)} ${Math.abs(days!) === 1 ? 'dia' : 'dias'}`
            : days === 0
              ? 'entrega hoje'
              : days === 1
                ? 'entrega amanhã'
                : `entrega ${formatDate(order.deadline)}`

        return (
          <li
            key={order.id}
            className="motion-enter"
            style={{ '--enter-index': index } as React.CSSProperties}
          >
            <Link
              href={`/os/${order.id}`}
              className="group flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-[var(--motion-hover)] hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <span className="font-medium transition-colors group-hover:text-primary">
                    {order.number}
                  </span>
                  <span className="ml-2 text-muted-foreground">{order.customer?.name}</span>
                </p>
                <p className="truncate text-xs">
                  <span
                    className={cn(
                      'text-muted-foreground',
                      late && 'font-medium text-destructive',
                      soon && 'font-medium text-warning',
                    )}
                  >
                    {prazo}
                  </span>
                  {order.title ? <span className="text-muted-foreground"> · {order.title}</span> : null}
                </p>
              </div>

              <StatusBadge label={order.status?.label ?? order.status_code} color={order.status?.color} />

              <span className="hidden w-24 text-right text-sm tabular sm:block">
                {formatCurrency(order.total_value)}
              </span>

              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground/0 transition-all duration-[var(--motion-hover)] group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                aria-hidden
              />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
