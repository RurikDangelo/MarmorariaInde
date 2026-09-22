'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertPermission } from '@/lib/auth/session'
import { actionError, actionOk, type ActionResult } from '@/lib/action-result'

const text = (max: number) => z.string().trim().max(max)
const money = z.number().min(0, 'Valor não pode ser negativo').max(99_999_999)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Data e hora inválidas')

const headerSchema = z
  .object({
    id: z.guid().nullable(),
    customer_id: z.guid('Escolha o cliente'),
    title: text(120),
    priority: z.enum(['BAIXA', 'NORMAL', 'ALTA', 'URGENTE']),
    seller_id: z.guid().nullable(),
    assigned_to: z.guid().nullable(),
    team_id: z.guid().nullable(),
    deadline: isoDate.nullable(),
    scheduled_measurement_at: isoDateTime.nullable(),
    scheduled_install_at: isoDateTime.nullable(),
    payment_type: z.enum(['A_VISTA', 'A_PRAZO']),
    payment_method: z.enum(['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'BOLETO', 'TRANSFERENCIA', 'CHEQUE', 'OUTRO']).nullable(),
    payment_terms: text(120),
    site_details: text(2000),
    zip_code: text(9),
    address: text(200),
    address_number: text(20),
    complement: text(100),
    district: text(100),
    city: text(100),
    state: text(2),
    freight: money,
    surcharge: money,
    discount: money,
    notes: text(4000),
    internal_notes: text(4000),
  })
  .strict()

export type WorkOrderHeaderInput = z.infer<typeof headerSchema>

/** '' vira null no banco (campos opcionais). */
function blankToNull<T extends Record<string, unknown>>(row: T) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === '' ? null : value]))
}

/**
 * Grava o cabecalho da OS. Sem id cria a OS (montagem nova) — e o que acontece
 * na primeira acao da tela de Nova OS, sem sair dela.
 */
export async function saveWorkOrderHeader(
  input: WorkOrderHeaderInput,
): Promise<ActionResult<{ id: string; number: string }>> {
  try {
    await assertPermission('work_orders.write')
    const parsed = headerSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revise os dados da OS.' }

    const { id, ...fields } = parsed.data
    const row = blankToNull(fields)
    const supabase = await createClient()

    const query = id
      ? supabase.from('work_orders').update(row).eq('id', id)
      : supabase.from('work_orders').insert({ ...row, items_model: 2 })
    const { data, error } = await query.select('id, number').single<{ id: string; number: string }>()
    if (error) return actionError(error)

    revalidatePath('/os')
    revalidatePath('/os/kanban')
    revalidatePath(`/os/${data.id}`)
    revalidatePath('/dashboard')
    return actionOk(data, id ? 'Dados da OS salvos.' : `OS ${data.number} criada.`)
  } catch (error) {
    return actionError(error)
  }
}
