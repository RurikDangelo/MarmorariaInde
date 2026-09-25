'use client'

import * as React from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

const getSnapshot = () => window.matchMedia(QUERY).matches

// No servidor assumimos movimento normal; o valor real chega na hidratação,
// antes de qualquer animação começar.
const getServerSnapshot = () => false

/**
 * O CSS já corta as animações declarativas por media query. Este hook existe
 * para o que o CSS não alcança: animação controlada em JavaScript (Recharts,
 * count-up). Sem ele, quem pediu menos movimento continuaria vendo as barras
 * crescerem.
 *
 * É `useSyncExternalStore` e não `useEffect` + `useState` porque a preferência
 * é estado que mora fora do React: assim não há render extra na montagem nem
 * risco de ler um valor desatualizado.
 */
export function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
