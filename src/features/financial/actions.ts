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

const transactionSchema = z.object({
  description: z.string().trim().min(1, 'Descreva o lançamento'),
  kind: z.enum(['RECEITA', 'DESPESA']),
  category_id: optionalString,
  account_id: optionalString,
  work_order_id: optionalString,
  customer_id: optionalString,
  amount: z.coerce.number().min(0.01, 'Informe o valor'),
  due_date: z.string().min(1, 'Informe o vencimento'),
  paid_at: optionalString,
  status: z.enum(['PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO']).default('PENDENTE'),
  payment_method: optionalString,
  installment: z.coerce.number().int().min(1).default(1),
  installments: z.coerce.number().int().min(1).default(1),
  notes: optionalString,
})

export async function saveTransaction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('financial.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const parsed = transactionSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: 'Revise os campos do lançamento.', fieldErrors: zodToFieldErrors(parsed.error) }
  }

  const payload = { ...parsed.data }
  if (payload.status === 'PAGO' && !payload.paid_at) {
    payload.paid_at = new Date().toISOString().slice(0, 10)
  }

  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()

  const { error } = id
    ? await supabase.from('financial_transactions').update(payload).eq('id', id)
    : await supabase.from('financial_transactions').insert(payload)

  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  if (payload.work_order_id) revalidatePath(`/os/${payload.work_order_id}`)
  revalidatePath('/dashboard')
  return { success: id ? 'Lançamento atualizado.' : 'Lançamento registrado.' }
}

export async function settleTransaction(
  transactionId: string,
  workOrderId?: string | null,
): Promise<ActionState> {
  try {
    await assertPermission('financial.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('financial_transactions')
    .update({ status: 'PAGO', paid_at: new Date().toISOString().slice(0, 10) })
    .eq('id', transactionId)

  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  if (workOrderId) revalidatePath(`/os/${workOrderId}`)
  revalidatePath('/dashboard')
  return { success: 'Baixa registrada.' }
}

export async function deleteTransaction(
  transactionId: string,
  workOrderId?: string | null,
): Promise<ActionState> {
  try {
    await assertPermission('financial.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('financial_transactions').delete().eq('id', transactionId)
  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  if (workOrderId) revalidatePath(`/os/${workOrderId}`)
  return { success: 'Lançamento removido.' }
}
