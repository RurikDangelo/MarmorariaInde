'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { assertPermission } from '@/lib/auth/session'
import {
  cancelWorkOrderSchema,
  formToObject,
  noteSchema,
  statusChangeSchema,
  workOrderItemSchema,
  workOrderSchema,
  zodToFieldErrors,
  type ActionState,
} from './schema'

function fail(error: unknown): ActionState {
  const message = error instanceof Error ? error.message : 'Erro inesperado. Tente novamente.'
  return { error: message }
}

/* ------------------------------------------------------------------ */
/* Criar / editar OS                                                   */
/* ------------------------------------------------------------------ */

export async function createWorkOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('work_orders.write')
  } catch (error) {
    return fail(error)
  }

  const parsed = workOrderSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: 'Revise os campos destacados.', fieldErrors: zodToFieldErrors(parsed.error) }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('work_orders')
    .insert(parsed.data)
    .select('id')
    .single<{ id: string }>()

  if (error) return { error: error.message }

  revalidatePath('/os')
  revalidatePath('/dashboard')
  redirect(`/os/${data.id}`)
}

export async function updateWorkOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('work_orders.write')
  } catch (error) {
    return fail(error)
  }

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'OS não identificada.' }

  const parsed = workOrderSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: 'Revise os campos destacados.', fieldErrors: zodToFieldErrors(parsed.error) }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('work_orders').update(parsed.data).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath(`/os/${id}`)
  revalidatePath('/os')
  return { success: 'Ordem de serviço atualizada.' }
}

/* ------------------------------------------------------------------ */
/* Fluxo: status, cancelamento, finalização                            */
/* ------------------------------------------------------------------ */

export async function changeWorkOrderStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertPermission('work_orders.status')
  } catch (error) {
    return fail(error)
  }

  const parsed = statusChangeSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: 'Não foi possível mudar o status.' }

  const supabase = await createClient()
  const { work_order_id, status_code, note } = parsed.data

  const { data: status } = await supabase
    .from('work_order_statuses')
    .select('code, is_terminal')
    .eq('code', status_code)
    .maybeSingle<{ code: string; is_terminal: boolean }>()

  if (!status) return { error: 'Status inválido.' }

  const patch: Record<string, unknown> = { status_code }
  if (status.is_terminal && status.code !== 'CANCELADA') {
    patch.finished_at = new Date().toISOString()
  } else {
    patch.finished_at = null
  }

  const { error } = await supabase.from('work_orders').update(patch).eq('id', work_order_id)
  if (error) return { error: error.message }

  if (note) {
    await supabase.from('work_order_history').insert({
      work_order_id,
      event_type: 'OBSERVACAO',
      title: 'Observação na mudança de etapa',
      description: note,
    })
  }

  revalidatePath(`/os/${work_order_id}`)
  revalidatePath('/os')
  revalidatePath('/os/kanban')
  revalidatePath('/dashboard')
  return { success: 'Etapa atualizada.' }
}

/** Usado pelo drag and drop do Kanban. */
export async function moveWorkOrder(workOrderId: string, statusCode: string): Promise<ActionState> {
  try {
    await assertPermission('work_orders.status')
  } catch (error) {
    return fail(error)
  }

  const supabase = await createClient()
  const { data: status } = await supabase
    .from('work_order_statuses')
    .select('code, is_terminal')
    .eq('code', statusCode)
    .maybeSingle<{ code: string; is_terminal: boolean }>()

  if (!status) return { error: 'Status inválido.' }

  const { error } = await supabase
    .from('work_orders')
    .update({
      status_code: statusCode,
      finished_at: status.is_terminal && status.code !== 'CANCELADA' ? new Date().toISOString() : null,
    })
    .eq('id', workOrderId)

  if (error) return { error: error.message }

  revalidatePath('/os/kanban')
  revalidatePath('/os')
  revalidatePath(`/os/${workOrderId}`)
  return { success: 'Etapa atualizada.' }
}

export async function cancelWorkOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('work_orders.write')
  } catch (error) {
    return fail(error)
  }

  const parsed = cancelWorkOrderSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Informe o motivo.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('work_orders')
    .update({
      cancelled_at: new Date().toISOString(),
      cancel_reason: parsed.data.reason,
      status_code: 'CANCELADA',
    })
    .eq('id', parsed.data.work_order_id)

  if (error) return { error: error.message }

  revalidatePath(`/os/${parsed.data.work_order_id}`)
  revalidatePath('/os')
  return { success: 'Ordem de serviço cancelada.' }
}

export async function addWorkOrderNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('work_orders.write')
  } catch (error) {
    return fail(error)
  }

  const parsed = noteSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Escreva a observação.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('work_order_history').insert({
    work_order_id: parsed.data.work_order_id,
    event_type: 'OBSERVACAO',
    title: parsed.data.title,
    description: parsed.data.description,
  })

  if (error) return { error: error.message }

  revalidatePath(`/os/${parsed.data.work_order_id}`)
  return { success: 'Observação registrada.' }
}

/* ------------------------------------------------------------------ */
/* Itens da OS                                                         */
/* ------------------------------------------------------------------ */

export async function saveWorkOrderItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('work_orders.write')
  } catch (error) {
    return fail(error)
  }

  const parsed = workOrderItemSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: 'Revise os campos da peça.', fieldErrors: zodToFieldErrors(parsed.error) }
  }

  const itemId = String(formData.get('id') ?? '')
  const supabase = await createClient()

  const { error } = itemId
    ? await supabase.from('work_order_items').update(parsed.data).eq('id', itemId)
    : await supabase.from('work_order_items').insert(parsed.data)

  if (error) return { error: error.message }

  await supabase.from('work_order_history').insert({
    work_order_id: parsed.data.work_order_id,
    event_type: 'OBSERVACAO',
    title: itemId ? 'Peça atualizada' : 'Peça adicionada',
    description: parsed.data.description,
  })

  revalidatePath(`/os/${parsed.data.work_order_id}`)
  return { success: itemId ? 'Peça atualizada.' : 'Peça adicionada.' }
}

export async function deleteWorkOrderItem(itemId: string, workOrderId: string): Promise<ActionState> {
  try {
    await assertPermission('work_orders.write')
  } catch (error) {
    return fail(error)
  }

  const supabase = await createClient()
  const { error } = await supabase.from('work_order_items').delete().eq('id', itemId)
  if (error) return { error: error.message }

  revalidatePath(`/os/${workOrderId}`)
  return { success: 'Peça removida.' }
}

export async function updateItemProductionStatus(
  itemId: string,
  workOrderId: string,
  status: string,
): Promise<ActionState> {
  try {
    await assertPermission('production.write')
  } catch (error) {
    return fail(error)
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('work_order_items')
    .update({ production_status: status })
    .eq('id', itemId)

  if (error) return { error: error.message }

  revalidatePath(`/os/${workOrderId}`)
  return { success: 'Situação da peça atualizada.' }
}
