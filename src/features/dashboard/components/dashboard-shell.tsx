import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Cabeçalho do dashboard.
 *
 * Bloco próprio, com o título em escala de display e uma descrição que diz o
 * que a tela é — em vez de um título de 20px solto sobre a grade. A faixa de
 * "atualizado" fecha o cabeçalho e separa dos indicadores.
 */
export function DashboardHeader({
  title,
  description,
  updatedAt,
  periodLabel,
  action,
}: {
  title: string
  description: string
  updatedAt: string
  periodLabel: string
  action: React.ReactNode
}) {
  return (
    <header className="motion-enter flex flex-col gap-5 border-b border-border pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <h1 className="text-display">{title}</h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full rounded-full bg-success/60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-success" />
        </span>
        <span>Atualizado às {updatedAt}</span>
        <span aria-hidden className="text-border-strong">
          ·
        </span>
        <span>Período: {periodLabel}</span>
      </div>
    </header>
  )
}

/**
 * Título de seção. O dashboard tinha três faixas de cartões sem nenhuma
 * indicação de que mudavam de assunto; o rótulo é o que separa operação de
 * dinheiro e de estoque.
 */
export function SectionHeading({
  label,
  hint,
  index = 0,
  className,
}: {
  label: string
  hint?: string
  index?: number
  className?: string
}) {
  return (
    <div
      className={cn('motion-enter flex items-baseline gap-3', className)}
      style={{ '--enter-index': index } as React.CSSProperties}
    >
      <h2 className="text-eyebrow text-muted-foreground">{label}</h2>
      {hint && <span className="truncate text-xs text-muted-foreground/70">{hint}</span>}
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  )
}
