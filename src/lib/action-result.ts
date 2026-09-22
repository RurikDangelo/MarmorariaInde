/**
 * Retorno das Server Actions chamadas com JSON (fora de <form>).
 * As actions de formulario continuam usando ActionState (features/work-orders/schema).
 */
export type ActionResult<T = null> = { ok: true; data: T; message?: string } | { ok: false; error: string }

export function actionOk<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message }
}

export function actionError(error: unknown): { ok: false; error: string } {
  if (error instanceof Error) return { ok: false, error: error.message }
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return { ok: false, error: error.message }
  }
  return { ok: false, error: 'Erro inesperado. Tente novamente.' }
}
