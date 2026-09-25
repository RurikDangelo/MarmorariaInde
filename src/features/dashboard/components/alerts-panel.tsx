import Link from 'next/link'
import { AlertTriangle, ArrowRight, Bell, BellOff, CheckCircle2, Info } from 'lucide-react'
import { cn, formatRelative } from '@/lib/utils'
import type { Alert } from '@/types/database'

const SEVERITY = {
  CRITICO: {
    label: 'Crítico',
    icon: AlertTriangle,
    rail: 'bg-destructive',
    chip: 'bg-destructive/12 text-destructive ring-destructive/20',
    surface: 'bg-destructive/[0.06] hover:bg-destructive/[0.1]',
  },
  ATENCAO: {
    label: 'Atenção',
    icon: Bell,
    rail: 'bg-warning',
    chip: 'bg-warning/14 text-warning ring-warning/25',
    surface: 'bg-warning/[0.06] hover:bg-warning/[0.1]',
  },
  INFO: {
    label: 'Informativo',
    icon: Info,
    rail: 'bg-info',
    chip: 'bg-info/12 text-info ring-info/20',
    surface: 'bg-info/[0.06] hover:bg-info/[0.1]',
  },
} as const

/**
 * Alertas do dashboard.
 *
 * Cada alerta é um bloco com trilho lateral colorido, ícone em recipiente e
 * fundo levemente tingido pela severidade — dá para varrer a coluna e saber o
 * que é grave sem ler. Severidade também tem ícone e rótulo acessível: quem
 * não distingue vermelho de amarelo continua recebendo a informação.
 *
 * A entrada é escalonada e acontece uma vez. Nada pisca em laço: o que é
 * crítico se destaca pela posição e pelo peso visual, não por movimento.
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
        <div className="motion-enter flex flex-col items-center justify-center gap-2.5 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-warning/14 ring-1 ring-inset ring-warning/25">
            <BellOff className="size-6 text-warning" />
          </span>
          <p className="mt-1 text-base font-semibold">
            {knownIssues === 1 ? '1 pendência sem aviso' : `${knownIssues} pendências sem aviso`}
          </p>
          <p className="max-w-[17rem] text-sm text-muted-foreground">
            Os alertas foram dispensados hoje. Os números acima continuam valendo.
          </p>
          <Link
            href="/alertas"
            className="mt-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Abrir central de alertas
          </Link>
        </div>
      )
    }

    return (
      <div className="motion-enter flex flex-col items-center justify-center gap-2.5 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-success/12 ring-1 ring-inset ring-success/20">
          <CheckCircle2 className="size-6 text-success" />
        </span>
        <p className="mt-1 text-base font-semibold">Nada pendente</p>
        <p className="max-w-[16rem] text-sm text-muted-foreground">
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
    <ul className="flex flex-col gap-2">
      {ordered.map((alert, index) => {
        const config = SEVERITY[alert.severity] ?? SEVERITY.INFO
        const Icon = config.icon

        const body = (
          <>
            <span className={cn('absolute inset-y-0 left-0 w-1', config.rail)} aria-hidden />

            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
                config.chip,
              )}
            >
              <Icon className="size-4.5" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-semibold">{alert.title}</span>
                <span className="text-xs text-muted-foreground">{formatRelative(alert.created_at)}</span>
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
                className="size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-[var(--motion-hover)] group-hover:translate-x-0 group-hover:opacity-100"
                aria-hidden
              />
            )}
          </>
        )

        const shell = cn(
          'relative flex items-center gap-3 overflow-hidden rounded-xl py-3 pl-4 pr-3 transition-colors duration-[var(--motion-hover)]',
          config.surface,
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
                className={cn('group', shell, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
              >
                {body}
              </Link>
            ) : (
              <div className={shell}>{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
