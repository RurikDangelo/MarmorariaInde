'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertPermission } from '@/lib/auth/session'
import { actionError, actionOk, type ActionResult } from '@/lib/action-result'
import { removeStoredFiles, type StoredFile } from '@/lib/storage'
import {
  cancelWorkOrderSchema,
  formToObject,
  noteSchema,
  statusChangeSchema,
  type ActionState,
} from './schema'

function fail(error: unknown): ActionState {
  const message = error instanceof Error ? error.message : 'Erro inesperado. Tente novamente.'
  return { error: message }
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
/* Reativar e excluir                                                  */
/* ------------------------------------------------------------------ */

/** Desfaz o cancelamento e devolve a OS para a etapa que ela tinha antes. */
export async function reactivateWorkOrder(workOrderId: string): Promise<ActionResult> {
  try {
    await assertPermission('work_orders.write')
    const supabase = await createClient()
    const { data, error } = await supabase
      .rpc('reactivate_work_order', { p_work_order_id: z.guid().parse(workOrderId) })
      .returns<string>()
    if (error) return actionError(error)

    revalidatePath(`/os/${workOrderId}`)
    revalidatePath('/os')
    revalidatePath('/os/kanban')
    return actionOk(null, `OS reativada em ${data ?? 'Novas'}.`)
  } catch (error) {
    return actionError(error)
  }
}

/**
 * Exclui a OS do banco com tudo que pendura nela (ambientes, produtos, peças,
 * medições, produção, instalação, anexos). O banco recusa se houver lançamento
 * já baixado e devolve os arquivos que ficaram órfãos no Storage.
 */
export async function deleteWorkOrder(workOrderId: string, reason?: string): Promise<ActionResult> {
  try {
    await assertPermission('work_orders.delete')
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('delete_work_order', {
      p_work_order_id: z.guid().parse(workOrderId),
      p_reason: z.string().trim().max(500).optional().parse(reason) || null,
    })
    if (error) return actionError(error)

    // a funcao devolve um jsonb; o client sem tipos gerados nao sabe a forma
    const removed = data as { number: string; files: StoredFile[] } | null
    await removeStoredFiles(removed?.files ?? [])
    revalidatePath('/os')
    revalidatePath('/os/kanban')
    revalidatePath('/dashboard')
    return actionOk(null, `${removed?.number ?? 'Ordem de serviço'} excluída.`)
  } catch (error) {
    return actionError(error)
  }
}
