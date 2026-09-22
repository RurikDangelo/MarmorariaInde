'use client'

import * as React from 'react'
import type { LineItem, UnitCode } from '@/types/database'
import type { ComponentDraft, ItemDraft, MaterialDraft, PieceDraft } from '../../types'

export const newId = () => crypto.randomUUID()

export function draftFromItem(item: LineItem): ItemDraft {
  return {
    id: item.id,
    version: item.version,
    environment_id: item.environment_id,
    environment_name: '',
    product_id: item.product_id,
    code: item.code,
    description: item.description,
    complement: item.complement ?? '',
    quantity: Number(item.quantity),
    unit: item.unit,
    length_mm: item.length_mm,
    width_mm: item.width_mm,
    edge_mm: item.edge_mm,
    backsplash_mm: item.backsplash_mm,
    foot_mm: item.foot_mm,
    drawing_path: item.drawing_path,
    notes: item.notes ?? '',
    materials: (item.materials ?? []).map((material) => ({
      id: material.id,
      material_id: material.material_id,
      code: material.code,
      description: material.description,
      thickness_mm: material.thickness_mm,
      price_per_m2: Number(material.price_per_m2),
      price_overridden: material.price_overridden,
    })),
    pieces: (item.pieces ?? []).map((piece) => ({
      id: piece.id,
      line_item_material_id: piece.line_item_material_id,
      number: piece.number ?? '',
      name: piece.name ?? '',
      quantity: Number(piece.quantity),
      length_mm: piece.length_mm,
      width_mm: piece.width_mm,
      waste_pct: Number(piece.waste_pct),
      label_count: piece.label_count,
      specs: piece.specs ?? '',
    })),
    components: (item.components ?? []).map((component) => ({
      id: component.id,
      kind: component.kind,
      product_id: component.product_id,
      code: component.code,
      description: component.description,
      unit: component.unit,
      quantity: Number(component.quantity),
      unit_price: Number(component.unit_price),
      price_overridden: component.price_overridden,
      notes: component.notes ?? '',
    })),
  }
}

export function emptyDraft(environmentId: string | null, unit: UnitCode = 'M2'): ItemDraft {
  return {
    id: newId(),
    version: null,
    environment_id: environmentId,
    environment_name: '',
    product_id: null,
    code: null,
    description: '',
    complement: '',
    quantity: 1,
    unit,
    length_mm: null,
    width_mm: null,
    edge_mm: null,
    backsplash_mm: null,
    foot_mm: null,
    drawing_path: null,
    notes: '',
    materials: [],
    pieces: [],
    components: [],
  }
}

type Action =
  | { type: 'item'; patch: Partial<ItemDraft> }
  | { type: 'material:add'; material: MaterialDraft }
  | { type: 'material:set'; id: string; patch: Partial<MaterialDraft> }
  | { type: 'material:remove'; id: string; withPieces: boolean }
  | { type: 'piece:add'; pieces: PieceDraft[] }
  | { type: 'piece:set'; id: string; patch: Partial<PieceDraft> }
  | { type: 'piece:remove'; id: string }
  | { type: 'component:add'; component: ComponentDraft }
  | { type: 'component:set'; id: string; patch: Partial<ComponentDraft> }
  | { type: 'component:remove'; id: string }

function reducer(draft: ItemDraft, action: Action): ItemDraft {
  switch (action.type) {
    case 'item':
      return { ...draft, ...action.patch }
    case 'material:add':
      return { ...draft, materials: [...draft.materials, action.material] }
    case 'material:set':
      return {
        ...draft,
        materials: draft.materials.map((row) => (row.id === action.id ? { ...row, ...action.patch } : row)),
      }
    case 'material:remove':
      return {
        ...draft,
        materials: draft.materials.filter((row) => row.id !== action.id),
        pieces: action.withPieces
          ? draft.pieces.filter((piece) => piece.line_item_material_id !== action.id)
          : draft.pieces.map((piece) =>
              piece.line_item_material_id === action.id ? { ...piece, line_item_material_id: null } : piece,
            ),
      }
    case 'piece:add':
      return { ...draft, pieces: [...draft.pieces, ...action.pieces] }
    case 'piece:set':
      return { ...draft, pieces: draft.pieces.map((row) => (row.id === action.id ? { ...row, ...action.patch } : row)) }
    case 'piece:remove':
      return { ...draft, pieces: draft.pieces.filter((row) => row.id !== action.id) }
    case 'component:add':
      return { ...draft, components: [...draft.components, action.component] }
    case 'component:set':
      return {
        ...draft,
        components: draft.components.map((row) => (row.id === action.id ? { ...row, ...action.patch } : row)),
      }
    case 'component:remove':
      return { ...draft, components: draft.components.filter((row) => row.id !== action.id) }
  }
}

/** Estado do produto em edicao. So vira banco no Gravar (F2). */
export function useItemDraft(initial: ItemDraft) {
  const [draft, dispatch] = React.useReducer(reducer, initial)
  const [snapshot] = React.useState(() => JSON.stringify(initial))
  const dirty = React.useMemo(() => JSON.stringify(draft) !== snapshot, [draft, snapshot])
  return { draft, dispatch, dirty }
}

export type ItemDraftDispatch = React.Dispatch<Action>

/** Proximo numero de peca ("1", "2"...). */
export function nextPieceNumber(pieces: PieceDraft[]): number {
  return pieces.reduce((max, piece) => Math.max(max, Number.parseInt(piece.number, 10) || 0), 0) + 1
}
