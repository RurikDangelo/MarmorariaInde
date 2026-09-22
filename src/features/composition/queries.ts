import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Environment, LineItem, LookupOption, Product } from '@/types/database'
import type { Catalog, Composition, DocumentRef, MaterialOption } from './types'

const bySortOrder = (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order

/** Ambientes e produtos (com materiais, pecas e composicao) do orcamento ou da OS. */
export async function getComposition(doc: DocumentRef): Promise<Composition> {
  const supabase = await createClient()
  const column = doc.kind === 'quote' ? 'quote_id' : 'work_order_id'

  const [{ data: environments }, { data: items }] = await Promise.all([
    supabase.from('environments').select('*').eq(column, doc.id).order('number').returns<Environment[]>(),
    supabase
      .from('line_items')
      .select(
        // nomes das FKs explicitos: as pecas tambem apontam para os materiais
        `*,
         materials:line_item_materials!line_item_materials_line_item_id_fkey ( * ),
         pieces:line_item_pieces!line_item_pieces_line_item_id_fkey ( * ),
         components:line_item_components!line_item_components_line_item_id_fkey ( * )`,
      )
      .eq(column, doc.id)
      .order('sort_order')
      .order('created_at')
      .returns<LineItem[]>(),
  ])

  return {
    environments: environments ?? [],
    items: (items ?? []).map((item) => ({
      ...item,
      materials: [...(item.materials ?? [])].sort(bySortOrder),
      pieces: [...(item.pieces ?? [])].sort(bySortOrder),
      components: [...(item.components ?? [])].sort(bySortOrder),
    })),
  }
}

/**
 * Documento criado pela tela antiga (itens planos) vira montagem ao ser aberto.
 * Idempotente: nao faz nada se ja estiver na montagem nova.
 */
export async function ensureNewItemsModel(doc: DocumentRef, itemsModel: number): Promise<void> {
  if (itemsModel === 2) return
  const supabase = await createClient()
  await supabase.rpc('migrate_document', {
    p_quote_id: doc.kind === 'quote' ? doc.id : null,
    p_work_order_id: doc.kind === 'work_order' ? doc.id : null,
  })
}

/** Cadastros usados na montagem: materiais, produtos e servicos, listas rapidas. */
export const getCatalog = cache(async (): Promise<Catalog> => {
  const supabase = await createClient()
  const [{ data: materials }, { data: products }, { data: lookups }, { data: materialTypes }] = await Promise.all([
    supabase
      .from('materials')
      .select('id, code, name, price_per_m2, thickness_mm, type_code')
      .eq('active', true)
      .order('name')
      .limit(2000)
      .returns<MaterialOption[]>(),
    supabase.from('products').select('*').eq('active', true).order('name').limit(3000).returns<Product[]>(),
    supabase
      .from('lookup_options')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .order('label')
      .returns<LookupOption[]>(),
    supabase
      .from('material_types')
      .select('code, label, category')
      .order('sort_order')
      .returns<{ code: string; label: string; category: string }[]>(),
  ])

  return {
    materials: materials ?? [],
    products: products ?? [],
    lookups: lookups ?? [],
    materialTypes: materialTypes ?? [],
  }
})
