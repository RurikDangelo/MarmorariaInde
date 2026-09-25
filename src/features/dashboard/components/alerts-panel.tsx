import Link from 'next/link'
import { AlertTriangle, ArrowRight, Bell, BellOff, CheckCircle2, Info } from 'lucide-react'
import { cn, formatRelative } from '@/lib/utils'
import type { Alert } from '@/types/database'

const SEVERITY = {
  CRITICO: {
    label: 'Crítico',
    icon: AlertTriangle,
    dot: 'bg-destructive',
    chip: 'bg-destructive/12 text-destructive',
    rail: 'bg-destructive',
  },
  ATENCAO: {
    label: 'Atenção',
    icon: Bell,
    dot: 'bg-warning',
    chip: 'bg-warning/16 text-warning',
    rail: 'bg-warning',
  },
  INFO: {
    label: 'Informativo',
    icon: Info,
    dot: 'bg-info',
    chip: 'bg-info/12 text-info',
    rail: 'bg-info',
  },
} as const

/**
 * Alertas do dashboard.
 *
 * Severidade não é transmitida só por cor: cada item tem ícone e rótulo, para
 * quem não distingue vermelho de amarelo. A entrada é escalonada e acontece
 * uma vez — nada pisca em laço para "chamar atenção"; o que é crítico se
 * destaca pela posição e pelo peso visual, não por movimento repetido.
 */
export function AlertsPanel({
  alerts,
  /**
   * Problemas que o próprio dashboard já contou (OS atrasada, título vencido,
   * plano atrasado). Serve para não cantar vitória indevida: sem alerta ativo
   * mas com problema conhecido, o certo é dizer que os avisos foram
   * dispensados — não que está tudo em dia.
   */
  knownIssues = 0,
}: {
  alerts: Alert[]
  knownIssues?: number
}) {
  if (!alerts.length) {
    if (knownIssues > 0) {
      return (
        <div className="motion-enter flex flex-col items-center justify-center gap-2 py-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-warning/14">
            <BellOff className="size-5 text-warning" />
          </span>
          <p className="text-sm font-medium">
            {knownIssues === 1 ? '1 pendência sem aviso ativo' : `${knownIssues} pendências sem aviso ativo`}
          </p>
          <p className="max-w-[16rem] text-xs text-muted-foreground">
            Os alertas correspondentes foram dispensados. Os números acima continuam valendo.
          </p>
          <Link
            href="/alertas"
            className="mt-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Abrir central de alertas
          </Link>
        </div>
      )
    }

    return (
      <div className="motion-enter flex flex-col items-center justify-center gap-2 py-10 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-success/12">
          <CheckCircle2 className="size-5 text-success" />
        </span>
        <p className="text-sm font-medium">Nada pendente</p>
        <p className="max-w-[15rem] text-xs text-muted-foreground">
          Prazos, estoque, pagamentos e medições estão em dia.
        </p>
      </div>
    )
  }

  // Crítico primeiro: a ordem da lista já é a ordem de urgência.
  const ordered = [...alerts].sort((a, b) => {
    const weight = { CRITICO: 0, ATENCAO: 1, INFO: 2 } as const
    return (weight[a.severity] ?? 3) - (weight[b.severity] ?? 3)
  })

  return (
    <ul className="flex flex-col gap-1">
      {ordered.map((alert, index) => {
        const config = SEVERITY[alert.severity] ?? SEVERITY.INFO
        const Icon = config.icon
        const body = (
          <>
            <span
              className={cn('absolute inset-y-1 left-0 w-0.5 rounded-full opacity-70', config.rail)}
              aria-hidden
            />
            <Icon className={cn('mt-0.5 size-4 shrink-0', config.chip.split(' ')[1])} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium">{alert.title}</span>
                <span className="text-[11px] text-muted-foreground">{formatRelative(alert.created_at)}</span>
              </span>
              {alert.description && (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {alert.description}
                </span>
              )}
              <span className="sr-only">Severidade: {config.label}</span>
            </span>
            {alert.href && (
              <ArrowRight
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/0 transition-colors duration-[var(--motion-hover)] group-hover:text-muted-foreground"
                aria-hidden
              />
            )}
          </>
        )

        return (
          <li
            key={alert.id}
            className="motion-enter"
            style={{ '--enter-index': index } as React.CSSProperties}
          >
            {alert.href ? (
              <Link
                href={alert.href}
                className="group relative flex gap-2.5 rounded-md py-1.5 pl-3 pr-1.5 transition-colors duration-[var(--motion-hover)] hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {body}
              </Link>
            ) : (
              <div className="relative flex gap-2.5 py-1.5 pl-3 pr-1.5">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
