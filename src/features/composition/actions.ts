'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertPermission } from '@/lib/auth/session'
import { actionError, actionOk, type ActionResult } from '@/lib/action-result'
import { documentRefSchema, environmentSchema, itemDraftSchema, type EnvironmentInput } from './schema'
import type { DocumentRef, ItemDraft } from './types'

function writePermission(doc: DocumentRef) {
  return doc.kind === 'quote' ? 'quotes.write' : 'work_orders.write'
}

function ownerColumns(doc: DocumentRef) {
  return {
    quote_id: doc.kind === 'quote' ? doc.id : null,
    work_order_id: doc.kind === 'work_order' ? doc.id : null,
  }
}

function revalidateDocument(doc: DocumentRef) {
  if (doc.kind === 'quote') {
    revalidatePath(`/orcamentos/${doc.id}`)
    revalidatePath('/orcamentos')
  } else {
    revalidatePath(`/os/${doc.id}`)
    revalidatePath('/os')
    revalidatePath('/os/kanban')
  }
}

/** Valida o documento e a permissao de escrita antes de qualquer gravacao. */
async function guard(doc: DocumentRef): Promise<DocumentRef> {
  const parsed = documentRefSchema.safeParse(doc)
  if (!parsed.success) throw new Error('Documento inválido.')
  await assertPermission(writePermission(parsed.data))
  return parsed.data
}

export async function saveEnvironment(doc: DocumentRef, input: EnvironmentInput): Promise<ActionResult<string>> {
  try {
    const ref = await guard(doc)
    const parsed = environmentSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('save_environment', {
      p_environment: { ...parsed.data, ...ownerColumns(ref) },
    })
    if (error) return actionError(error)

    revalidateDocument(ref)
    return actionOk(data as string, parsed.data.id ? 'Ambiente atualizado.' : 'Ambiente incluído.')
  } catch (error) {
    return actionError(error)
  }
}

export async function deleteEnvironment(doc: DocumentRef, environmentId: string): Promise<ActionResult> {
  try {
    const ref = await guard(doc)
    const supabase = await createClient()
    const { error } = await supabase.rpc('delete_environment', { p_environment_id: z.guid().parse(environmentId) })
    if (error) return actionError(error)
    revalidateDocument(ref)
    return actionOk(null, 'Ambiente removido.')
  } catch (error) {
    return actionError(error)
  }
}

/** Grava o produto inteiro (materiais, pecas e composicao) numa transacao. */
export async function saveLineItem(
  doc: DocumentRef,
  draft: ItemDraft,
): Promise<ActionResult<{ id: string; version: number }>> {
  try {
    const ref = await guard(doc)
    const parsed = itemDraftSchema.safeParse(draft)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revise o produto.' }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('save_line_item', {
      p_item: { ...parsed.data, ...ownerColumns(ref) },
    })
    if (error) return actionError(error)

    revalidateDocument(ref)
    return actionOk(data as { id: string; version: number }, 'Produto gravado.')
  } catch (error) {
    return actionError(error)
  }
}

export async function deleteLineItem(doc: DocumentRef, lineItemId: string): Promise<ActionResult> {
  try {
    const ref = await guard(doc)
    const supabase = await createClient()
    const { error } = await supabase.rpc('delete_line_item', { p_line_item_id: z.guid().parse(lineItemId) })
    if (error) return actionError(error)
    revalidateDocument(ref)
    return actionOk(null, 'Produto removido.')
  } catch (error) {
    return actionError(error)
  }
}

export async function duplicateLineItem(doc: DocumentRef, lineItemId: string): Promise<ActionResult<string>> {
  try {
    const ref = await guard(doc)
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('duplicate_line_item', { p_line_item_id: z.guid().parse(lineItemId) })
    if (error) return actionError(error)
    revalidateDocument(ref)
    return actionOk(data as string, 'Produto duplicado.')
  } catch (error) {
    return actionError(error)
  }
}

const pieceStatusSchema = z.enum(['PENDENTE', 'EM_PRODUCAO', 'PRONTO', 'INSTALADO', 'RETRABALHO'])

/** Situacao de producao da peca (quem aponta producao nao precisa editar a OS). */
export async function setPieceStatus(workOrderId: string, pieceId: string, status: string): Promise<ActionResult> {
  try {
    const user = await assertPermission('work_orders.read')
    if (!user.permissions.has('production.write') && !user.permissions.has('work_orders.write')) {
      return { ok: false, error: 'Você não tem permissão para apontar produção.' }
    }
    const supabase = await createClient()
    const { error } = await supabase.rpc('set_piece_status', {
      p_piece_id: z.guid().parse(pieceId),
      p_status: pieceStatusSchema.parse(status),
    })
    if (error) return actionError(error)
    revalidatePath(`/os/${z.guid().parse(workOrderId)}`)
    return actionOk(null, 'Situação da peça atualizada.')
  } catch (error) {
    return actionError(error)
  }
}
