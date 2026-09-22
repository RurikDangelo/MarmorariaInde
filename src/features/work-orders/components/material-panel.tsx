'use client'

import * as React from 'react'
import { useActionForm } from '@/lib/hooks/use-action-form'
import { AlertTriangle, Layers, PackageCheck, PackageMinus, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FormSection } from '@/components/shared/form'
import { DimensionInput } from '@/components/shared/inputs'
import { EmptyState } from '@/components/shared/states'
import { GenericStatusBadge } from '@/components/shared/status-badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { formatArea, formatCurrency, formatDimensions } from '@/lib/utils'
import { consumeStockItem, registerStockLoss, releaseStockItem, reserveStockItem } from '@/features/stock/actions'
import type { MaterialNeed } from '@/features/composition/components/materials-summary'
import type { StockItem } from '@/types/database'
import { MaterialNeeds } from './material-needs'

const LOSS_REASONS = [
  { value: 'QUEBRA', label: 'Quebra' },
  { value: 'ERRO_CORTE', label: 'Erro de corte' },
  { value: 'DEFEITO', label: 'Defeito do material' },
  { value: 'MEDICAO_INCORRETA', label: 'Medição incorreta' },
  { value: 'TRANSPORTE', label: 'Transporte' },
  { value: 'RETRABALHO', label: 'Retrabalho' },
  { value: 'OUTRO', label: 'Outro' },
]

export function MaterialPanel({
  workOrderId,
  reserved,
  available,
  needs,
  canWrite,
}: {
  workOrderId: string
  reserved: StockItem[]
  available: StockItem[]
  /** m² que a montagem da OS consome, por material (com perda). */
  needs: MaterialNeed[]
  canWrite: boolean
}) {
  const totalArea = reserved.reduce((sum, item) => sum + Number(item.area_m2 ?? 0), 0)
  const totalCost = reserved.reduce((sum, item) => sum + Number(item.unit_cost ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      {needs.length > 0 && <MaterialNeeds needs={needs} reserved={reserved} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Material da OS</h2>
          <p className="text-xs text-muted-foreground">
            {reserved.length} item(ns) · {formatArea(totalArea)} · custo {formatCurrency(totalCost)}
          </p>
        </div>
        {canWrite && <ReserveDialog workOrderId={workOrderId} available={available} />}
      </div>

      {reserved.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Nenhum material reservado"
          description="Reserve a chapa para esta OS: o estoque passa a mostrar o material comprometido."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {reserved.map((item) => (
            <Card key={item.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{item.material?.name ?? 'Material'}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.code ?? 'sem código'}
                      {item.is_remnant ? ' · retalho' : ''}
                    </p>
                  </div>
                  <GenericStatusBadge status={item.status} />
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Medidas</dt>
                    <dd className="tabular">{formatDimensions(item.length_mm, item.width_mm)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Área</dt>
                    <dd className="tabular">{formatArea(item.area_m2)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Espessura</dt>
                    <dd className="tabular">{item.thickness_mm ? `${item.thickness_mm} mm` : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Custo</dt>
                    <dd className="tabular">{formatCurrency(item.unit_cost)}</dd>
                  </div>
                </dl>

                {canWrite && item.status !== 'CONSUMIDA' && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
                    <ConsumeDialog workOrderId={workOrderId} item={item} />
                    <LossDialog workOrderId={workOrderId} item={item} />
                    {item.status === 'RESERVADA' && (
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="sm">
                            <Undo2 />
                            Liberar
                          </Button>
                        }
                        title="Liberar reserva"
                        description="O material volta a ficar disponível no estoque."
                        confirmLabel="Liberar"
                        onConfirm={async () => {
                          const result = await releaseStockItem(item.id, workOrderId)
                          if (result.error) toast.error(result.error)
                          else toast.success(result.success ?? 'Reserva liberada.')
                        }}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function ReserveDialog({ workOrderId, available }: { workOrderId: string; available: StockItem[] }) {
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<string>('')
  const [pending, startTransition] = React.useTransition()

  function handleReserve() {
    if (!selected) {
      toast.error('Selecione a chapa.')
      return
    }
    startTransition(async () => {
      const result = await reserveStockItem(selected, workOrderId)
      if (result.error) toast.error(result.error)
      else {
        toast.success(result.success ?? 'Reservado.')
        setOpen(false)
        setSelected('')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PackageCheck />
          Reservar material
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reservar material para a OS</DialogTitle>
          <DialogDescription>Apenas itens com status disponível aparecem aqui.</DialogDescription>
        </DialogHeader>

        {available.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum item disponível no estoque.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-md border">
            {available.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item.id)}
                className={`flex w-full items-start justify-between gap-3 border-b px-3 py-2.5 text-left last:border-0 transition-colors ${
                  selected === item.id ? 'bg-primary/10' : 'hover:bg-secondary'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {item.material?.name ?? 'Material'}
                    {item.is_remnant && <span className="ml-1.5 text-xs text-warning">retalho</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.code ?? 'sem código'} · {formatDimensions(item.length_mm, item.width_mm)}
                    {item.thickness_mm ? ` · ${item.thickness_mm}mm` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-xs tabular text-muted-foreground">{formatArea(item.area_m2)}</span>
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleReserve} loading={pending} disabled={!selected}>
            Reservar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConsumeDialog({ workOrderId, item }: { workOrderId: string; item: StockItem }) {
  const [open, setOpen] = React.useState(false)
  const [, formAction, pending] = useActionForm(consumeStockItem, { onSuccess: () => setOpen(false) })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PackageMinus />
          Consumir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Baixar material da OS</DialogTitle>
          <DialogDescription>
            Informe a sobra aproveitável para que ela volte ao estoque como retalho.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="stock_item_id" value={item.id} />
          <input type="hidden" name="work_order_id" value={workOrderId} />

          <FormSection columns={2}>
            <Field label="Área utilizada (m²)" hint={`Total da chapa: ${formatArea(item.area_m2)}`}>
              <Input name="used_area_m2" type="number" step="0.01" min={0} defaultValue={item.area_m2 ?? 0} />
            </Field>
            <div />
            <Field label="Sobra: comprimento">
              <DimensionInput name="remnant_length_mm" />
            </Field>
            <Field label="Sobra: largura">
              <DimensionInput name="remnant_width_mm" />
            </Field>
            <Field label="Observação" span="full">
              <Textarea name="notes" rows={2} />
            </Field>
          </FormSection>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Confirmar baixa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function LossDialog({ workOrderId, item }: { workOrderId: string; item: StockItem }) {
  const [open, setOpen] = React.useState(false)
  const [, formAction, pending] = useActionForm(registerStockLoss, { onSuccess: () => setOpen(false) })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
          <AlertTriangle />
          Perda
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar perda</DialogTitle>
          <DialogDescription>
            A perda entra no cálculo de desperdício e no custo real da OS.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="stock_item_id" value={item.id} />
          <input type="hidden" name="work_order_id" value={workOrderId} />

          <Field label="Motivo" required>
            <Select name="reason" defaultValue="QUEBRA" required>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOSS_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Detalhes">
            <Textarea name="notes" rows={2} />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="discard" />
            Descartar definitivamente (não é mais aproveitável)
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" loading={pending}>
              Registrar perda
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
