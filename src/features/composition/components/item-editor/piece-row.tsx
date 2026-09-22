'use client'

import * as React from 'react'
import { MessageSquareText, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DecimalField, MetersField } from '@/components/shared/number-fields'
import { cn, formatNumber } from '@/lib/utils'
import { area4ToM2, pieceArea4, pieceAreaWithWaste4 } from '../../pricing'
import type { MaterialDraft, PieceDraft } from '../../types'
import type { ItemDraftDispatch } from './use-item-draft'
import { PIECE_GRID } from './piece-grid'

function MobileLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-[11px] text-muted-foreground md:hidden">{children}</span>
}

export function PieceRow({
  piece,
  materials,
  dispatch,
  autoFocus,
  onEnterLast,
}: {
  piece: PieceDraft
  materials: MaterialDraft[]
  dispatch: ItemDraftDispatch
  autoFocus: boolean
  onEnterLast: () => void
}) {
  const [showSpecs, setShowSpecs] = React.useState(Boolean(piece.specs))
  const set = (patch: Partial<PieceDraft>) => dispatch({ type: 'piece:set', id: piece.id, patch })
  const noMaterial = !piece.line_item_material_id

  return (
    <div className={cn('rounded-md border p-2', noMaterial && materials.length > 0 && 'border-warning/50')}>
      <div className={PIECE_GRID}>
        <label>
          <MobileLabel>Número</MobileLabel>
          <Input value={piece.number} onChange={(event) => set({ number: event.target.value })} className="h-8" maxLength={20} />
        </label>
        <label>
          <MobileLabel>Nome</MobileLabel>
          <Input
            value={piece.name}
            onChange={(event) => set({ name: event.target.value })}
            placeholder="Tampo, saia…"
            className="h-8"
            maxLength={120}
          />
        </label>
        <div className="col-span-2 md:col-span-1">
          <MobileLabel>Material</MobileLabel>
          <Select
            value={piece.line_item_material_id ?? 'NENHUM'}
            onValueChange={(value) => set({ line_item_material_id: value === 'NENHUM' ? null : value })}
          >
            <SelectTrigger className="h-8" aria-label="Material da peça">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NENHUM">Sem material</SelectItem>
              {materials.map((material) => (
                <SelectItem key={material.id} value={material.id}>
                  {material.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label>
          <MobileLabel>Quantidade</MobileLabel>
          <DecimalField value={piece.quantity} onValueChange={(quantity) => set({ quantity })} className="h-8 text-right" />
        </label>
        <label>
          <MobileLabel>Comprimento</MobileLabel>
          <MetersField
            valueMm={piece.length_mm}
            onValueChange={(mm) => set({ length_mm: mm ?? 0 })}
            className="h-8"
            autoFocus={autoFocus}
          />
        </label>
        <label>
          <MobileLabel>Largura</MobileLabel>
          <MetersField valueMm={piece.width_mm} onValueChange={(mm) => set({ width_mm: mm ?? 0 })} className="h-8" />
        </label>
        <div className="text-right text-sm tabular">
          <MobileLabel>Total M²</MobileLabel>
          {formatNumber(area4ToM2(pieceArea4(piece)), 4)}
        </div>
        <label>
          <MobileLabel>% Perda</MobileLabel>
          <DecimalField
            value={piece.waste_pct}
            onValueChange={(waste_pct) => set({ waste_pct })}
            suffix="%"
            className="h-8 text-right"
          />
        </label>
        <div className="text-right text-sm font-medium tabular">
          <MobileLabel>Total com Perda M²</MobileLabel>
          {formatNumber(area4ToM2(pieceAreaWithWaste4(piece)), 4)}
        </div>
        <label>
          <MobileLabel>QTD de Etiquetas</MobileLabel>
          <DecimalField
            value={piece.label_count}
            onValueChange={(value) => set({ label_count: Math.max(0, Math.round(value)) })}
            className="h-8 text-right"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onEnterLast()
              }
            }}
          />
        </label>
        <div className="col-span-2 flex justify-end gap-0.5 md:col-span-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Especificações diversas"
            onClick={() => setShowSpecs((value) => !value)}
          >
            <MessageSquareText className={cn(piece.specs && 'text-primary')} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remover peça"
            onClick={() => dispatch({ type: 'piece:remove', id: piece.id })}
          >
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      </div>
      {showSpecs && (
        <Input
          value={piece.specs}
          onChange={(event) => set({ specs: event.target.value })}
          placeholder="Especificações diversas (sai na etiqueta e na ficha de produção)"
          className="mt-2 h-8"
          maxLength={2000}
        />
      )}
    </div>
  )
}
