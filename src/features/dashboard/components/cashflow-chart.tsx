'use client'

import * as React from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { TrendingDown, TrendingUp } from 'lucide-react'
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
      className={cn(
        'animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-[var(--motion-micro)]',
        // Vidro: aqui faz sentido, é elemento flutuante sobre o gráfico.
        'min-w-[13.5rem] rounded-xl border border-border-strong bg-popover/80 p-3.5 shadow-[var(--shadow-lift)] backdrop-blur-xl',
      )}
    >
      <p className="text-eyebrow mb-3 text-muted-foreground">{label}</p>

      <dl className="flex flex-col gap-2">
        {SERIES.map((series) => (
          <div key={series.key} className="flex items-center gap-2.5">
            <span
              className="size-2.5 shrink-0 rounded-full ring-2"
              style={{
                background: series.color,
                // @ts-expect-error -- custom property aceita string
                '--tw-ring-color': `color-mix(in oklab, ${series.color} 25%, transparent)`,
              }}
              aria-hidden
            />
            <dt className="text-sm text-muted-foreground">{series.label}</dt>
            <dd className="ml-auto text-sm font-semibold tabular">
              {formatCurrency(series.key === 'receita' ? receita : despesa)}
            </dd>
          </div>
        ))}
      </dl>

      {/* Saldo só aparece quando há os dois lados: senão repete a linha de cima. */}
      {receita > 0 && despesa > 0 && (
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          <dt className="text-sm text-muted-foreground">Saldo</dt>
          <dd
            className={cn(
              'ml-auto inline-flex items-center gap-1 text-sm font-bold tabular',
              saldo >= 0 ? 'text-success' : 'text-destructive',
            )}
          >
            {saldo >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {formatCurrency(Math.abs(saldo))}
          </dd>
        </div>
      )}
    </div>
  )
}

/**
 * Receita x despesa por mês — área com gradiente, um eixo só.
 *
 * Área e não barra: com seis meses o que importa é a *trajetória* do caixa, e
 * a linha mostra isso de relance. A barra mostrava seis valores isolados.
 *
 * As cores vêm de --chart-1/--chart-2, validadas para daltonismo e contraste
 * nos dois temas (ver docs/12-DASHBOARD.md). Verde é receita porque é a cor da
 * marca; despesa é azul, não vermelho — vermelho fica reservado para o que
 * está realmente ruim, e verde x vermelho é o par que some na deuteranopia.
 */
export function CashflowChart({ data }: { data: CashflowPoint[] }) {
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
  // desenho de novo — e só aí. Passar o mouse não redesenha.
  const dataSignature = React.useMemo(
    () => data.map((point) => `${point.month}:${point.receita}:${point.despesa}`).join('|'),
    [data],
  )

  const saldo = totals.receita - totals.despesa
  const empty = totals.receita === 0 && totals.despesa === 0

  if (empty) {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center">
        <p className="text-base font-semibold">Sem lançamentos no período</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Assim que houver contas a receber ou a pagar, a evolução do caixa aparece aqui.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Resumo do período: identifica as séries e já entrega o número. */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        {SERIES.map((series) => {
          const total = series.key === 'receita' ? totals.receita : totals.despesa
          return (
            <div key={series.key} className="flex flex-col gap-1">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: series.color }} aria-hidden />
                <span className="text-eyebrow text-muted-foreground">{series.label}</span>
              </span>
              <span className="text-metric-sm">{formatCurrency(total)}</span>
            </div>
          )
        })}

        {/* Saldo só quando existem os dois lados. */}
        {totals.receita > 0 && totals.despesa > 0 && (
          <div className="flex flex-col gap-1 border-l border-border pl-8">
            <span className="text-eyebrow text-muted-foreground">Saldo</span>
            <span
              className={cn(
                'text-metric-sm inline-flex items-center gap-1.5',
                saldo >= 0 ? 'text-success' : 'text-destructive',
              )}
            >
              {saldo >= 0 ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
              {formatCurrency(Math.abs(saldo))}
            </span>
          </div>
        )}
      </div>

      {totals.despesa === 0 && (
        <p className="-mt-2 text-sm text-muted-foreground">
          Sem despesas registradas no período — a área azul aparece quando houver contas a pagar.
        </p>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart key={dataSignature} data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
          <defs>
            {SERIES.map((series) => (
              <linearGradient key={series.key} id={`fill-${series.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={series.color} stopOpacity={0.35} />
                <stop offset="60%" stopColor={series.color} stopOpacity={0.08} />
                <stop offset="100%" stopColor={series.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.55} strokeDasharray="2 7" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={12}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 500 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            tickMargin={6}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickFormatter={shortCurrency}
          />
          <Tooltip
            cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1, strokeDasharray: '4 4' }}
            content={<CashflowTooltip />}
            wrapperStyle={{ outline: 'none' }}
            animationDuration={reducedMotion ? 0 : 150}
          />

          {SERIES.map((series, order) => (
            <Area
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={series.color}
              strokeWidth={2.5}
              fill={`url(#fill-${series.key})`}
              // Ponto sempre visível: com um mês só de dados, sem ponto não
              // haveria nada para ver — a linha precisaria de dois pontos.
              dot={{ r: 3, fill: 'var(--card)', stroke: series.color, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: series.color, stroke: 'var(--card)', strokeWidth: 3 }}
              isAnimationActive={!reducedMotion}
              animationDuration={1000}
              animationBegin={order * 120}
              animationEasing="ease-out"
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
