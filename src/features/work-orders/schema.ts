import { z } from 'zod'

/** '' e 'NENHUM' (placeholder dos selects) viram null no banco. */
const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === '' || value === 'NENHUM' ? null : value))
  .nullable()
  .optional()

export const statusChangeSchema = z.object({
  work_order_id: z.string().uuid(),
  status_code: z.string().min(1, 'Informe o novo status'),
  note: optionalString,
})

export const cancelWorkOrderSchema = z.object({
  work_order_id: z.string().uuid(),
  reason: z.string().trim().min(3, 'Explique o motivo do cancelamento'),
})

export const noteSchema = z.object({
  work_order_id: z.string().uuid(),
  title: z.string().trim().min(1).default('Observação'),
  description: z.string().trim().min(1, 'Escreva a observação'),
})

/** Converte FormData em objeto simples para o Zod. */
export function formToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue
    result[key] = value
  }
  return result
}

export interface ActionState {
  error?: string
  success?: string
  fieldErrors?: Record<string, string>
  /** Registro gravado, quando a tela precisa usar na hora (ex.: cliente criado na OS). */
  data?: unknown
}

export function zodToFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return fieldErrors
}
