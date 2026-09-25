import { cn } from '@/lib/utils'

/**
 * Bloco de carregamento.
 *
 * O brilho percorre o bloco em vez de pulsar: pulsação em vários blocos ao
 * mesmo tempo fica piscando na tela. A faixa é quase imperceptível de
 * propósito — 6% de luz sobre o fundo, o suficiente para dizer "carregando"
 * sem competir com o conteúdo que vai chegar.
 *
 * Com `prefers-reduced-motion`, a regra global em globals.css para o brilho e
 * sobra só o bloco neutro.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        'after:absolute after:inset-0 after:bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--foreground)_6%,transparent),transparent)] after:bg-[length:200%_100%]',
        'after:animate-[motion-shimmer_1.6s_ease-in-out_infinite] after:content-[""]',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
