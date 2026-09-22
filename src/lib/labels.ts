import type {
  ComponentKind,
  LookupList,
  PaymentMethod,
  PaymentType,
  PieceStatus,
  ProductKind,
  UnitCode,
} from '@/types/database'

/** Unidades com os nomes do sistema antigo (metro linear aparece como MT). */
export const UNITS: { value: UnitCode; label: string; long: string }[] = [
  { value: 'M2', label: 'M²', long: 'M² — metro quadrado' },
  { value: 'ML', label: 'MT', long: 'MT — metro linear' },
  { value: 'UN', label: 'UN', long: 'UN — unidade' },
  { value: 'PC', label: 'PÇ', long: 'PÇ — peça' },
  { value: 'KG', label: 'KG', long: 'KG — quilo' },
  { value: 'L', label: 'L', long: 'L — litro' },
]

export function unitLabel(unit: string | null | undefined): string {
  return UNITS.find((option) => option.value === unit)?.label ?? unit ?? ''
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'PIX', label: 'PIX' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'DEBITO', label: 'Cartão de débito' },
  { value: 'CREDITO', label: 'Cartão de crédito' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'TRANSFERENCIA', label: 'Transferência' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'OUTRO', label: 'Outro' },
]

export function paymentMethodLabel(value: string | null | undefined): string {
  return PAYMENT_METHODS.find((option) => option.value === value)?.label ?? '—'
}

export const PAYMENT_TYPES: { value: PaymentType; label: string }[] = [
  { value: 'A_VISTA', label: 'À Vista' },
  { value: 'A_PRAZO', label: 'A Prazo' },
]

export const PRODUCT_KINDS: { value: ProductKind; label: string; plural: string; defaultUnit: UnitCode }[] = [
  { value: 'PRODUTO', label: 'Produto', plural: 'Produtos', defaultUnit: 'M2' },
  { value: 'ACABAMENTO', label: 'Acabamento', plural: 'Acabamentos', defaultUnit: 'ML' },
  { value: 'SERVICO', label: 'Serviço', plural: 'Serviços', defaultUnit: 'UN' },
  { value: 'REVENDA', label: 'Revenda', plural: 'Revendas', defaultUnit: 'PC' },
  { value: 'INSUMO', label: 'Insumo', plural: 'Insumos', defaultUnit: 'UN' },
]

export function productKindLabel(kind: ProductKind | ComponentKind): string {
  return PRODUCT_KINDS.find((option) => option.value === kind)?.label ?? kind
}

export const COMPONENT_KINDS: ComponentKind[] = ['ACABAMENTO', 'SERVICO', 'REVENDA', 'INSUMO']

export const PIECE_STATUSES: { value: PieceStatus; label: string }[] = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'EM_PRODUCAO', label: 'Em produção' },
  { value: 'PRONTO', label: 'Pronta' },
  { value: 'INSTALADO', label: 'Instalada' },
  { value: 'RETRABALHO', label: 'Retrabalho' },
]

export const LOOKUP_LISTS: { value: LookupList; label: string; hint: string }[] = [
  { value: 'AMBIENTE', label: 'Nomes de ambiente', hint: 'Aparecem ao criar um ambiente na OS ou no orçamento' },
  { value: 'VALIDADE', label: 'Validades do orçamento', hint: 'Dias até vencer a proposta' },
  { value: 'PREVISAO_ENTREGA', label: 'Previsões de entrega', hint: 'Dias corridos ou úteis até a entrega' },
  { value: 'FORMA_PAGAMENTO', label: 'Formas de pagamento', hint: 'Dias das parcelas contados da emissão (ex.: 0/30/60)' },
]
