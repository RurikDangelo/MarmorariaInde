import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import { EmptyState } from '@/components/shared/states'

export interface StageRow {
  code: string
  label: string
  color: string
  count: number
}

/** A cor da etapa é dado (work_order_statuses.color), não código. */
const BAR_CLASS: Record<string, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  info: 'bg-info',
  accent: 'bg-accent',
  muted: 'bg-muted-foreground/50',
}

/**
 * Distribuição das OS em aberto por etapa.
 *
 * Barra horizontal em vez de pizza: são até nove etapas e a ordem delas é o
 * próprio fluxo da marmoraria — ler de cima para baixo é ler o processo.
 *
 * Sem Recharts de propósito: cada linha é um link para a lista já filtrada, e
 * isso vale mais que qualquer interação de gráfico. Também não manda JS para o
 * cliente: a animação é CSS e o valor está sempre visível, então não há
 * informação escondida atrás de tooltip.
 */
export function StageBreakdown({ rows, total }: { rows: StageRow[]; total: number }) {
  const visible = rows.filter((row) => row.count > 0)

  if (!visible.length) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nenhuma OS em aberto"
        description="Quando houver ordens em andamento, a distribuição por etapa aparece aqui."
        className="border-0 py-10"
      />
    )
  }

  const max = Math.max(...visible.map((row) => row.count))

  return (
    <ul className="flex flex-col gap-0.5 [&:hover>li]:opacity-55 [&>li:hover]:opacity-100">
      {visible.map((row, index) => {
        const share = total > 0 ? (row.count / total) * 100 : 0

        return (
          <li
            key={row.code}
            className="motion-enter transition-opacity duration-[var(--motion-hover)]"
            style={{ '--enter-index': index } as React.CSSProperties}
          >
            <Link
              href={`/os?status=${row.code}`}
              className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors duration-[var(--motion-hover)] hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="w-28 shrink-0 truncate text-sm text-muted-foreground transition-colors group-hover:text-foreground sm:w-32">
                {row.label}
              </span>

              <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn(
                    'motion-grow-x absolute inset-y-0 left-0 rounded-full opacity-85 transition-opacity duration-[var(--motion-hover)] group-hover:opacity-100',
                    BAR_CLASS[row.color] ?? BAR_CLASS.muted,
                  )}
                  style={
                    {
                      width: `${Math.max(4, (row.count / max) * 100)}%`,
                      '--enter-index': index,
                    } as React.CSSProperties
                  }
                />
              </span>

              <span className="w-7 shrink-0 text-right text-sm font-semibold tabular">{row.count}</span>
              <span className="w-11 shrink-0 text-right text-xs tabular text-muted-foreground">
                {formatNumber(share, 0)}%
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
