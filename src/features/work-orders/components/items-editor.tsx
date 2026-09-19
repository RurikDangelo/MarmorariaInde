'use client'

import * as React from 'react'
import { useActionForm } from '@/lib/hooks/use-action-form'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Field, FormSection } from '@/components/shared/form'
import { DimensionInput, MoneyInput } from '@/components/shared/inputs'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/states'
import { GenericStatusBadge } from '@/components/shared/status-badge'
import { formatArea, formatCurrency, formatDimensions } from '@/lib/utils'
import { deleteWorkOrderItem, saveWorkOrderItem } from '@/features/work-orders/actions'
import type { WorkOrderItem } from '@/types/database'

interface MaterialOption {
  id: string
  name: string
  color: string | null
  price_per_m2: number | null
  thickness_mm: number | null
}

const FINISHES = ['Polido', 'Levigado', 'Apicoado', 'Flameado', 'Escovado', 'Bruto']
const EDGES = ['Reta', 'Boleada', 'Meia-esquadria', 'Bisotê', 'Meia-cana', 'Dupla boleada']

export function ItemsEditor({
  workOrderId,
  items,
  materials,
  canEdit,
}: {
  workOrderId: string
  items: WorkOrderItem[]
  materials: MaterialOption[]
  canEdit: boolean
}) {
  const [editing, setEditing] = React.useState<WorkOrderItem | null>(null)
  const [open, setOpen] = React.useState(false)

  const totals = items.reduce(
    (acc, item) => ({
      area: acc.area + Number(item.area_m2 ?? 0),
      value: acc.value + Number(item.total_price ?? 0),
    }),
    { area: 0, value: 0 },
  )

  function openNew() {
    setEditing(null)
    setOpen(true)
  }

  function openEdit(item: WorkOrderItem) {
    setEditing(item)
    setOpen(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Peças da OS</h2>
          <p className="text-xs text-muted-foreground">
            Medidas em metros. O m² e o valor são calculados pelo sistema.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={openNew}>
            <Plus />
            Adicionar peça
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Nenhuma peça cadastrada"
          description="Adicione as peças com material, medidas e acabamento."
          action={canEdit ? <Button size="sm" onClick={openNew}>Adicionar peça</Button> : undefined}
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Peça</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Medidas</TableHead>
                  <TableHead className="text-right">m²</TableHead>
                  <TableHead>Acabamento</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  {canEdit && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{item.description}</p>
                      {item.environment && (
                        <p className="text-xs text-muted-foreground">{item.environment}</p>
                      )}
                      <ItemExtras item={item} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.material?.name ?? '—'}
                      {item.color && <span className="block text-xs text-muted-foreground">{item.color}</span>}
                    </TableCell>
                    <TableCell className="text-sm tabular">
                      {formatDimensions(item.length_mm, item.width_mm)}
                      <span className="block text-xs text-muted-foreground">
                        {item.quantity}× {item.thickness_mm ? `· ${item.thickness_mm}mm` : ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular">{formatArea(item.area_m2)}</TableCell>
                    <TableCell className="text-sm">
                      {item.finish ?? '—'}
                      {item.edge && <span className="block text-xs text-muted-foreground">{item.edge}</span>}
                    </TableCell>
                    <TableCell>
                      <GenericStatusBadge status={item.production_status} />
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium tabular">
                      {formatCurrency(item.total_price)}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(item)} aria-label="Editar peça">
                            <Pencil />
                          </Button>
                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" size="icon-sm" aria-label="Remover peça">
                                <Trash2 className="text-destructive" />
                              </Button>
                            }
                            title="Remover peça"
                            description={`"${item.description}" será removida da OS.`}
                            variant="destructive"
                            confirmLabel="Remover"
                            onConfirm={async () => {
                              const result = await deleteWorkOrderItem(item.id, workOrderId)
                              if (result.error) toast.error(result.error)
                              else toast.success(result.success ?? 'Peça removida.')
                            }}
                          />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-end gap-6 border-t px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">
                Total: <span className="tabular font-medium text-foreground">{formatArea(totals.area)}</span>
              </span>
              <span className="tabular font-semibold">{formatCurrency(totals.value)}</span>
            </div>
          </div>

          {/* Mobile */}
          <div className="flex flex-col gap-2.5 md:hidden">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border bg-card p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{item.description}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.environment ? `${item.environment} · ` : ''}
                      {item.material?.name ?? 'Sem material'}
                    </p>
                  </div>
                  <GenericStatusBadge status={item.production_status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="tabular">{formatDimensions(item.length_mm, item.width_mm)}</span>
                  <span className="tabular">{formatArea(item.area_m2)}</span>
                  {item.finish && <span>{item.finish}</span>}
                  <span className="tabular ml-auto font-medium text-foreground">
                    {formatCurrency(item.total_price)}
                  </span>
                </div>
                {canEdit && (
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(item)}>
                      <Pencil />
                      Editar
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="outline" size="sm" aria-label="Remover peça">
                          <Trash2 className="text-destructive" />
                        </Button>
                      }
                      title="Remover peça"
                      description={`"${item.description}" será removida da OS.`}
                      variant="destructive"
                      confirmLabel="Remover"
                      onConfirm={async () => {
                        const result = await deleteWorkOrderItem(item.id, workOrderId)
                        if (result.error) toast.error(result.error)
                        else toast.success(result.success ?? 'Peça removida.')
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg border bg-secondary/40 px-3.5 py-2.5 text-sm">
              <span className="text-muted-foreground tabular">{formatArea(totals.area)}</span>
              <span className="tabular font-semibold">{formatCurrency(totals.value)}</span>
            </div>
          </div>
        </>
      )}

      {canEdit && (
        <ItemDialog
          key={editing?.id ?? 'novo'}
          open={open}
          onOpenChange={setOpen}
          workOrderId={workOrderId}
          item={editing}
          materials={materials}
        />
      )}
    </div>
  )
}

