import { z } from 'zod'

const id = z.guid('Identificador inválido')
const unit = z.enum(['M2', 'ML', 'UN', 'PC', 'KG', 'L'])
const mm = z.number().int().min(0).max(100_000).nullable()
const money = z.number().min(0, 'Valor não pode ser negativo').max(99_999_999)
const code = z.string().trim().max(40).nullable()

export const documentRefSchema = z
  .object({ kind: z.enum(['quote', 'work_order']), id })
  .strict()

export const materialDraftSchema = z
  .object({
    id,
    material_id: id.nullable(),
    code,
    description: z.string().trim().max(200),
    thickness_mm: z.number().int().min(0).max(500).nullable(),
    price_per_m2: money,
    price_overridden: z.boolean(),
  })
  .strict()

export const pieceDraftSchema = z
  .object({
    id,
    line_item_material_id: id.nullable(),
    number: z.string().trim().max(20),
    name: z.string().trim().max(120),
    quantity: z.number().gt(0, 'Quantidade da peça precisa ser maior que zero').max(99_999),
    length_mm: z.number().int().min(0).max(100_000),
    width_mm: z.number().int().min(0).max(100_000),
    waste_pct: z.number().min(0, '% de perda entre 0 e 100').max(100, '% de perda entre 0 e 100'),
    label_count: z.number().int().min(0).max(999),
    specs: z.string().trim().max(2000),
  })
  .strict()

export const componentDraftSchema = z
  .object({
    id,
    kind: z.enum(['ACABAMENTO', 'SERVICO', 'REVENDA', 'INSUMO']),
    product_id: id.nullable(),
    code,
    description: z.string().trim().min(1, 'Descreva cada acabamento, serviço, revenda ou insumo').max(200),
    unit,
    quantity: z.number().min(0).max(9_999_999),
    unit_price: money,
    price_overridden: z.boolean(),
    notes: z.string().trim().max(500),
  })
  .strict()

export const itemDraftSchema = z
  .object({
    id,
    version: z.number().int().nullable(),
    environment_id: id.nullable(),
    environment_name: z.string().trim().max(80),
    product_id: id.nullable(),
    code,
    description: z.string().trim().max(200),
    complement: z.string().trim().max(200),
    quantity: z.number().gt(0, 'Quantidade do produto precisa ser maior que zero').max(99_999),
    unit,
    length_mm: mm,
    width_mm: mm,
    edge_mm: mm,
    backsplash_mm: mm,
    foot_mm: mm,
    drawing_path: z.string().max(500).nullable(),
    notes: z.string().trim().max(2000),
    materials: z.array(materialDraftSchema).max(20),
    pieces: z.array(pieceDraftSchema).max(300),
    components: z.array(componentDraftSchema).max(100),
  })
  .strict()
  .refine((item) => item.environment_id !== null, { message: 'Escolha o ambiente do produto', path: ['environment_id'] })
  .refine((item) => item.product_id !== null || item.description !== '', {
    message: 'Informe o produto',
    path: ['description'],
  })
  .refine(
    (item) =>
      item.pieces.every(
        (piece) =>
          piece.line_item_material_id === null ||
          item.materials.some((material) => material.id === piece.line_item_material_id),
      ),
    { message: 'Uma peça aponta para um material que foi removido', path: ['pieces'] },
  )

export const environmentSchema = z
  .object({
    id: id.nullable(),
    number: z.number().int().min(1).max(999).nullable(),
    name: z.string().trim().min(1, 'Informe o nome do ambiente').max(80),
    description: z.string().trim().max(500),
  })
  .strict()

export type EnvironmentInput = z.infer<typeof environmentSchema>
