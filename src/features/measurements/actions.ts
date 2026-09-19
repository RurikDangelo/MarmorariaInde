'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertPermission } from '@/lib/auth/session'
import { formToObject, zodToFieldErrors, type ActionState } from '@/features/work-orders/schema'

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === '' || value === 'NENHUM' ? null : value))
  .nullable()
  .optional()

const optionalUuid = optionalString.refine(
  (value) => !value || z.string().uuid().safeParse(value).success,
  'Identificador inválido',
)

const checkbox = z
  .union([z.string(), z.boolean()])
  .transform((value) => value === true || value === 'on' || value === 'true')
  .default(false)

const measurementSchema = z.object({
  work_order_id: z.string().uuid(),
  responsible_id: optionalUuid,
  team_id: optionalUuid,
  scheduled_at: optionalString,
  measured_at: optionalString,
  status: z.enum(['PENDENTE', 'AGENDADA', 'REALIZADA', 'APROVADA', 'REPROVADA']).default('PENDENTE'),
  zip_code: optionalString,
  address: optionalString,
  address_number: optionalString,
  complement: optionalString,
  district: optionalString,
  city: optionalString,
  state: optionalString,
  obstacles: optionalString,
  hydraulics_notes: optionalString,
  electrical_notes: optionalString,
  wall_notes: optionalString,
  notes: optionalString,
  check_measures: checkbox,
  check_square: checkbox,
  check_level: checkbox,
  check_wall: checkbox,
  check_sink: checkbox,
  check_cooktop: checkbox,
  check_faucet: checkbox,
  check_outlets: checkbox,
  check_hydraulics: checkbox,
  check_photos: checkbox,
  customer_present: checkbox,
})

export async function saveMeasurement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('measurements.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const parsed = measurementSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: 'Revise os campos da medição.', fieldErrors: zodToFieldErrors(parsed.error) }
  }

  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()

  const { error } = id
    ? await supabase.from('work_order_measurements').update(parsed.data).eq('id', id)
    : await supabase.from('work_order_measurements').insert(parsed.data)

  if (error) return { error: error.message }

  revalidatePath(`/os/${parsed.data.work_order_id}`)
  revalidatePath('/medicoes')
  return { success: id ? 'Medição atualizada.' : 'Medição registrada.' }
}

const measurementItemSchema = z.object({
  measurement_id: z.string().uuid(),
  environment: optionalString,
  description: z.string().trim().min(1, 'Descreva o ponto medido'),
  length_mm: z.coerce.number().int().min(0).default(0),
  width_mm: z.coerce.number().int().min(0).default(0),
  thickness_mm: z.coerce.number().int().min(0).optional().transform((value) => (value ? value : null)),
  quantity: z.coerce.number().min(0.01).default(1),
  notes: optionalString,
})

export async function saveMeasurementItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertPermission('measurements.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const parsed = measurementItemSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const id = String(formData.get('id') ?? '')
  const workOrderId = String(formData.get('work_order_id') ?? '')
  const supabase = await createClient()

  const { error } = id
    ? await supabase.from('work_order_measurement_items').update(parsed.data).eq('id', id)
    : await supabase.from('work_order_measurement_items').insert(parsed.data)

  if (error) return { error: error.message }

  if (workOrderId) revalidatePath(`/os/${workOrderId}`)
  return { success: 'Medida salva.' }
}

export async function deleteMeasurementItem(itemId: string, workOrderId: string): Promise<ActionState> {
  try {
    await assertPermission('measurements.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('work_order_measurement_items').delete().eq('id', itemId)
  if (error) return { error: error.message }

  revalidatePath(`/os/${workOrderId}`)
  return { success: 'Medida removida.' }
}

/** Aprova a medição e libera a OS para planejamento/produção. */
export async function approveMeasurement(
  measurementId: string,
  workOrderId: string,
): Promise<ActionState> {
  try {
    await assertPermission('measurements.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('work_order_measurements')
    .update({
      approved: true,
      approved_at: new Date().toISOString(),
      status: 'APROVADA',
      measured_at: new Date().toISOString(),
    })
    .eq('id', measurementId)

  if (error) return { error: error.message }

  revalidatePath(`/os/${workOrderId}`)
  revalidatePath('/medicoes')
  return { success: 'Medição aprovada.' }
}

/**
 * Copia as medidas conferidas para as peças da OS.
 * É o momento em que a medição vira produção.
 */
export async function importMeasurementItems(
  measurementId: string,
  workOrderId: string,
): Promise<ActionState> {
  try {
    await assertPermission('work_orders.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { data: items, error: readError } = await supabase
    .from('work_order_measurement_items')
    .select('*')
    .eq('measurement_id', measurementId)
    .order('sort_order')
    .returns<
      {
        environment: string | null
        description: string
        length_mm: number
        width_mm: number
        thickness_mm: number | null
        quantity: number
        notes: string | null
      }[]
    >()

  if (readError) return { error: readError.message }
  if (!items?.length) return { error: 'Nenhuma medida registrada para importar.' }

  const { error } = await supabase.from('work_order_items').insert(
    items.map((item, index) => ({
      work_order_id: workOrderId,
      sort_order: index,
      description: item.description,
      environment: item.environment,
      length_mm: item.length_mm,
      width_mm: item.width_mm,
      thickness_mm: item.thickness_mm,
      quantity: item.quantity,
      notes: item.notes,
    })),
  )

  if (error) return { error: error.message }

  await supabase.from('work_order_history').insert({
    work_order_id: workOrderId,
    event_type: 'MEDICAO',
    title: 'Medidas importadas para as peças',
    description: `${items.length} medida(s) viraram peças da OS.`,
  })

  revalidatePath(`/os/${workOrderId}`)
  return { success: `${items.length} peça(s) criada(s) a partir da medição.` }
}
