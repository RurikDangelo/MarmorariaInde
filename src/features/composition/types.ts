import type { ComponentKind, Environment, LineItem, LookupOption, Product, UnitCode } from '@/types/database'

export type DocumentKind = 'quote' | 'work_order'

/** Orcamento ou OS dono da montagem. */
export interface DocumentRef {
  kind: DocumentKind
  id: string
}

export interface MaterialDraft {
  id: string
  material_id: string | null
  code: string | null
  description: string
  thickness_mm: number | null
  price_per_m2: number
  /** Cadeado aberto: preco digitado a mao. */
  price_overridden: boolean
}

export interface PieceDraft {
  id: string
  line_item_material_id: string | null
  number: string
  name: string
  quantity: number
  length_mm: number
  width_mm: number
  waste_pct: number
  label_count: number
  specs: string
}

export interface ComponentDraft {
  id: string
  kind: ComponentKind
  product_id: string | null
  code: string | null
  description: string
  unit: UnitCode
  quantity: number
  unit_price: number
  price_overridden: boolean
  notes: string
}

/** Produto em edicao (tela "Edicao de Item"). So vira banco no Gravar (F2). */
export interface ItemDraft {
  id: string
  version: number | null
  environment_id: string | null
  /** Ambiente novo digitado na propria edicao do produto. */
  environment_name: string
  product_id: string | null
  code: string | null
  description: string
  complement: string
  quantity: number
  unit: UnitCode
  length_mm: number | null
  width_mm: number | null
  edge_mm: number | null
  backsplash_mm: number | null
  foot_mm: number | null
  drawing_path: string | null
  notes: string
  materials: MaterialDraft[]
  pieces: PieceDraft[]
  components: ComponentDraft[]
}

/** Opcao de material para a busca (Codigo · Descricao · Valor por M2). */
export interface MaterialOption {
  id: string
  code: string | null
  name: string
  price_per_m2: number | null
  thickness_mm: number | null
  type_code: string
}

export interface Catalog {
  materials: MaterialOption[]
  products: Product[]
  lookups: LookupOption[]
  materialTypes: { code: string; label: string; category: string }[]
}

export interface Composition {
  environments: Environment[]
  items: LineItem[]
}
