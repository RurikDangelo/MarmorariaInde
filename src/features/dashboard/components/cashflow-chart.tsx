'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface Point {
  month: string
  receita: number
  despesa: number
}

/**
 * Receita x despesa por mês. Duas séries, um único eixo.
 * Cores vêm dos tokens --chart-1/--chart-2, validados para daltonismo.
 */
export function CashflowChart({ data }: { data: Point[] }) {
  const empty = data.every((point) => point.receita === 0 && point.despesa === 0)

  if (empty) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Sem lançamentos financeiros no período.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={72}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          tickFormatter={(value: number) =>
            value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)
          }
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          contentStyle={{
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--popover-foreground)',
          }}
          labelStyle={{ color: 'var(--muted-foreground)', marginBottom: 4 }}
          formatter={(value, name) => [formatCurrency(Number(value ?? 0)), String(name)]}
        />
        <Legend
          verticalAlign="top"
          align="left"
          height={28}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }}
        />
        <Bar dataKey="receita" name="Receita" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={26} />
        <Bar dataKey="despesa" name="Despesa" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  )
}
