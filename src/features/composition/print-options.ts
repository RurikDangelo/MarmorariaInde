/** Opcoes "Exibir" da impressao do sistema antigo (todas ligadas por padrao). */
export const PRINT_OPTIONS = [
  { key: 'materiais', label: 'Materiais' },
  { key: 'pecas', label: 'Peças' },
  { key: 'acabamentos', label: 'Acabamentos' },
  { key: 'servicos', label: 'Serviços' },
  { key: 'revendas', label: 'Produtos para Revenda' },
  { key: 'total_material', label: 'Total de Material' },
  { key: 'subtotal_composicao', label: 'SubTotal Composição' },
  { key: 'quantidade', label: 'Quantidade' },
  { key: 'valor_unitario', label: 'Valor Unitário' },
  { key: 'subtotal', label: 'SubTotal' },
  { key: 'medidas', label: 'Medidas' },
  { key: 'desenhos', label: 'Desenhos' },
  { key: 'valores', label: 'Valores (desligue para a oficina)' },
] as const

export type PrintOptionKey = (typeof PRINT_OPTIONS)[number]['key']
export type PrintOptions = Record<PrintOptionKey, boolean>

/** ?ocultar=pecas,valores -> opcoes. */
export function parsePrintOptions(hidden: string | string[] | undefined): PrintOptions {
  const off = new Set((Array.isArray(hidden) ? hidden.join(',') : (hidden ?? '')).split(',').filter(Boolean))
  const options = Object.fromEntries(PRINT_OPTIONS.map((option) => [option.key, !off.has(option.key)])) as PrintOptions
  // sem valores, nada de preco em lugar nenhum
  if (!options.valores) {
    options.valor_unitario = false
    options.subtotal = false
    options.subtotal_composicao = false
  }
  return options
}
