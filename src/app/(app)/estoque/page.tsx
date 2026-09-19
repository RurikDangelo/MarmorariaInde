import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, Layers, Recycle, TrendingDown } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { DataTable, type Column } from '@/components/shared/data-table'
import { GenericStatusBadge } from '@/components/shared/status-badge'
import { ClearFiltersButton, FilterBar, FilterSelect, SearchInput } from '@/components/shared/filters'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatArea, formatCurrency, formatDateTime, formatDimensions, formatNumber } from '@/lib/utils'
import { MaterialDialog, StockItemDialog } from '@/features/stock/components/stock-dialogs'
import type { Material, MaterialType, StockItem, StockLocation, StockMovement } from '@/types/database'

export const metadata: Metadata = { title: 'Estoque' }

const MOVEMENT_LABELS: Record<string, string> = {
  ENTRADA: 'Entrada',
  RESERVA: 'Reserva',
  LIBERACAO: 'Liberação',
  CONSUMO: 'Consumo',
  SOBRA: 'Sobra/retalho',
  PERDA: 'Perda',
  AJUSTE: 'Ajuste',
  TRANSFERENCIA: 'Transferência',
  DESCARTE: 'Descarte',
}

const LOSS_LABELS: Record<string, string> = {
  QUEBRA: 'Quebra',
  ERRO_CORTE: 'Erro de corte',
  DEFEITO: 'Defeito',
  MEDICAO_INCORRETA: 'Medição incorreta',
  TRANSPORTE: 'Transporte',
  RETRABALHO: 'Retrabalho',
  OUTRO: 'Outro',
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; status?: string; tipo?: string }>
}) {
  const user = await requirePermission('stock.read')
  const params = await searchParams
  const canWrite = user.permissions.has('stock.write')
  const supabase = await createClient()

  let itemsQuery = supabase
    .from('stock_items')
    .select(
      `*,
       material:materials!stock_items_material_id_fkey ( id, name, color, type_code ),
       location:stock_locations!stock_items_location_id_fkey ( id, name, kind, notes, active ),
       work_order:work_orders!stock_items_reserved_work_order_id_fkey ( id, number )`,
      { count: 'exact' },
    )

  if (params.status) itemsQuery = itemsQuery.eq('status', params.status)
  if (params.tipo) itemsQuery = itemsQuery.eq('kind', params.tipo)

  const [
    { data: items, count },
    { data: materials },
    { data: types },
    { data: locations },
    { data: movements },
  ] = await Promise.all([
    itemsQuery.order('created_at', { ascending: false }).limit(200).returns<StockItem[]>(),
    supabase
      .from('materials')
      .select('*, material_type:material_types!materials_type_code_fkey ( code, label, category, sort_order )')
      .eq('active', true)
      .order('name')
      .returns<Material[]>(),
    supabase.from('material_types').select('*').order('sort_order').returns<MaterialType[]>(),
    supabase.from('stock_locations').select('*').eq('active', true).order('name').returns<StockLocation[]>(),
    supabase
      .from('stock_movements')
      .select(
        `*,
         material:materials!stock_movements_material_id_fkey ( id, name ),
         stock_item:stock_items!stock_movements_stock_item_id_fkey ( id, code ),
         work_order:work_orders!stock_movements_work_order_id_fkey ( id, number ),
         author:profiles!stock_movements_created_by_fkey ( id, full_name )`,
      )
      .order('created_at', { ascending: false })
      .limit(100)
      .returns<StockMovement[]>(),
  ])

  const allItems = items ?? []
  const filtered = params.busca
    ? allItems.filter((item) => {
        const term = params.busca!.toLowerCase()
        return (
          item.code?.toLowerCase().includes(term) ||
          item.material?.name.toLowerCase().includes(term) ||
          item.batch?.toLowerCase().includes(term)
        )
      })
    : allItems

  const available = allItems.filter((item) => item.status === 'DISPONIVEL')
  const remnants = available.filter((item) => item.is_remnant)
  const availableArea = available.reduce((sum, item) => sum + Number(item.area_m2 ?? 0), 0)
  const stockValue = available.reduce((sum, item) => sum + Number(item.unit_cost ?? 0), 0)

  const losses = (movements ?? []).filter(
    (movement) => movement.movement_type === 'PERDA' || movement.movement_type === 'DESCARTE',
  )
  const consumed = (movements ?? []).filter((movement) => movement.movement_type === 'CONSUMO')
  const lostArea = losses.reduce((sum, movement) => sum + Number(movement.area_m2 ?? 0), 0)
  const lostCost = losses.reduce((sum, movement) => sum + Number(movement.total_cost ?? 0), 0)
  const consumedArea = consumed.reduce((sum, movement) => sum + Number(movement.area_m2 ?? 0), 0)
  const wastePct = consumedArea + lostArea > 0 ? (lostArea / (consumedArea + lostArea)) * 100 : 0

  const lossByReason = Object.entries(
    losses.reduce<Record<string, { area: number; cost: number; count: number }>>((acc, movement) => {
      const key = movement.loss_reason ?? 'OUTRO'
      acc[key] ??= { area: 0, cost: 0, count: 0 }
      acc[key].area += Number(movement.area_m2 ?? 0)
      acc[key].cost += Number(movement.total_cost ?? 0)
      acc[key].count += 1
      return acc
    }, {}),
  ).sort((a, b) => b[1].cost - a[1].cost)

  const itemColumns: Column<StockItem>[] = [
    {
      key: 'item',
      header: 'Item',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium">
            {row.material?.name ?? 'Material'}
            {row.is_remnant && (
              <Badge variant="warning" size="sm" className="ml-1.5">
                retalho
              </Badge>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.code ?? 'sem código'}
            {row.batch ? ` · lote ${row.batch}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'dimensions',
      header: 'Medidas',
      render: (row) =>
        row.kind === 'CHAPA' ? (
          <span className="text-sm tabular">
            {formatDimensions(row.length_mm, row.width_mm)}
            <span className="block text-xs text-muted-foreground">
              {row.thickness_mm ? `${row.thickness_mm} mm · ` : ''}
              {formatArea(row.area_m2)}
            </span>
          </span>
        ) : (
          <span className="text-sm tabular">
            {formatNumber(row.quantity, 2)} {row.unit}
          </span>
        ),
    },
    {
      key: 'location',
      header: 'Local',
      secondary: true,
      render: (row) => <span className="text-sm">{row.location?.name ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Situação',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <GenericStatusBadge status={row.status} />
          {row.work_order && (
            <Link href={`/os/${row.work_order.id}`} className="text-xs text-primary hover:underline">
              {row.work_order.number}
            </Link>
          )}
        </div>
      ),
    },
    {
      key: 'cost',
      header: 'Custo',
      align: 'right',
      secondary: true,
      render: (row) => <span className="text-sm tabular">{formatCurrency(row.unit_cost)}</span>,
    },
  ]

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Estoque"
        description="Chapas, retalhos e insumos — com reserva, consumo e perdas rastreados."
        actions={
          canWrite ? (
            <>
              <MaterialDialog types={types ?? []} />
              <StockItemDialog materials={materials ?? []} locations={locations ?? []} />
            </>
          ) : undefined
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Chapas disponíveis" value={available.filter((item) => item.kind === 'CHAPA').length} icon={Layers} hint={formatArea(availableArea)} />
        <MetricCard label="Retalhos aproveitáveis" value={remnants.length} icon={Recycle} tone="info" />
        <MetricCard label="Valor em estoque" value={formatCurrency(stockValue)} icon={Layers} tone="success" />
        <MetricCard
          label="Desperdício"
          value={`${formatNumber(wastePct, 1)}%`}
          icon={TrendingDown}
          tone={wastePct > 10 ? 'destructive' : 'success'}
          hint={`${formatArea(lostArea)} · ${formatCurrency(lostCost)}`}
        />
      </section>

      <Tabs defaultValue="itens">
        <TabsList>
          <TabsTrigger value="itens">Itens</TabsTrigger>
          <TabsTrigger value="materiais">Materiais</TabsTrigger>
          <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
          <TabsTrigger value="desperdicio">Desperdício</TabsTrigger>
        </TabsList>

        <TabsContent value="itens" className="flex flex-col gap-4">
          <FilterBar>
            <SearchInput placeholder="Buscar por código, material ou lote…" />
            <FilterSelect
              paramName="status"
              label="Situação"
              allLabel="Todas"
              options={[
                { value: 'DISPONIVEL', label: 'Disponível' },
                { value: 'RESERVADA', label: 'Reservada' },
                { value: 'EM_PRODUCAO', label: 'Em produção' },
                { value: 'CONSUMIDA', label: 'Consumida' },
                { value: 'DANIFICADA', label: 'Danificada' },
                { value: 'DESCARTADA', label: 'Descartada' },
              ]}
            />
            <FilterSelect
              paramName="tipo"
              label="Tipo"
              allLabel="Todos"
              options={[
                { value: 'CHAPA', label: 'Chapas' },
                { value: 'INSUMO', label: 'Insumos' },
              ]}
            />
            <ClearFiltersButton keys={['busca', 'status', 'tipo']} />
          </FilterBar>

          <DataTable
            columns={itemColumns}
            rows={filtered}
            rowKey={(row) => row.id}
            emptyTitle="Nenhum item no estoque"
            emptyDescription="Cadastre a entrada das chapas e insumos."
            footer={`${filtered.length} de ${count ?? filtered.length} item(ns)`}
            mobileCard={(row) => (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{row.material?.name}</p>
                    <p className="text-xs text-muted-foreground">{row.code ?? 'sem código'}</p>
                  </div>
                  <GenericStatusBadge status={row.status} />
                </div>
                <p className="text-xs tabular text-muted-foreground">
                  {row.kind === 'CHAPA'
                    ? `${formatDimensions(row.length_mm, row.width_mm)} · ${formatArea(row.area_m2)}`
                    : `${formatNumber(row.quantity, 2)} ${row.unit}`}
                </p>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="materiais">
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'Material',
                render: (row: Material) => (
                  <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.material_type?.label ?? row.type_code}
                      {row.color ? ` · ${row.color}` : ''}
                      {row.origin ? ` · ${row.origin.toLowerCase()}` : ''}
                    </p>
                  </div>
                ),
              },
              {
                key: 'price',
                header: 'Preço m²',
                align: 'right',
                render: (row: Material) => <span className="tabular text-sm">{formatCurrency(row.price_per_m2)}</span>,
              },
              {
                key: 'stock',
                header: 'Em estoque',
                align: 'right',
                render: (row: Material) => {
                  const inStock = allItems.filter(
                    (item) => item.material_id === row.id && item.status === 'DISPONIVEL',
                  )
                  const low = row.min_quantity > 0 && inStock.length < row.min_quantity
                  return (
                    <span className={`tabular text-sm ${low ? 'font-medium text-destructive' : ''}`}>
                      {inStock.length}
                      {low && <AlertTriangle className="ml-1 inline size-3.5" />}
                    </span>
                  )
                },
              },
              {
                key: 'supplier',
                header: 'Fornecedor',
                secondary: true,
                render: (row: Material) => <span className="text-sm">{row.supplier ?? '—'}</span>,
              },
            ]}
            rows={materials ?? []}
            rowKey={(row) => row.id}
            emptyTitle="Nenhum material cadastrado"
            emptyDescription="Cadastre os granitos, mármores e insumos que a marmoraria trabalha."
            mobileCard={(row) => (
              <div>
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-muted-foreground">
                  {row.material_type?.label ?? row.type_code} · {formatCurrency(row.price_per_m2)}/m²
                </p>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="movimentacoes">
          <DataTable
            columns={[
              {
                key: 'date',
                header: 'Quando',
                render: (row: StockMovement) => (
                  <span className="text-sm">{formatDateTime(row.created_at)}</span>
                ),
              },
              {
                key: 'type',
                header: 'Movimento',
                render: (row: StockMovement) => (
                  <div>
                    <p className="text-sm font-medium">{MOVEMENT_LABELS[row.movement_type] ?? row.movement_type}</p>
                    {row.loss_reason && (
                      <p className="text-xs text-destructive">{LOSS_LABELS[row.loss_reason] ?? row.loss_reason}</p>
                    )}
                  </div>
                ),
              },
              {
                key: 'item',
                header: 'Item',
                render: (row: StockMovement) => (
                  <span className="text-sm">
                    {row.material?.name ?? '—'}
                    {row.stock_item?.code ? ` · ${row.stock_item.code}` : ''}
                  </span>
                ),
              },
              {
                key: 'os',
                header: 'OS',
                secondary: true,
                render: (row: StockMovement) =>
                  row.work_order ? (
                    <Link href={`/os/${row.work_order.id}`} className="text-sm text-primary hover:underline">
                      {row.work_order.number}
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  ),
              },
              {
                key: 'area',
                header: 'Área',
                align: 'right',
                render: (row: StockMovement) => (
                  <span className="text-sm tabular">{row.area_m2 ? formatArea(row.area_m2) : '—'}</span>
                ),
              },
              {
                key: 'author',
                header: 'Quem',
                secondary: true,
                render: (row: StockMovement) => (
                  <span className="text-sm">{row.author?.full_name ?? '—'}</span>
                ),
              },
            ]}
            rows={movements ?? []}
            rowKey={(row) => row.id}
            emptyTitle="Nenhuma movimentação registrada"
            mobileCard={(row) => (
              <div>
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-medium">{MOVEMENT_LABELS[row.movement_type] ?? row.movement_type}</p>
                  <span className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{row.material?.name}</p>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="desperdicio" className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Área consumida" value={formatArea(consumedArea)} icon={Layers} />
            <MetricCard label="Área perdida" value={formatArea(lostArea)} icon={TrendingDown} tone="destructive" />
            <MetricCard label="Custo perdido" value={formatCurrency(lostCost)} icon={TrendingDown} tone="destructive" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Perdas por motivo</CardTitle>
              <p className="text-sm text-muted-foreground">Últimas 100 movimentações.</p>
            </CardHeader>
            <CardContent>
              {lossByReason.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma perda registrada. Continue assim.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {lossByReason.map(([reason, values]) => (
                    <li key={reason} className="flex items-center gap-3">
                      <span className="w-36 shrink-0 text-sm">{LOSS_LABELS[reason] ?? reason}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-destructive/70"
                          style={{
                            width: `${lostCost > 0 ? (values.cost / lostCost) * 100 : 0}%`,
                          }}
                        />
                      </span>
                      <span className="w-28 shrink-0 text-right text-sm tabular">
                        {formatCurrency(values.cost)}
                      </span>
                      <span className="w-20 shrink-0 text-right text-xs tabular text-muted-foreground">
                        {values.count}×
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
