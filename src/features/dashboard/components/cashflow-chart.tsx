'use client'

import * as React from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn, formatCurrency } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/lib/hooks/use-prefers-reduced-motion'

export interface CashflowPoint {
  month: string
  receita: number
  despesa: number
}

const SERIES = [
  { key: 'receita', label: 'Receita', color: 'var(--chart-1)' },
  { key: 'despesa', label: 'Despesa', color: 'var(--chart-2)' },
] as const

/** Uma casa decimal, sem o ",0" inútil: 1,4 · 18,5 · 120 */
function short(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '').replace('.', ',')
}

/**
 * Eixo Y curto: 1.400 vira "1,4 mil"; 1.200.000 vira "1,2 mi".
 *
 * A casa decimal não é enfeite: arredondando para inteiro, uma escala de
 * 0–1.400 imprimia "1 mil" em dois traços diferentes (1.050 e 1.400).
 */
function shortCurrency(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${short(value / 1_000_000)} mi`
  if (abs >= 1_000) return `${short(value / 1_000)} mil`
  return String(value)
}

function CashflowTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { dataKey?: string | number; value?: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null

  const receita = Number(payload.find((item) => item.dataKey === 'receita')?.value ?? 0)
  const despesa = Number(payload.find((item) => item.dataKey === 'despesa')?.value ?? 0)
  const saldo = receita - despesa

  return (
    <div
      role="tooltip"
      className="animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1 min-w-44 rounded-lg border bg-popover/98 p-3 shadow-lg backdrop-blur duration-[var(--motion-micro)]"
    >
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>

      <dl className="flex flex-col gap-1.5 text-sm">
        {SERIES.map((series) => (
          <div key={series.key} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: series.color }} aria-hidden />
            <dt className="text-muted-foreground">{series.label}</dt>
            <dd className="ml-auto tabular font-medium">
              {formatCurrency(series.key === 'receita' ? receita : despesa)}
            </dd>
          </div>
        ))}
      </dl>

      {/* Saldo só aparece quando há os dois lados: senão repete a linha de cima. */}
      {receita > 0 && despesa > 0 && (
        <div className="mt-2 flex items-center gap-2 border-t pt-2 text-sm">
          <dt className="text-muted-foreground">Saldo</dt>
          <dd className={cn('ml-auto tabular font-semibold', saldo >= 0 ? 'text-success' : 'text-destructive')}>
            {saldo >= 0 ? '+' : '−'}
            {formatCurrency(Math.abs(saldo))}
          </dd>
        </div>
      )}
    </div>
  )
}

/**
 * Receita x despesa por mês. Duas séries, um eixo só.
 *
 * As cores vêm de --chart-1/--chart-2, validadas para daltonismo e contraste
 * nos dois temas (ver docs/12-DASHBOARD.md). Verde é receita porque é a cor da
 * marca; despesa é azul, não vermelho — vermelho fica reservado para o que
 * está realmente ruim (vencido, atrasado), e verde x vermelho é justamente o
 * par que some na deuteranopia.
 */
export function CashflowChart({ data }: { data: CashflowPoint[] }) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null)
  const reducedMotion = usePrefersReducedMotion()

  const totals = React.useMemo(
    () =>
      data.reduce(
        (acc, point) => ({
          receita: acc.receita + point.receita,
          despesa: acc.despesa + point.despesa,
        }),
        { receita: 0, despesa: 0 },
      ),
    [data],
  )

  // Remontar quando os dados mudam de verdade é o que dispara a animação de
  // entrada de novo — e só aí. Trocar de aba ou passar o mouse não reanima.
  const dataSignature = React.useMemo(
    () => data.map((point) => `${point.month}:${point.receita}:${point.despesa}`).join('|'),
    [data],
  )

  const empty = totals.receita === 0 && totals.despesa === 0

  if (empty) {
    return (
      <div className="motion-enter flex h-[230px] flex-col items-center justify-center gap-1 rounded-md border border-dashed text-center">
        <p className="text-sm font-medium">Sem lançamentos no período</p>
        <p className="text-xs text-muted-foreground">
          Os valores aparecem aqui conforme as contas forem lançadas.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Legenda com o total de cada série: informa, não só identifica. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        {SERIES.map((series) => (
          <div key={series.key} className="flex items-baseline gap-2">
            <span
              className="size-2.5 shrink-0 translate-y-[-1px] rounded-full"
              style={{ background: series.color }}
              aria-hidden
            />
            <span className="text-xs text-muted-foreground">{series.label}</span>
            <span className="tabular text-sm font-medium">
              {formatCurrency(series.key === 'receita' ? totals.receita : totals.despesa)}
            </span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={230}>
        <BarChart
          key={dataSignature}
          data={data}
          margin={{ top: 8, right: 4, left: -14, bottom: 0 }}
          barGap={2}
          onMouseMove={(state) =>
            setActiveIndex(typeof state?.activeTooltipIndex === 'number' ? state.activeTooltipIndex : null)
          }
          onMouseLeave={() => setActiveIndex(null)}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} strokeDasharray="2 6" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={62}
            tickMargin={4}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickFormatter={shortCurrency}
          />
          <Tooltip
            cursor={{ fill: 'var(--foreground)', opacity: 0.04 }}
            content={<CashflowTooltip />}
            wrapperStyle={{ outline: 'none' }}
            animationDuration={reducedMotion ? 0 : 150}
          />

          {SERIES.map((series) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={series.label}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              isAnimationActive={!reducedMotion}
              animationDuration={700}
              animationEasing="ease-out"
            >
              {data.map((point, index) => (
                <Cell
                  key={point.month}
                  fill={series.color}
                  // Mês sob o cursor mantém 100%; os outros recuam — o olho
                  // vai direto para o período que está sendo lido.
                  fillOpacity={activeIndex === null || activeIndex === index ? 1 : 0.28}
                  style={{ transition: 'fill-opacity var(--motion-hover) var(--ease-out)' }}
                />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
