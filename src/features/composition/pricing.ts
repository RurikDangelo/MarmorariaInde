/**
 * Previa dos calculos da montagem, identica a supabase/migrations/0022-0023.
 *
 * Serve so para mostrar os numeros enquanto a pessoa digita: o que fica
 * gravado e calculado pelo banco. Conta em inteiros (mm, centesimos de
 * quantidade, 0,0001 m2 e centavos) para arredondar igual ao Postgres
 * (metade para cima em valores positivos) sem erro de ponto flutuante.
 */
import type { ComponentKind } from '@/types/database'
import type { ComponentDraft, ItemDraft, MaterialDraft, PieceDraft } from './types'

/** round(num / den) com metade para cima. num e den inteiros >= 0. */
function divRound(num: number, den: number): number {
  return Math.floor((2 * num + den) / (2 * den))
}

const hundredths = (value: number) => Math.round((value || 0) * 100)
const tenThousandths = (value: number) => Math.round((value || 0) * 10_000)

/** Total M2 da peca, em 0,0001 m2: round(Qtd x C x L, 4). */
export function pieceArea4(piece: Pick<PieceDraft, 'quantity' | 'length_mm' | 'width_mm'>): number {
  return divRound(hundredths(piece.quantity) * (piece.length_mm || 0) * (piece.width_mm || 0), 10_000)
}

/** Total com Perda M2, em 0,0001 m2. */
export function pieceAreaWithWaste4(piece: Pick<PieceDraft, 'quantity' | 'length_mm' | 'width_mm' | 'waste_pct'>): number {
  return divRound(pieceArea4(piece) * (10_000 + hundredths(piece.waste_pct)), 10_000)
}

export interface MaterialTotals {
  area4: number
  areaWithWaste4: number
  totalArea4: number
  valueCents: number
}

export function materialTotals(material: MaterialDraft, pieces: PieceDraft[], itemQuantity: number): MaterialTotals {
  const own = pieces.filter((piece) => piece.line_item_material_id === material.id)
  const area4 = own.reduce((sum, piece) => sum + pieceArea4(piece), 0)
  const areaWithWaste4 = own.reduce((sum, piece) => sum + pieceAreaWithWaste4(piece), 0)
  const totalArea4 = divRound(areaWithWaste4 * hundredths(itemQuantity), 100)
  const valueCents = divRound(totalArea4 * hundredths(material.price_per_m2), 10_000)
  return { area4, areaWithWaste4, totalArea4, valueCents }
}

export interface ComponentTotals {
  totalQuantity4: number
  valueCents: number
}

export function componentTotals(component: ComponentDraft, itemQuantity: number): ComponentTotals {
  const totalQuantity4 = divRound(tenThousandths(component.quantity) * hundredths(itemQuantity), 100)
  const valueCents = divRound(totalQuantity4 * hundredths(component.unit_price), 10_000)
  return { totalQuantity4, valueCents }
}

export interface ItemTotals {
  materialsArea4: number
  materialsCents: number
  byKind: Record<ComponentKind, number>
  /** Total Geral do Item (insumos fora). */
  totalCents: number
}

export function itemTotals(item: Pick<ItemDraft, 'materials' | 'pieces' | 'components' | 'quantity'>): ItemTotals {
  let materialsArea4 = 0
  let materialsCents = 0
  for (const material of item.materials) {
    const totals = materialTotals(material, item.pieces, item.quantity)
    materialsArea4 += totals.totalArea4
    materialsCents += totals.valueCents
  }

  const byKind: Record<ComponentKind, number> = { ACABAMENTO: 0, SERVICO: 0, REVENDA: 0, INSUMO: 0 }
  for (const component of item.components) {
    byKind[component.kind] += componentTotals(component, item.quantity).valueCents
  }

  return {
    materialsArea4,
    materialsCents,
    byKind,
    totalCents: materialsCents + byKind.ACABAMENTO + byKind.SERVICO + byKind.REVENDA,
  }
}

export const area4ToM2 = (area4: number) => area4 / 10_000
export const centsToMoney = (cents: number) => cents / 100
