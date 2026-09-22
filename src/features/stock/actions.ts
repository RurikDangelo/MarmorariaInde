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

const stockItemSchema = z.object({
  kind: z.enum(['CHAPA', 'INSUMO']).default('CHAPA'),
  code: optionalString,
  material_id: z.string().uuid('Selecione o material'),
  location_id: optionalString,
  supplier: optionalString,
  batch: optionalString,
  thickness_mm: z.coerce.number().int().min(0).optional().transform((v) => (v ? v : null)),
  length_mm: z.coerce.number().int().min(0).optional().transform((v) => (v ? v : null)),
  width_mm: z.coerce.number().int().min(0).optional().transform((v) => (v ? v : null)),
  quantity: z.coerce.number().min(0).default(1),
  unit: z.string().default('UN'),
  unit_cost: z.coerce.number().min(0).optional().transform((v) => (v ? v : null)),
  is_remnant: z
    .union([z.string(), z.boolean()])
    .transform((value) => value === true || value === 'on' || value === 'true')
    .default(false),
  notes: optionalString,
})

export async function saveStockItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('stock.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const parsed = stockItemSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: 'Revise os campos do item.', fieldErrors: zodToFieldErrors(parsed.error) }
  }

  if (parsed.data.kind === 'CHAPA' && (!parsed.data.length_mm || !parsed.data.width_mm || !parsed.data.thickness_mm)) {
    return { error: 'Chapa precisa de comprimento, largura e espessura.' }
  }

  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()

  if (id) {
    const { error } = await supabase.from('stock_items').update(parsed.data).eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { data, error } = await supabase
      .from('stock_items')
      .insert(parsed.data)
      .select('id, area_m2, unit_cost, material_id, quantity')
      .single<{ id: string; area_m2: number | null; unit_cost: number | null; material_id: string; quantity: number }>()

    if (error) return { error: error.message }

    // Entrada de estoque tambem vira movimento, para o historico fechar.
    await supabase.from('stock_movements').insert({
      stock_item_id: data.id,
      material_id: data.material_id,
      movement_type: 'ENTRADA',
      quantity: data.quantity,
      area_m2: data.area_m2,
      unit_cost: data.unit_cost,
      total_cost: data.unit_cost,
      notes: 'Entrada no estoque',
    })
  }

  revalidatePath('/estoque')
  return { success: id ? 'Item atualizado.' : 'Item cadastrado no estoque.' }
}

export async function reserveStockItem(
  stockItemId: string,
  workOrderId: string,
  notes?: string,
): Promise<ActionState> {
  try {
    await assertPermission('stock.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reserve_stock_item', {
    p_stock_item_id: stockItemId,
    p_work_order_id: workOrderId,
    p_notes: notes ?? null,
  })

  if (error) return { error: error.message }

  revalidatePath(`/os/${workOrderId}`)
  revalidatePath('/estoque')
  return { success: 'Material reservado para a OS.' }
}

export async function releaseStockItem(stockItemId: string, workOrderId?: string): Promise<ActionState> {
  try {
    await assertPermission('stock.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('release_stock_item', {
    p_stock_item_id: stockItemId,
    p_notes: null,
  })

  if (error) return { error: error.message }

  if (workOrderId) revalidatePath(`/os/${workOrderId}`)
  revalidatePath('/estoque')
  return { success: 'Reserva liberada.' }
}

const consumeSchema = z.object({
  stock_item_id: z.string().uuid(),
  work_order_id: z.string().uuid(),
  used_area_m2: z.coerce.number().min(0).optional(),
  remnant_length_mm: z.coerce.number().int().min(0).optional(),
  remnant_width_mm: z.coerce.number().int().min(0).optional(),
  notes: optionalString,
})

export async function consumeStockItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('stock.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const parsed = consumeSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: 'Dados inválidos para baixa de material.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('consume_stock_item', {
    p_stock_item_id: parsed.data.stock_item_id,
    p_work_order_id: parsed.data.work_order_id,
    p_used_area_m2: parsed.data.used_area_m2 || null,
    p_remnant_length_mm: parsed.data.remnant_length_mm || null,
    p_remnant_width_mm: parsed.data.remnant_width_mm || null,
    p_notes: parsed.data.notes ?? null,
  })

  if (error) return { error: error.message }

  revalidatePath(`/os/${parsed.data.work_order_id}`)
  revalidatePath('/estoque')
  return { success: 'Material baixado. Sobra registrada quando informada.' }
}

const lossSchema = z.object({
  stock_item_id: z.string().uuid(),
  work_order_id: optionalString,
  reason: z.enum(['QUEBRA', 'ERRO_CORTE', 'DEFEITO', 'MEDICAO_INCORRETA', 'TRANSPORTE', 'RETRABALHO', 'OUTRO']),
  notes: optionalString,
  discard: z
    .union([z.string(), z.boolean()])
    .transform((value) => value === true || value === 'on' || value === 'true')
    .default(false),
})

export async function registerStockLoss(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('stock.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const parsed = lossSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: 'Informe o motivo da perda.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('register_stock_loss', {
    p_stock_item_id: parsed.data.stock_item_id,
    p_reason: parsed.data.reason,
    p_notes: parsed.data.notes ?? null,
    p_work_order_id: parsed.data.work_order_id ?? null,
    p_discard: parsed.data.discard,
  })

  if (error) return { error: error.message }

  if (parsed.data.work_order_id) revalidatePath(`/os/${parsed.data.work_order_id}`)
  revalidatePath('/estoque')
  return { success: 'Perda registrada.' }
}

const materialSchema = z.object({
  code: optionalString,
  name: z.string().trim().min(1, 'Informe o nome do material'),
  type_code: z.string().min(1, 'Selecione o tipo'),
  color: optionalString,
  origin: optionalString,
  thickness_mm: z.coerce.number().int().min(0).optional().transform((v) => (v ? v : null)),
  price_per_m2: z.coerce.number().min(0).optional().transform((v) => (v ? v : null)),
  unit: z.enum(['M2', 'ML', 'UN', 'KG', 'L', 'PC']).default('M2'),
  min_quantity: z.coerce.number().min(0).default(0),
  supplier: optionalString,
  notes: optionalString,
})

export async function saveMaterial(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('stock.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const parsed = materialSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: 'Revise os campos do material.', fieldErrors: zodToFieldErrors(parsed.error) }
  }

  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()

  const query = id
    ? supabase.from('materials').update(parsed.data).eq('id', id)
    : supabase.from('materials').insert(parsed.data)
  const { data, error } = await query
    .select('id, code, name, price_per_m2, thickness_mm, type_code')
    .single<{ id: string; code: string | null; name: string; price_per_m2: number | null; thickness_mm: number | null; type_code: string }>()

  if (error) {
    if (error.code === '23505') return { error: `Já existe um material com o código ${parsed.data.code}.` }
    return { error: error.message }
  }

  revalidatePath('/estoque')
  return {
    success: id ? 'Material atualizado.' : `Material cadastrado (código ${data.code}).`,
    data,
  }
}
