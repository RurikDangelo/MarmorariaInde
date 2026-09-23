'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertPermission } from '@/lib/auth/session'
import { actionError, actionOk, type ActionResult } from '@/lib/action-result'
import { removeStoredFiles, type StoredFile } from '@/lib/storage'

const text = (max: number) => z.string().trim().max(max)
const money = z.number().min(0, 'Valor não pode ser negativo').max(99_999_999)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
const paymentMethod = z.enum(['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'BOLETO', 'TRANSFERENCIA', 'CHEQUE', 'OUTRO'])
// APROVADO nao entra: so o "Aprovar e gerar OS" aprova (o banco tambem trava)
const editableStatus = z.enum(['RASCUNHO', 'ENVIADO', 'RECUSADO', 'EXPIRADO', 'CANCELADO'])

const headerSchema = z
  .object({
    id: z.guid().nullable(),
    customer_id: z.guid('Escolha o cliente'),
    status: editableStatus,
    issue_date: isoDate,
    validity_days: z.number().int().min(0).max(365).nullable(),
    valid_until: isoDate.nullable(),
    delivery_term: text(120),
    delivery_days: z.number().int().min(0).max(365).nullable(),
    delivery_date: isoDate.nullable(),
    seller_id: z.guid().nullable(),
    payment_type: z.enum(['A_VISTA', 'A_PRAZO']),
    payment_method: paymentMethod.nullable(),
    payment_terms: text(120),
    site_details: text(2000),
    freight: money,
    surcharge: money,
    discount: money,
    notes: text(4000),
    internal_notes: text(4000),
  })
  .strict()

export type QuoteHeaderInput = z.infer<typeof headerSchema>

function revalidateQuote(id: string) {
  revalidatePath('/orcamentos')
  revalidatePath(`/orcamentos/${id}`)
}

/** Grava o cabecalho do orcamento. Sem id cria o orcamento (montagem nova). */
export async function saveQuoteHeader(input: QuoteHeaderInput): Promise<ActionResult<{ id: string; number: string }>> {
  try {
    const user = await assertPermission('quotes.write')
    const parsed = headerSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revise o orçamento.' }

    const { id, ...fields } = parsed.data
    const row = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value === '' ? null : value]))
    const supabase = await createClient()
    const query = id
      ? supabase.from('quotes').update(row).eq('id', id)
      : supabase.from('quotes').insert({ ...row, seller_id: fields.seller_id ?? user.id, items_model: 2 })
    const { data, error } = await query.select('id, number').single<{ id: string; number: string }>()
    if (error) return actionError(error)

    revalidateQuote(data.id)
    return actionOk(data, id ? 'Orçamento salvo.' : `Orçamento ${data.number} criado.`)
  } catch (error) {
    return actionError(error)
  }
}

export async function updateQuoteStatus(quoteId: string, status: string, reason?: string): Promise<ActionResult> {
  try {
    await assertPermission('quotes.write')
    const parsedStatus = editableStatus.safeParse(status)
    if (!parsedStatus.success) return { ok: false, error: 'Situação inválida.' }
    const supabase = await createClient()
    const { error } = await supabase
      .from('quotes')
      .update({
        status: parsedStatus.data,
        rejected_reason: parsedStatus.data === 'RECUSADO' ? text(500).parse(reason ?? '') || null : null,
      })
      .eq('id', z.guid().parse(quoteId))
    if (error) return actionError(error)
    revalidateQuote(quoteId)
    return actionOk(null, 'Situação do orçamento atualizada.')
  } catch (error) {
    return actionError(error)
  }
}

/** Aprova e gera a OS com a montagem completa (e, se pedido, as contas a receber). */
export async function approveQuote(
  quoteId: string,
  options: { deadline: string | null; generateReceivables: boolean },
): Promise<ActionResult<{ workOrderId: string; number: string }>> {
  try {
    const user = await assertPermission('quotes.approve')
    if (options.generateReceivables && !user.permissions.has('financial.write')) {
      return { ok: false, error: 'Você não tem permissão para lançar contas a receber. Aprove sem gerar as parcelas.' }
    }
    const supabase = await createClient()
    const { data, error } = await supabase
      .rpc('approve_quote', {
        p_quote_id: z.guid().parse(quoteId),
        p_deadline: options.deadline ? isoDate.parse(options.deadline) : null,
        p_generate_receivables: options.generateReceivables,
      })
      .single<{ id: string; number: string }>()
    if (error) return actionError(error)

    revalidateQuote(quoteId)
    revalidatePath('/os')
    revalidatePath('/os/kanban')
    revalidatePath('/financeiro')
    revalidatePath('/dashboard')
    return actionOk({ workOrderId: data.id, number: data.number }, `OS ${data.number} criada a partir do orçamento.`)
  } catch (error) {
    return actionError(error)
  }
}

