'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertPermission, getSessionUser } from '@/lib/auth/session'
import { actionError, actionOk, type ActionResult } from '@/lib/action-result'
import type { Permission } from '@/lib/auth/permissions'
import type { LookupOption, Product } from '@/types/database'

const productSchema = z
  .object({
    id: z.guid().nullable(),
    kind: z.enum(['PRODUTO', 'ACABAMENTO', 'SERVICO', 'REVENDA', 'INSUMO']),
    code: z.string().trim().max(40),
    name: z.string().trim().min(1, 'Informe a descrição').max(200),
    unit: z.enum(['M2', 'ML', 'UN', 'PC', 'KG', 'L']),
    price: z.number().min(0).max(99_999_999),
    cost: z.number().min(0).max(99_999_999).nullable(),
    description: z.string().trim().max(1000),
  })
  .strict()

export type ProductInput = z.infer<typeof productSchema>

/** Cadastra ou altera um produto/servico. Devolve a linha para a tela usar na hora. */
export async function saveProduct(input: ProductInput): Promise<ActionResult<Product>> {
  try {
    await assertPermission('stock.write')
    const parsed = productSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revise o cadastro.' }

    const { id, code, description, ...rest } = parsed.data
    const row = { ...rest, code: code || null, description: description || null }
    const supabase = await createClient()
    const query = id
      ? supabase.from('products').update(row).eq('id', id)
      : supabase.from('products').insert(row)
    const { data, error } = await query.select('*').single<Product>()

    if (error) {
      if (error.code === '23505') return { ok: false, error: `Já existe um cadastro com o código ${code}.` }
      return actionError(error)
    }

    revalidatePath('/cadastros')
    return actionOk(data, id ? 'Cadastro atualizado.' : `${data.name} cadastrado (código ${data.code}).`)
  } catch (error) {
    return actionError(error)
  }
}

export async function setProductActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    await assertPermission('stock.write')
    const supabase = await createClient()
    const { error } = await supabase.from('products').update({ active }).eq('id', z.guid().parse(id))
    if (error) return actionError(error)
    revalidatePath('/cadastros')
    return actionOk(null, active ? 'Cadastro reativado.' : 'Cadastro desativado.')
  } catch (error) {
    return actionError(error)
  }
}

const lookupSchema = z
  .object({
    id: z.guid().nullable(),
    list: z.enum(['AMBIENTE', 'VALIDADE', 'PREVISAO_ENTREGA', 'FORMA_PAGAMENTO']),
    label: z.string().trim().min(1, 'Informe o nome').max(120),
    days: z.number().int().min(0).max(365).nullable(),
    business_days: z.boolean(),
    installments: z
      .string()
      .trim()
      .regex(/^(\d{1,3}(\/\d{1,3}){0,23})?$/, 'Use os dias separados por barra, ex.: 0/30/60')
      .max(100),
  })
  .strict()

export type LookupInput = z.infer<typeof lookupSchema>

const ADD_TO_LISTS: Permission[] = ['quotes.write', 'work_orders.write', 'stock.write', 'settings.write']
const MANAGE_LISTS: Permission[] = ['stock.write', 'settings.write']

/** Item novo numa lista rapida (ambiente, validade, previsao, forma de pagamento). */
export async function saveLookupOption(input: LookupInput): Promise<ActionResult<LookupOption>> {
  try {
    const user = await getSessionUser()
    if (!user) return { ok: false, error: 'Sessão expirada. Faça login novamente.' }
    const parsed = lookupSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }

    // incluir na lista: quem monta orcamento/OS; alterar: quem cuida dos cadastros (RLS confere de novo)
    const allowed = parsed.data.id ? MANAGE_LISTS : ADD_TO_LISTS
    if (!allowed.some((permission) => user.permissions.has(permission))) {
      return { ok: false, error: 'Você não tem permissão para alterar esta lista.' }
    }

    const { id, installments, ...rest } = parsed.data
    const row = { ...rest, installments: installments || null }
    const supabase = await createClient()
    const query = id
      ? supabase.from('lookup_options').update(row).eq('id', id)
      : supabase.from('lookup_options').insert(row)
    const { data, error } = await query.select('*').single<LookupOption>()

    if (error) {
      if (error.code === '23505') return { ok: false, error: `"${parsed.data.label}" já está na lista.` }
      if (error.code === '42501') return { ok: false, error: 'Você não tem permissão para alterar esta lista.' }
      return actionError(error)
    }

    revalidatePath('/cadastros')
    return actionOk(data, id ? 'Lista atualizada.' : `"${data.label}" incluído na lista.`)
  } catch (error) {
    return actionError(error)
  }
}

export async function deleteLookupOption(id: string): Promise<ActionResult> {
  try {
    const user = await getSessionUser()
    if (!user || !MANAGE_LISTS.some((permission) => user.permissions.has(permission))) {
      return { ok: false, error: 'Você não tem permissão para alterar esta lista.' }
    }
    const supabase = await createClient()
    // desativa em vez de apagar: documentos antigos continuam com o texto gravado
    const { error } = await supabase.from('lookup_options').update({ active: false }).eq('id', z.guid().parse(id))
    if (error) return actionError(error)
    revalidatePath('/cadastros')
    return actionOk(null, 'Removido da lista.')
  } catch (error) {
    return actionError(error)
  }
}
