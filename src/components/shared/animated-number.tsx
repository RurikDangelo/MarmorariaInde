'use client'

import * as React from 'react'
import { formatArea, formatCurrency, formatNumber } from '@/lib/utils'

export type NumberFormat = 'currency' | 'integer' | 'decimal' | 'area' | 'percent'

function render(value: number, format: NumberFormat): string {
  switch (format) {
    case 'currency':
      return formatCurrency(value)
    case 'area':
      return formatArea(value)
    case 'percent':
      return `${formatNumber(value, 1)}%`
    case 'decimal':
      return formatNumber(value, 1)
    default:
      return String(Math.round(value))
  }
}

/** useLayoutEffect no browser, useEffect no servidor (evita o warning de SSR). */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect

/**
 * Número que conta até o valor. Três cuidados que fazem a diferença:
 *
 * - **SSR correto**: o estado inicial é o valor final, então o HTML do servidor
 *   já traz o número certo. Quem está sem JS vê o valor, não um zero.
 * - **Sem piscar**: a volta para zero acontece em layout effect, antes do
 *   browser pintar — o usuário nunca vê o "0".
 * - **Não reconta à toa**: só anima quando o valor realmente muda (ref de
 *   comparação), não a cada render do pai.
 */
export function AnimatedNumber({
  value,
  format = 'integer',
  duration = 650,
  className,
}: {
  value: number
  format?: NumberFormat
  duration?: number
  className?: string
}) {
  const [display, setDisplay] = React.useState(value)
  const previous = React.useRef<number | null>(null)
  const frame = React.useRef<number | null>(null)

  useIsomorphicLayoutEffect(() => {
    if (previous.current === value) return

    const from = previous.current ?? 0
    previous.current = value

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || duration <= 0 || from === value) {
      setDisplay(value)
      return
    }

    // Valores grandes não ganham nada em contar mais tempo.
    const span = Math.min(duration, 400 + Math.min(Math.abs(value - from), 1000) * 0.3)
    const start = performance.now()
    setDisplay(from)

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / span)
      // easeOutExpo: quase todo o caminho no começo, chegada macia
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setDisplay(from + (value - from) * eased)
      if (progress < 1) frame.current = requestAnimationFrame(tick)
    }

    frame.current = requestAnimationFrame(tick)

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
    }
  }, [value, duration])

  React.useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    },
    [],
  )

  return (
    <span className={className} suppressHydrationWarning>
      {render(display, format)}
    </span>
  )
}