const installmentSchema = z
  .object({
    due_date: isoDate,
    amount: money,
    payment_method: paymentMethod.nullable(),
    notes: text(200),
  })
  .strict()

/** Fatura do orcamento (substitui todas as parcelas). */
export async function saveQuoteInstallments(
  quoteId: string,
  installments: z.infer<typeof installmentSchema>[],
): Promise<ActionResult> {
  try {
    await assertPermission('quotes.write')
    const parsed = z.array(installmentSchema).max(48).safeParse(installments)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Parcelas inválidas.' }
    const supabase = await createClient()
    const { error } = await supabase.rpc('save_quote_installments', {
      p_quote_id: z.guid().parse(quoteId),
      p_installments: parsed.data,
    })
    if (error) return actionError(error)
    revalidateQuote(quoteId)
    return actionOk(null, 'Fatura salva.')
  } catch (error) {
    return actionError(error)
  }
}

/** Registra um arquivo ja enviado ao Storage (pasta orcamentos/<id>/). */
export async function registerQuoteAttachment(input: {
  quoteId: string
  storagePath: string
  fileName: string
  mimeType: string | null
  sizeBytes: number | null
}): Promise<ActionResult> {
  try {
    await assertPermission('quotes.write')
    const quoteId = z.guid().parse(input.quoteId)
    if (!input.storagePath.startsWith(`orcamentos/${quoteId}/`)) return { ok: false, error: 'Caminho de arquivo inválido.' }
    const supabase = await createClient()
    const { error } = await supabase.from('quote_attachments').insert({
      quote_id: quoteId,
      storage_path: input.storagePath,
      file_name: text(200).parse(input.fileName),
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
    })
    if (error) return actionError(error)
    revalidateQuote(quoteId)
    return actionOk(null, 'Arquivo anexado.')
  } catch (error) {
    return actionError(error)
  }
}

export async function deleteQuoteAttachment(quoteId: string, attachmentId: string): Promise<ActionResult> {
  try {
    await assertPermission('quotes.write')
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('quote_attachments')
      .delete()
      .eq('id', z.guid().parse(attachmentId))
      .select('storage_path')
      .maybeSingle<{ storage_path: string }>()
    if (error) return actionError(error)
    // o arquivo pode estar sendo usado pela OS gerada: so sai do Storage se nenhuma OS aponta para ele
    if (data) {
      const { count } = await supabase
        .from('work_order_attachments')
        .select('id', { count: 'exact', head: true })
        .eq('storage_path', data.storage_path)
      if (!count) await supabase.storage.from('os-arquivos').remove([data.storage_path])
    }
    revalidateQuote(quoteId)
    return actionOk(null, 'Arquivo removido.')
  } catch (error) {
    return actionError(error)
  }
}

/** Volta o orçamento cancelado/recusado para rascunho. */
export async function reactivateQuote(quoteId: string): Promise<ActionResult> {
  try {
    await assertPermission('quotes.write')
    const supabase = await createClient()
    const { error } = await supabase
      .from('quotes')
      .update({ status: 'RASCUNHO', rejected_reason: null })
      .eq('id', z.guid().parse(quoteId))
    if (error) return actionError(error)
    revalidateQuote(quoteId)
    return actionOk(null, 'Orçamento reaberto como rascunho.')
  } catch (error) {
    return actionError(error)
  }
}

/**
 * Exclui o orçamento do banco com a montagem, a fatura, as RT's e os anexos.
 * O banco recusa se ele já tiver virado OS e devolve os arquivos órfãos.
 */
export async function deleteQuote(quoteId: string, reason?: string): Promise<ActionResult> {
  try {
    await assertPermission('quotes.delete')
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('delete_quote', {
      p_quote_id: z.guid().parse(quoteId),
      p_reason: z.string().trim().max(500).optional().parse(reason) || null,
    })
    if (error) return actionError(error)

    // a funcao devolve um jsonb; o client sem tipos gerados nao sabe a forma
    const removed = data as { number: string; files: StoredFile[] } | null
    await removeStoredFiles(removed?.files ?? [])
    revalidatePath('/orcamentos')
    revalidatePath('/dashboard')
    return actionOk(null, `Orçamento ${removed?.number ?? ''} excluído.`.replace('  ', ' '))
  } catch (error) {
    return actionError(error)
  }
}
