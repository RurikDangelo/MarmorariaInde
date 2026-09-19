'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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

const quoteSchema = z.object({
  customer_id: z.string().uuid('Selecione o cliente'),
  issue_date: z.string().min(1),
  valid_until: optionalString,
  status: z.enum(['RASCUNHO', 'ENVIADO', 'APROVADO', 'RECUSADO', 'EXPIRADO', 'CANCELADO']).default('RASCUNHO'),
  discount: z.coerce.number().min(0).default(0),
  surcharge: z.coerce.number().min(0).default(0),
  notes: optionalString,
  internal_notes: optionalString,
})

export async function createQuote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('quotes.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const parsed = quoteSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: 'Revise os campos do orçamento.', fieldErrors: zodToFieldErrors(parsed.error) }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('quotes')
    .insert(parsed.data)
    .select('id')
    .single<{ id: string }>()

  if (error) return { error: error.message }

  revalidatePath('/orcamentos')
  redirect(`/orcamentos/${data.id}`)
}

export async function updateQuote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('quotes.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Orçamento não identificado.' }

  const parsed = quoteSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: 'Revise os campos do orçamento.', fieldErrors: zodToFieldErrors(parsed.error) }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('quotes').update(parsed.data).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath(`/orcamentos/${id}`)
  revalidatePath('/orcamentos')
  return { success: 'Orçamento atualizado.' }
}

const quoteItemSchema = z.object({
  quote_id: z.string().uuid(),
  description: z.string().trim().min(1, 'Descreva o item'),
  environment: optionalString,
  material_id: optionalString,
  color: optionalString,
  thickness_mm: z.coerce.number().int().min(0).optional().transform((v) => (v ? v : null)),
  length_mm: z.coerce.number().int().min(0).default(0),
  width_mm: z.coerce.number().int().min(0).default(0),
  quantity: z.coerce.number().min(0.01).default(1),
  pricing_mode: z.enum(['M2', 'ML', 'UN']).default('M2'),
  unit_price: z.coerce.number().min(0).default(0),
  finish: optionalString,
  edge: optionalString,
  notes: optionalString,
})

export async function saveQuoteItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('quotes.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const parsed = quoteItemSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()

  const { error } = id
    ? await supabase.from('quote_items').update(parsed.data).eq('id', id)
    : await supabase.from('quote_items').insert(parsed.data)

  if (error) return { error: error.message }

  revalidatePath(`/orcamentos/${parsed.data.quote_id}`)
  return { success: 'Item salvo.' }
}

export async function deleteQuoteItem(itemId: string, quoteId: string): Promise<ActionState> {
  try {
    await assertPermission('quotes.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('quote_items').delete().eq('id', itemId)
  if (error) return { error: error.message }

  revalidatePath(`/orcamentos/${quoteId}`)
  return { success: 'Item removido.' }
}

export async function updateQuoteStatus(quoteId: string, status: string, reason?: string): Promise<ActionState> {
  try {
    await assertPermission('quotes.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('quotes')
    .update({ status, rejected_reason: status === 'RECUSADO' ? (reason ?? null) : null })
    .eq('id', quoteId)

  if (error) return { error: error.message }

  revalidatePath(`/orcamentos/${quoteId}`)
  revalidatePath('/orcamentos')
  return { success: 'Situação do orçamento atualizada.' }
}

/** Aprova o orçamento e gera a OS preservando os itens (função atômica no banco). */
export async function approveQuote(quoteId: string, deadline?: string): Promise<ActionState & { workOrderId?: string }> {
  try {
    await assertPermission('quotes.approve')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('convert_quote_to_work_order', {
      p_quote_id: quoteId,
      p_deadline: deadline || null,
    })
    .single<{ id: string; number: string }>()

  if (error) return { error: error.message }

  revalidatePath('/orcamentos')
  revalidatePath('/os')
  revalidatePath('/dashboard')
  return { success: `OS ${data.number} criada a partir do orçamento.`, workOrderId: data.id }
}
