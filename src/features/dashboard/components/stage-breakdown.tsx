import Link from 'next/link'
import { ArrowRight, ClipboardList } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import { EmptyState } from '@/components/shared/states'

export interface StageRow {
  code: string
  label: string
  color: string
  count: number
}

/** A cor da etapa é dado (work_order_statuses.color), não código. */
const BAR: Record<string, string> = {
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
 * Cada linha tem duas alturas: rótulo com contagem em cima, barra embaixo.
 * Em uma linha só a barra ficava espremida entre texto e número, e a
 * proporção — que é a informação — era o que menos aparecia.
 *
 * Sem Recharts de propósito: cada linha é um link para a lista já filtrada, e
 * isso vale mais que interação de gráfico. Também não manda JS para o cliente.
 */
export function StageBreakdown({ rows, total }: { rows: StageRow[]; total: number }) {
  const visible = rows.filter((row) => row.count > 0)

  if (!visible.length) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nenhuma OS em aberto"
        description="Quando houver ordens em andamento, a distribuição por etapa aparece aqui."
        className="border-0 py-12"
      />
    )
  }

  const max = Math.max(...visible.map((row) => row.count))

  return (
    <ul className="flex flex-col gap-1">
      {visible.map((row, index) => {
        const share = total > 0 ? (row.count / total) * 100 : 0

        return (
          <li
            key={row.code}
            className="motion-enter"
            style={{ '--enter-index': index } as React.CSSProperties}
          >
            <Link
              href={`/os?status=${row.code}`}
              className="group flex flex-col gap-2.5 rounded-lg px-3 py-3 transition-colors duration-[var(--motion-hover)] hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium transition-colors group-hover:text-foreground">
                  {row.label}
                </span>
                <ArrowRight
                  className="size-3.5 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-[var(--motion-hover)] group-hover:translate-x-0 group-hover:opacity-100"
                  aria-hidden
                />
                <span className="ml-auto flex shrink-0 items-baseline gap-2">
                  <span className="text-lg font-bold leading-none tabular">{row.count}</span>
                  <span className="w-10 text-right text-xs tabular text-muted-foreground">
                    {formatNumber(share, 0)}%
                  </span>
                </span>
              </span>

              <span className="relative h-2 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn(
                    'motion-grow-x absolute inset-y-0 left-0 rounded-full opacity-90 transition-opacity duration-[var(--motion-hover)] group-hover:opacity-100',
                    BAR[row.color] ?? BAR.muted,
                  )}
                  style={
                    {
                      width: `${Math.max(3, (row.count / max) * 100)}%`,
                      '--enter-index': index,
                    } as React.CSSProperties
                  }
                />
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
