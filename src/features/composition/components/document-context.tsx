'use client'

import * as React from 'react'
import type { Environment, LookupOption, Product } from '@/types/database'
import type { Catalog, DocumentKind, DocumentRef, MaterialOption } from '../types'

export interface DocumentContextValue {
  kind: DocumentKind
  /** null enquanto a OS/orcamento ainda nao foi gravado (tela de novo). */
  doc: DocumentRef | null
  /** Grava o documento se ainda nao existe (a tela e uma so). null = nao deu (ex.: falta o cliente). */
  ensureDocument: () => Promise<DocumentRef | null>
  /**
   * Antes de abrir a edicao de produto/ambiente num documento ainda nao gravado:
   * mensagem do que falta (ex.: cliente), para ninguem montar um produto inteiro e nao conseguir gravar.
   */
  missingForCreate: () => string | null
  /** Recarrega os dados do servidor (ou abre a OS recem-criada). */
  refresh: () => void
  canEdit: boolean
  canManageCatalog: boolean
  canAddToLists: boolean
  catalog: Catalog
  addMaterial: (material: MaterialOption) => void
  addProduct: (product: Product) => void
  addLookup: (option: LookupOption) => void
  environments: Environment[]
  defaultWastePct: number
}

const DocumentContext = React.createContext<DocumentContextValue | null>(null)

export function DocumentProvider({ value, children }: { value: DocumentContextValue; children: React.ReactNode }) {
  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>
}

export function useDocument() {
  const context = React.useContext(DocumentContext)
  if (!context) throw new Error('useDocument precisa estar dentro de <DocumentProvider>')
  return context
}

/** Cadastros com os itens criados na hora (cadastro rapido) somados ao que veio do servidor. */
export function useLiveCatalog(initial: Catalog) {
  const [extra, setExtra] = React.useState<{ materials: MaterialOption[]; products: Product[]; lookups: LookupOption[] }>({
    materials: [],
    products: [],
    lookups: [],
  })

  const catalog = React.useMemo<Catalog>(() => {
    const merge = <T extends { id: string }>(base: T[], added: T[]) => [
      ...base.filter((row) => !added.some((extraRow) => extraRow.id === row.id)),
      ...added,
    ]
    return {
      materials: merge(initial.materials, extra.materials),
      products: merge(initial.products, extra.products),
      lookups: merge(initial.lookups, extra.lookups),
      materialTypes: initial.materialTypes,
    }
  }, [initial, extra])

  return {
    catalog,
    addMaterial: (material: MaterialOption) =>
      setExtra((current) => ({ ...current, materials: [...current.materials, material] })),
    addProduct: (product: Product) => setExtra((current) => ({ ...current, products: [...current.products, product] })),
    addLookup: (option: LookupOption) => setExtra((current) => ({ ...current, lookups: [...current.lookups, option] })),
  }
}
