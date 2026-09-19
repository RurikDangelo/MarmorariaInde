'use client'

import * as React from 'react'
import { useActionForm } from '@/lib/hooks/use-action-form'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FormSection } from '@/components/shared/form'
import { DimensionInput, MoneyInput } from '@/components/shared/inputs'
import { saveMaterial, saveStockItem } from '@/features/stock/actions'
import type { Material, MaterialType, StockItem, StockLocation } from '@/types/database'

export function StockItemDialog({
  materials,
  locations,
  item,
  trigger,
}: {
  materials: Pick<Material, 'id' | 'name' | 'unit' | 'thickness_mm'>[]
  locations: StockLocation[]
  item?: StockItem
  trigger?: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [kind, setKind] = React.useState<'CHAPA' | 'INSUMO'>(item?.kind ?? 'CHAPA')
  const [, formAction, pending] = useActionForm(saveStockItem, {
    onSuccess: () => {
      setOpen(false)
      router.refresh()
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus />
            Entrada de estoque
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar item de estoque' : 'Nova entrada de estoque'}</DialogTitle>
          <DialogDescription>
            Chapas entram com medidas; insumos entram com quantidade.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-5">
          {item && <input type="hidden" name="id" value={item.id} />}
          <input type="hidden" name="kind" value={kind} />

          <FormSection columns={2}>
            <Field label="Tipo de item">
              <Select value={kind} onValueChange={(value) => setKind(value as 'CHAPA' | 'INSUMO')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHAPA">Chapa</SelectItem>
                  <SelectItem value="INSUMO">Insumo / ferramenta</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Material" required>
              <Select name="material_id" defaultValue={item?.material_id} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((material) => (
                    <SelectItem key={material.id} value={material.id}>
                      {material.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Código / etiqueta" hint="Ex.: CH-0421">
              <Input name="code" defaultValue={item?.code ?? ''} />
            </Field>

            <Field label="Localização">
              <Select name="location_id" defaultValue={item?.location_id ?? 'NENHUM'}>
                <SelectTrigger>
                  <SelectValue placeholder="Não definida" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NENHUM">Não definida</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Fornecedor">
              <Input name="supplier" defaultValue={item?.supplier ?? ''} />
            </Field>

            <Field label="Lote">
              <Input name="batch" defaultValue={item?.batch ?? ''} />
            </Field>
          </FormSection>

          {kind === 'CHAPA' ? (
            <FormSection title="Medidas da chapa" columns={3}>
              <Field label="Comprimento" required>
                <DimensionInput name="length_mm" defaultValueMm={item?.length_mm ?? 0} />
              </Field>
              <Field label="Largura" required>
                <DimensionInput name="width_mm" defaultValueMm={item?.width_mm ?? 0} />
              </Field>
              <Field label="Espessura (mm)" required>
                <Input name="thickness_mm" type="number" min={1} defaultValue={item?.thickness_mm ?? 20} />
              </Field>
              <Field label="Custo da chapa" span="full">
                <MoneyInput name="unit_cost" defaultValue={Number(item?.unit_cost ?? 0)} />
              </Field>
              <div className="sm:col-span-full">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox name="is_remnant" defaultChecked={item?.is_remnant} />
                  É retalho (sobra de outra chapa)
                </label>
              </div>
            </FormSection>
          ) : (
            <FormSection title="Quantidade" columns={3}>
              <Field label="Quantidade" required>
                <Input name="quantity" type="number" min={0} step="0.001" defaultValue={item?.quantity ?? 1} />
              </Field>
              <Field label="Unidade">
                <Select name="unit" defaultValue={item?.unit ?? 'UN'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['UN', 'PC', 'KG', 'L', 'M2', 'ML'].map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Custo unitário">
                <MoneyInput name="unit_cost" defaultValue={Number(item?.unit_cost ?? 0)} />
              </Field>
            </FormSection>
          )}

          <Field label="Observações">
            <Textarea name="notes" rows={2} defaultValue={item?.notes ?? ''} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function MaterialDialog({
  types,
  material,
  trigger,
}: {
  types: MaterialType[]
  material?: Material
  trigger?: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [, formAction, pending] = useActionForm(saveMaterial, {
    onSuccess: () => {
      setOpen(false)
      router.refresh()
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Plus />
            Novo material
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{material ? 'Editar material' : 'Novo material'}</DialogTitle>
          <DialogDescription>
            O material é o catálogo (ex.: Granito Preto São Gabriel). As chapas são os itens físicos.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-5">
          {material && <input type="hidden" name="id" value={material.id} />}

          <FormSection columns={2}>
            <Field label="Nome" required span="full">
              <Input name="name" defaultValue={material?.name ?? ''} required autoFocus />
            </Field>

            <Field label="Tipo" required>
              <Select name="type_code" defaultValue={material?.type_code ?? 'GRANITO'} required>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {types.map((type) => (
                    <SelectItem key={type.code} value={type.code}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Cor / tonalidade">
              <Input name="color" defaultValue={material?.color ?? ''} />
            </Field>

            <Field label="Origem">
              <Select name="origin" defaultValue={material?.origin ?? 'NENHUM'}>
                <SelectTrigger>
                  <SelectValue placeholder="Não informada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NENHUM">Não informada</SelectItem>
                  <SelectItem value="NACIONAL">Nacional</SelectItem>
                  <SelectItem value="IMPORTADO">Importado</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Espessura padrão (mm)">
              <Input name="thickness_mm" type="number" min={0} defaultValue={material?.thickness_mm ?? ''} />
            </Field>

            <Field label="Preço de venda por m²">
              <MoneyInput name="price_per_m2" defaultValue={Number(material?.price_per_m2 ?? 0)} />
            </Field>

            <Field label="Unidade de controle">
              <Select name="unit" defaultValue={material?.unit ?? 'M2'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['M2', 'ML', 'UN', 'KG', 'L', 'PC'].map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Estoque mínimo" hint="Abaixo disso o sistema alerta">
              <Input name="min_quantity" type="number" min={0} step="0.01" defaultValue={material?.min_quantity ?? 0} />
            </Field>

            <Field label="Fornecedor" span="full">
              <Input name="supplier" defaultValue={material?.supplier ?? ''} />
            </Field>
          </FormSection>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Salvar material
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
