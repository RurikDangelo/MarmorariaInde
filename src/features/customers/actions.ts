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

const customerSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do cliente'),
  person_type: z.enum(['PF', 'PJ']).default('PF'),
  document: optionalString,
  phone: optionalString,
  whatsapp: optionalString,
  email: optionalString.refine(
    (value) => !value || z.string().email().safeParse(value).success,
    'E-mail inválido',
  ),
  zip_code: optionalString,
  address: optionalString,
  address_number: optionalString,
  complement: optionalString,
  district: optionalString,
  city: optionalString,
  state: optionalString,
  notes: optionalString,
})

export async function saveCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('customers.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const parsed = customerSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: 'Revise os campos do cliente.', fieldErrors: zodToFieldErrors(parsed.error) }
  }

  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()

  const { error } = id
    ? await supabase.from('customers').update(parsed.data).eq('id', id)
    : await supabase.from('customers').insert(parsed.data)

  if (error) return { error: error.message }

  revalidatePath('/clientes')
  if (id) revalidatePath(`/clientes/${id}`)
  return { success: id ? 'Cliente atualizado.' : 'Cliente cadastrado.' }
}

export async function toggleCustomerActive(id: string, active: boolean): Promise<ActionState> {
  try {
    await assertPermission('customers.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('customers').update({ active }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/clientes')
  return { success: active ? 'Cliente reativado.' : 'Cliente desativado.' }
}
