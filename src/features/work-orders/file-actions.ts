'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertPermission } from '@/lib/auth/session'
import type { ActionState } from '@/features/work-orders/schema'

/** Registra no banco um arquivo já enviado ao Storage pelo browser. */
export async function registerWorkOrderPhoto(input: {
  workOrderId: string
  storagePath: string
  stage: string
  caption?: string
}): Promise<ActionState> {
  try {
    await assertPermission('work_orders.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('work_order_photos').insert({
    work_order_id: input.workOrderId,
    storage_path: input.storagePath,
    stage: input.stage,
    caption: input.caption ?? null,
  })

  if (error) return { error: error.message }

  await supabase.from('work_order_history').insert({
    work_order_id: input.workOrderId,
    event_type: 'ANEXO',
    title: 'Foto anexada',
    description: input.caption ?? null,
  })

  revalidatePath(`/os/${input.workOrderId}`)
  return { success: 'Foto anexada.' }
}

export async function registerWorkOrderAttachment(input: {
  workOrderId: string
  storagePath: string
  fileName: string
  mimeType: string | null
  sizeBytes: number | null
  kind: string
}): Promise<ActionState> {
  try {
    await assertPermission('work_orders.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('work_order_attachments').insert({
    work_order_id: input.workOrderId,
    storage_path: input.storagePath,
    file_name: input.fileName,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    kind: input.kind,
  })

  if (error) return { error: error.message }

  await supabase.from('work_order_history').insert({
    work_order_id: input.workOrderId,
    event_type: 'ANEXO',
    title: 'Arquivo anexado',
    description: input.fileName,
  })

  revalidatePath(`/os/${input.workOrderId}`)
  return { success: 'Arquivo anexado.' }
}

export async function deleteWorkOrderFile(
  table: 'work_order_photos' | 'work_order_attachments',
  id: string,
  storagePath: string,
  workOrderId: string,
): Promise<ActionState> {
  try {
    await assertPermission('work_orders.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) return { error: error.message }

  await supabase.storage.from('os-arquivos').remove([storagePath])

  revalidatePath(`/os/${workOrderId}`)
  return { success: 'Arquivo removido.' }
}

/** URL assinada temporária para exibir/baixar um arquivo privado. */
export async function getSignedUrl(storagePath: string, bucket = 'os-arquivos'): Promise<string | null> {
  try {
    await assertPermission('work_orders.read')
  } catch {
    return null
  }

  const supabase = await createClient()
  const { data } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 60 * 30)
  return data?.signedUrl ?? null
}
