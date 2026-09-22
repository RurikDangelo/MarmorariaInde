import type { ItemDraft, PieceDraft } from '../../types'
import { newId, nextPieceNumber } from './use-item-draft'

/**
 * "Gerar pecas" a partir do cabecalho do produto:
 *   Tampo (C x L), Saia (C x Borda), Rodabanca (C x Rodabanca) e Pe (Pe x L).
 * As pecas entram no material escolhido e continuam a numeracao.
 */
export function generatePieces(draft: ItemDraft, materialId: string | null, wastePct: number): PieceDraft[] {
  const pieces: PieceDraft[] = []
  let number = nextPieceNumber(draft.pieces)
  const length = draft.length_mm ?? 0
  const width = draft.width_mm ?? 0

  const push = (name: string, pieceLength: number, pieceWidth: number) => {
    pieces.push({
      id: newId(),
      line_item_material_id: materialId,
      number: String(number++),
      name,
      quantity: 1,
      length_mm: pieceLength,
      width_mm: pieceWidth,
      waste_pct: wastePct,
      label_count: 1,
      specs: '',
    })
  }

  if (length && width) push('Tampo', length, width)
  if (length && draft.edge_mm) push('Saia', length, draft.edge_mm)
  if (length && draft.backsplash_mm) push('Rodabanca', length, draft.backsplash_mm)
  if (width && draft.foot_mm) push('Pé', draft.foot_mm, width)
  return pieces
}
