'use client'

import * as React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/utils'
import { area4ToM2, pieceArea4, pieceAreaWithWaste4 } from '../../pricing'
import { useDocument } from '../document-context'
import type { ItemDraft } from '../../types'
import { PIECE_GRID } from './piece-grid'
import { PieceRow } from './piece-row'
import { newId, nextPieceNumber, type ItemDraftDispatch } from './use-item-draft'

/** Aba Pecas: medidas, % perda e identificacao (numero, nome, etiquetas). */
export function PiecesTab({ draft, dispatch }: { draft: ItemDraft; dispatch: ItemDraftDispatch }) {
  const { defaultWastePct } = useDocument()
  const [focusId, setFocusId] = React.useState<string | null>(null)

  function addPiece() {
    const last = draft.pieces.at(-1)
    const id = newId()
    dispatch({
      type: 'piece:add',
      pieces: [
        {
          id,
          line_item_material_id: last?.line_item_material_id ?? draft.materials[0]?.id ?? null,
          number: String(nextPieceNumber(draft.pieces)),
          name: '',
          quantity: 1,
          length_mm: 0,
          width_mm: 0,
          waste_pct: last?.waste_pct ?? defaultWastePct,
          label_count: 1,
          specs: '',
        },
      ],
    })
    setFocusId(id)
  }

  const totals = draft.pieces.reduce(
    (acc, piece) => ({ area: acc.area + pieceArea4(piece), withWaste: acc.withWaste + pieceAreaWithWaste4(piece) }),
    { area: 0, withWaste: 0 },
  )

  return (
    <div className="flex flex-col gap-3">
      {draft.materials.length === 0 && (
        <p className="rounded-md border border-warning/30 bg-warning/8 px-3 py-2 text-xs text-warning">
          Inclua o material na aba Materiais para que o m² das peças entre no valor.
        </p>
      )}

      {draft.pieces.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          Nenhuma peça. Use “Adicionar peça” ou “Gerar peças” no topo (Comprimento, Largura, Borda, Rodabanca e Pé).
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className={`${PIECE_GRID} hidden px-2 text-xs font-medium text-muted-foreground md:grid`}>
            <span>Nº</span>
            <span>Nome</span>
            <span>Material</span>
            <span className="text-right">Quant.</span>
            <span>Comprimento</span>
            <span>Largura</span>
            <span className="text-right">Total M²</span>
            <span className="text-right">% Perda</span>
            <span className="text-right">c/ Perda M²</span>
            <span className="text-right">Etiq.</span>
            <span />
          </div>
          {draft.pieces.map((piece) => (
            <PieceRow
              key={piece.id}
              piece={piece}
              materials={draft.materials}
              dispatch={dispatch}
              autoFocus={piece.id === focusId}
              onEnterLast={addPiece}
            />
          ))}
          <div className="flex justify-end gap-4 px-2 text-xs text-muted-foreground">
            <span>
              Total M²: <strong className="tabular text-foreground">{formatNumber(area4ToM2(totals.area), 4)}</strong>
            </span>
            <span>
              Com perda: <strong className="tabular text-foreground">{formatNumber(area4ToM2(totals.withWaste), 4)}</strong>
            </span>
          </div>
        </div>
      )}

      <div>
        <Button type="button" variant="outline" size="sm" onClick={addPiece}>
          <Plus />
          Adicionar peça
        </Button>
      </div>
    </div>
  )
}
