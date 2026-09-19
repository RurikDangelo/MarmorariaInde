'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertPermission } from '@/lib/auth/session'
import { formToObject, type ActionState } from '@/features/work-orders/schema'

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === '' || value === 'NENHUM' ? null : value))
  .nullable()
  .optional()

const recordSchema = z.object({
  work_order_id: z.string().uuid(),
  work_order_item_id: optionalString,
  step_code: z.string().min(1, 'Selecione a etapa'),
  responsible_id: optionalString,
  team_id: optionalString,
  notes: optionalString,
  is_rework: z
    .union([z.string(), z.boolean()])
    .transform((value) => value === true || value === 'on' || value === 'true')
    .default(false),
  rework_reason: optionalString,
})

export async function startProductionStep(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertPermission('production.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const parsed = recordSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('production_records').insert({
    ...parsed.data,
    status: 'EM_ANDAMENTO',
    started_at: new Date().toISOString(),
  })

  if (error) return { error: error.message }

  revalidatePath(`/os/${parsed.data.work_order_id}`)
  revalidatePath('/producao')
  return { success: 'Etapa iniciada.' }
}

export async function updateProductionStatus(
  recordId: string,
  workOrderId: string,
  status: 'EM_ANDAMENTO' | 'PAUSADO' | 'CONCLUIDO' | 'RETRABALHO',
): Promise<ActionState> {
  try {
    await assertPermission('production.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const patch: Record<string, unknown> = { status }
  if (status === 'CONCLUIDO') patch.finished_at = new Date().toISOString()
  if (status === 'EM_ANDAMENTO') patch.finished_at = null

  const supabase = await createClient()
  const { error } = await supabase.from('production_records').update(patch).eq('id', recordId)
  if (error) return { error: error.message }

  revalidatePath(`/os/${workOrderId}`)
  revalidatePath('/producao')
  return { success: 'Apontamento atualizado.' }
}

export async function deleteProductionRecord(
  recordId: string,
  workOrderId: string,
): Promise<ActionState> {
  try {
    await assertPermission('production.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('production_records').delete().eq('id', recordId)
  if (error) return { error: error.message }

  revalidatePath(`/os/${workOrderId}`)
  return { success: 'Apontamento removido.' }
}
