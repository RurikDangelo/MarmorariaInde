'use client'

import { useActionState } from 'react'
import { toast } from 'sonner'
import type { ActionState } from '@/features/work-orders/schema'

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>

interface Options {
  /** Roda depois de um resultado de sucesso: fechar diálogo, dar refresh, limpar form. */
  onSuccess?: (state: ActionState) => void
  /** Desliga o toast automático de sucesso (quando a própria tela já dá o feedback). */
  silentSuccess?: boolean
}

/**
 * Envolve uma Server Action e trata o retorno (toast + efeito colateral) dentro da
 * própria action.
 *
 * Por que não um useEffect observando o state: chamar setState dentro de efeito causa
 * render em cascata e é sinalizado pelo compilador do React 19. Aqui o efeito acontece
 * no momento em que a resposta chega, uma vez só.
 */
export function useActionForm(action: ServerAction, options: Options = {}) {
  const { onSuccess, silentSuccess = false } = options

  return useActionState<ActionState, FormData>(async (previous, formData) => {
    const result = await action(previous, formData)

    if (result.success) {
      if (!silentSuccess) toast.success(result.success)
      onSuccess?.(result)
    } else if (result.error) {
      toast.error(result.error)
    }

    return result
  }, {})
}
