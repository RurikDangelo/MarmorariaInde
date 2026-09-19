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

const checkbox = z
  .union([z.string(), z.boolean()])
  .transform((value) => value === true || value === 'on' || value === 'true')
  .default(false)

const installationSchema = z.object({
  work_order_id: z.string().uuid(),
  team_id: optionalString,
  responsible_id: optionalString,
  scheduled_at: optionalString,
  status: z.enum(['AGENDADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'REAGENDADA', 'CANCELADA']).default('AGENDADA'),
  zip_code: optionalString,
  address: optionalString,
  address_number: optionalString,
  complement: optionalString,
  district: optionalString,
  city: optionalString,
  state: optionalString,
  notes: optionalString,
  reschedule_reason: optionalString,
  check_material: checkbox,
  check_pieces: checkbox,
  check_measures: checkbox,
  check_site_ready: checkbox,
  check_installed: checkbox,
  check_finish: checkbox,
  check_photos: checkbox,
  customer_present: checkbox,
})

export async function saveInstallation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('installations.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const parsed = installationSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: 'Revise os campos da instalação.', fieldErrors: zodToFieldErrors(parsed.error) }
  }

  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()

  const { error } = id
    ? await supabase.from('installations').update(parsed.data).eq('id', id)
    : await supabase.from('installations').insert(parsed.data)

  if (error) return { error: error.message }

  revalidatePath(`/os/${parsed.data.work_order_id}`)
  revalidatePath('/instalacoes')
  return { success: id ? 'Instalação atualizada.' : 'Instalação agendada.' }
}

/**
 * Conclui a instalação: marca o checklist como aprovado, encerra a OS
 * e registra tudo na timeline.
 */
export async function finishInstallation(
  installationId: string,
  workOrderId: string,
): Promise<ActionState> {
  try {
    await assertPermission('installations.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('installations')
    .update({ status: 'CONCLUIDA', finished_at: now, approved: true, approved_at: now })
    .eq('id', installationId)

  if (error) return { error: error.message }

  const { error: woError } = await supabase
    .from('work_orders')
    .update({ status_code: 'FINALIZADA', finished_at: now })
    .eq('id', workOrderId)

  if (woError) return { error: woError.message }

  await supabase
    .from('work_order_items')
    .update({ production_status: 'INSTALADO' })
    .eq('work_order_id', workOrderId)
    .neq('production_status', 'RETRABALHO')

  revalidatePath(`/os/${workOrderId}`)
  revalidatePath('/instalacoes')
  revalidatePath('/os')
  return { success: 'Instalação concluída e OS finalizada.' }
}
