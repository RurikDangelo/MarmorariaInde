import { z } from 'zod'

/** '' e 'NENHUM' (placeholder dos selects) viram null no banco. */
const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === '' || value === 'NENHUM' ? null : value))
  .nullable()
  .optional()

const optionalUuid = z
  .string()
  .trim()
  .transform((value) => (value === '' || value === 'NENHUM' ? null : value))
  .nullable()
  .optional()
  .refine((value) => value === null || value === undefined || z.string().uuid().safeParse(value).success, {
    message: 'Identificador inválido',
  })

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional()

const numberFromForm = (fallback = 0) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => {
      if (typeof value === 'number') return value
      const normalized = value.trim().replace(/\./g, '').replace(',', '.')
      const parsed = Number(normalized)
      return Number.isFinite(parsed) ? parsed : fallback
    })
    .default(fallback)

const intFromForm = (fallback = 0) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => {
      const parsed = typeof value === 'number' ? value : Number(value.trim() || fallback)
      return Number.isFinite(parsed) ? Math.round(parsed) : fallback
    })
    .default(fallback)

const boolFromForm = z
  .union([z.string(), z.boolean()])
  .transform((value) => value === true || value === 'on' || value === 'true' || value === '1')
  .default(false)

export const workOrderSchema = z.object({
  customer_id: z.string().uuid('Selecione o cliente'),
  title: optionalString,
  priority: z.enum(['BAIXA', 'NORMAL', 'ALTA', 'URGENTE']).default('NORMAL'),
  status_code: z.string().min(1).optional(),
  assigned_to: optionalUuid,
  team_id: optionalUuid,
  deadline: optionalDate,
  scheduled_measurement_at: optionalDate,
  scheduled_install_at: optionalDate,
  zip_code: optionalString,
  address: optionalString,
  address_number: optionalString,
  complement: optionalString,
  district: optionalString,
  city: optionalString,
  state: optionalString,
  discount: numberFromForm(0),
  notes: optionalString,
  internal_notes: optionalString,
})

export type WorkOrderInput = z.infer<typeof workOrderSchema>

export const workOrderItemSchema = z.object({
  work_order_id: z.string().uuid(),
  description: z.string().trim().min(1, 'Descreva a peça'),
  environment: optionalString,
  material_id: optionalUuid,
  color: optionalString,
  thickness_mm: intFromForm(0).transform((value) => (value > 0 ? value : null)),
  length_mm: intFromForm(0),
  width_mm: intFromForm(0),
  quantity: numberFromForm(1).refine((value) => value > 0, 'Quantidade deve ser maior que zero'),
  pricing_mode: z.enum(['M2', 'ML', 'UN']).default('M2'),
  unit_price: numberFromForm(0),
  finish: optionalString,
  edge: optionalString,
  skirt_mm: intFromForm(0).transform((value) => (value > 0 ? value : null)),
  backsplash_mm: intFromForm(0).transform((value) => (value > 0 ? value : null)),
  cutouts: intFromForm(0),
  has_sink: boolFromForm,
  sink_type: optionalString,
  sink_quantity: intFromForm(0),
  has_cooktop: boolFromForm,
  cooktop_type: optionalString,
  faucet_holes: intFromForm(0),
  outlet_holes: intFromForm(0),
  extra_holes: intFromForm(0),
  notes: optionalString,
})

export type WorkOrderItemInput = z.infer<typeof workOrderItemSchema>

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
}

export function zodToFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return fieldErrors
}