function ItemExtras({ item }: { item: WorkOrderItem }) {
  const extras: string[] = []
  if (item.has_sink) extras.push(`Cuba${item.sink_type ? ` ${item.sink_type}` : ''}${item.sink_quantity > 1 ? ` ×${item.sink_quantity}` : ''}`)
  if (item.has_cooktop) extras.push(`Cooktop${item.cooktop_type ? ` ${item.cooktop_type}` : ''}`)
  if (item.cutouts > 0) extras.push(`${item.cutouts} recorte${item.cutouts > 1 ? 's' : ''}`)
  if (item.faucet_holes > 0) extras.push(`${item.faucet_holes} furo torneira`)
  if (item.outlet_holes > 0) extras.push(`${item.outlet_holes} furo tomada`)
  if (item.skirt_mm) extras.push(`Saia ${item.skirt_mm}mm`)
  if (item.backsplash_mm) extras.push(`Frontão ${item.backsplash_mm}mm`)

  if (!extras.length) return null

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {extras.map((extra) => (
        <Badge key={extra} variant="secondary" size="sm">
          {extra}
        </Badge>
      ))}
    </div>
  )
}

function ItemDialog({
  open,
  onOpenChange,
  workOrderId,
  item,
  materials,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderId: string
  item: WorkOrderItem | null
  materials: MaterialOption[]
}) {
  const [, formAction, pending] = useActionForm(saveWorkOrderItem, { onSuccess: () => onOpenChange(false) })
  const [hasSink, setHasSink] = React.useState(item?.has_sink ?? false)
  const [hasCooktop, setHasCooktop] = React.useState(item?.has_cooktop ?? false)
  const [materialId, setMaterialId] = React.useState(item?.material_id ?? 'NENHUM')
  const [unitPrice, setUnitPrice] = React.useState(Number(item?.unit_price ?? 0))

  function handleMaterialChange(value: string) {
    setMaterialId(value)
    const material = materials.find((option) => option.id === value)
    if (material?.price_per_m2) setUnitPrice(Number(material.price_per_m2))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar peça' : 'Nova peça'}</DialogTitle>
          <DialogDescription>
            Informe medidas em metros (ex.: 2,45). O sistema calcula o m² e o valor.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="work_order_id" value={workOrderId} />
          {item && <input type="hidden" name="id" value={item.id} />}

          <FormSection columns={2}>
            <Field label="Descrição" required span="full" htmlFor="description">
              <Input
                id="description"
                name="description"
                defaultValue={item?.description ?? ''}
                placeholder="Ex.: Bancada da pia"
                required
                autoFocus
              />
            </Field>

            <Field label="Ambiente" htmlFor="environment">
              <Input id="environment" name="environment" defaultValue={item?.environment ?? ''} placeholder="Cozinha" />
            </Field>

            <Field label="Material" htmlFor="material_id">
              <Select name="material_id" value={materialId} onValueChange={handleMaterialChange}>
                <SelectTrigger id="material_id">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NENHUM">Sem material definido</SelectItem>
                  {materials.map((material) => (
                    <SelectItem key={material.id} value={material.id}>
                      {material.name}
                      {material.color ? ` · ${material.color}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Cor / veio" htmlFor="color">
              <Input id="color" name="color" defaultValue={item?.color ?? ''} />
            </Field>

            <Field label="Espessura (mm)" htmlFor="thickness_mm">
              <Input
                id="thickness_mm"
                name="thickness_mm"
                type="number"
                min={0}
                step={1}
                defaultValue={item?.thickness_mm ?? ''}
                placeholder="20"
              />
            </Field>
          </FormSection>

          <FormSection title="Medidas e valor" columns={4}>
            <Field label="Comprimento" htmlFor="length_mm">
              <DimensionInput id="length_mm" name="length_mm" defaultValueMm={item?.length_mm ?? 0} />
            </Field>
            <Field label="Largura" htmlFor="width_mm">
              <DimensionInput id="width_mm" name="width_mm" defaultValueMm={item?.width_mm ?? 0} />
            </Field>
            <Field label="Quantidade" htmlFor="quantity">
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min={1}
                step="0.01"
                defaultValue={item?.quantity ?? 1}
                className="tabular"
              />
            </Field>
            <Field label="Cobrança por" htmlFor="pricing_mode">
              <Select name="pricing_mode" defaultValue={item?.pricing_mode ?? 'M2'}>
                <SelectTrigger id="pricing_mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M2">Metro quadrado</SelectItem>
                  <SelectItem value="ML">Metro linear</SelectItem>
                  <SelectItem value="UN">Unidade</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Preço unitário" htmlFor="unit_price" span="full">
              <MoneyInput
                id="unit_price"
                name="unit_price"
                value={unitPrice}
                onValueChange={setUnitPrice}
              />
            </Field>
          </FormSection>

          <FormSection title="Beneficiamento" columns={3}>
            <Field label="Acabamento" htmlFor="finish">
              <Select name="finish" defaultValue={item?.finish ?? 'NENHUM'}>
                <SelectTrigger id="finish">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NENHUM">Não definido</SelectItem>
                  {FINISHES.map((finish) => (
                    <SelectItem key={finish} value={finish}>
                      {finish}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Borda" htmlFor="edge">
              <Select name="edge" defaultValue={item?.edge ?? 'NENHUM'}>
                <SelectTrigger id="edge">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NENHUM">Não definido</SelectItem>
                  {EDGES.map((edge) => (
                    <SelectItem key={edge} value={edge}>
                      {edge}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Recortes" htmlFor="cutouts">
              <Input id="cutouts" name="cutouts" type="number" min={0} defaultValue={item?.cutouts ?? 0} />
            </Field>

            <Field label="Saia (mm)" htmlFor="skirt_mm">
              <Input id="skirt_mm" name="skirt_mm" type="number" min={0} defaultValue={item?.skirt_mm ?? ''} />
            </Field>
            <Field label="Frontão (mm)" htmlFor="backsplash_mm">
              <Input
                id="backsplash_mm"
                name="backsplash_mm"
                type="number"
                min={0}
                defaultValue={item?.backsplash_mm ?? ''}
              />
            </Field>
            <Field label="Furos extras" htmlFor="extra_holes">
              <Input id="extra_holes" name="extra_holes" type="number" min={0} defaultValue={item?.extra_holes ?? 0} />
            </Field>

            <Field label="Furos de torneira" htmlFor="faucet_holes">
              <Input id="faucet_holes" name="faucet_holes" type="number" min={0} defaultValue={item?.faucet_holes ?? 0} />
            </Field>
            <Field label="Furos de tomada" htmlFor="outlet_holes">
              <Input id="outlet_holes" name="outlet_holes" type="number" min={0} defaultValue={item?.outlet_holes ?? 0} />
            </Field>
          </FormSection>

          <FormSection title="Cuba e cooktop" columns={2}>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="has_sink" checked={hasSink} onCheckedChange={(value) => setHasSink(!!value)} />
                Tem cuba
              </label>
              {hasSink && (
                <div className="grid grid-cols-2 gap-2">
                  <Select name="sink_type" defaultValue={item?.sink_type ?? 'Sobrepor'}>
                    <SelectTrigger aria-label="Tipo de cuba">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sobrepor">Sobrepor</SelectItem>
                      <SelectItem value="Embutir">Embutir</SelectItem>
                      <SelectItem value="Esculpida">Esculpida</SelectItem>
                      <SelectItem value="Sob medida">Sob medida</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    name="sink_quantity"
                    type="number"
                    min={0}
                    defaultValue={item?.sink_quantity || 1}
                    aria-label="Quantidade de cubas"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  name="has_cooktop"
                  checked={hasCooktop}
                  onCheckedChange={(value) => setHasCooktop(!!value)}
                />
                Tem cooktop
              </label>
              {hasCooktop && (
                <Input name="cooktop_type" defaultValue={item?.cooktop_type ?? ''} placeholder="Ex.: 4 bocas 60cm" />
              )}
            </div>
          </FormSection>

          <Field label="Observações da peça" htmlFor="notes">
            <Textarea id="notes" name="notes" rows={2} defaultValue={item?.notes ?? ''} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              {item ? 'Salvar peça' : 'Adicionar peça'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
