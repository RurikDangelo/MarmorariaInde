'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertPermission } from '@/lib/auth/session'
import { actionError, actionOk, type ActionResult } from '@/lib/action-result'
import { documentRefSchema } from './schema'
import type { DocumentRef } from './types'

const money = z.number().min(0).max(99_999_999)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')

function documentPath(doc: DocumentRef) {
  return doc.kind === 'quote' ? `/orcamentos/${doc.id}` : `/os/${doc.id}`
}

const reserveSchema = z
  .object({
    id: z.guid().nullable(),
    professional_name: z.string().trim().min(1, 'Informe o profissional').max(120),
    professional_phone: z.string().trim().max(30),
    professional_document: z.string().trim().max(30),
    pix_key: z.string().trim().max(120),
    percentage: z.number().min(0).max(100).nullable(),
    amount: money,
    notes: z.string().trim().max(500),
  })
  .strict()

export type TechnicalReserveInput = z.infer<typeof reserveSchema>

/** RT (reserva tecnica) do arquiteto/designer. Com percentual, acompanha o total. */
export async function saveTechnicalReserve(doc: DocumentRef, input: TechnicalReserveInput): Promise<ActionResult<string>> {
  try {
    const ref = documentRefSchema.parse(doc)
    await assertPermission(ref.kind === 'quote' ? 'quotes.write' : 'work_orders.write')
    const parsed = reserveSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revise a RT.' }
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('save_technical_reserve', {
      p_reserve: {
        ...parsed.data,
        quote_id: ref.kind === 'quote' ? ref.id : null,
        work_order_id: ref.kind === 'work_order' ? ref.id : null,
      },
    })
    if (error) return actionError(error)
    revalidatePath(documentPath(ref))
    return actionOk(data as string, 'RT salva.')
  } catch (error) {
    return actionError(error)
  }
}

export async function deleteTechnicalReserve(doc: DocumentRef, reserveId: string): Promise<ActionResult> {
  try {
    const ref = documentRefSchema.parse(doc)
    await assertPermission(ref.kind === 'quote' ? 'quotes.write' : 'work_orders.write')
    const supabase = await createClient()
    const { error } = await supabase.rpc('delete_technical_reserve', { p_reserve_id: z.guid().parse(reserveId) })
    if (error) return actionError(error)
    revalidatePath(documentPath(ref))
    return actionOk(null, 'RT removida.')
  } catch (error) {
    return actionError(error)
  }
}

/** RT da OS vira conta a pagar no financeiro. */
export async function launchTechnicalReserve(workOrderId: string, reserveId: string, dueDate: string): Promise<ActionResult> {
  try {
    await assertPermission('financial.write')
    const supabase = await createClient()
    const { error } = await supabase.rpc('launch_technical_reserve', {
      p_reserve_id: z.guid().parse(reserveId),
      p_due_date: isoDate.parse(dueDate),
    })
    if (error) return actionError(error)
    revalidatePath(`/os/${z.guid().parse(workOrderId)}`)
    revalidatePath('/financeiro')
    return actionOk(null, 'RT lançada em contas a pagar.')
  } catch (error) {
    return actionError(error)
  }
}

const receivableSchema = z
  .object({
    due_date: isoDate,
    amount: z.number().gt(0, 'Parcela precisa ter valor').max(99_999_999),
    payment_method: z.enum(['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'BOLETO', 'TRANSFERENCIA', 'CHEQUE', 'OUTRO']).nullable(),
    notes: z.string().trim().max(200),
  })
  .strict()

/** Parcelas da OS direto no contas a receber (OS sem orcamento ou aprovada sem gerar). */
export async function generateReceivables(
  workOrderId: string,
  installments: z.infer<typeof receivableSchema>[],
): Promise<ActionResult<number>> {
  try {
    await assertPermission('financial.write')
    const parsed = z.array(receivableSchema).min(1, 'Informe as parcelas').max(48).safeParse(installments)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Parcelas inválidas.' }
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('generate_work_order_receivables', {
      p_work_order_id: z.guid().parse(workOrderId),
      p_installments: parsed.data,
    })
    if (error) return actionError(error)
    revalidatePath(`/os/${workOrderId}`)
    revalidatePath('/financeiro')
    return actionOk(data as number, `${data} parcela(s) lançada(s) em contas a receber.`)
  } catch (error) {
    return actionError(error)
  }
}
