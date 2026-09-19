import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type {
  Installation,
  Measurement,
  ProductionRecord,
  StockItem,
  WorkOrder,
  WorkOrderAttachment,
  WorkOrderHistory,
  WorkOrderItem,
  WorkOrderPhoto,
  WorkOrderStatus,
} from '@/types/database'

const LIST_SELECT = `
  id, number, title, status_code, priority, deadline, total_value, received_value, pending_value,
  created_at, updated_at, finished_at, cancelled_at, is_demo, customer_id, assigned_to,
  customer:customers!work_orders_customer_id_fkey ( id, name, phone, city ),
  status:work_order_statuses!work_orders_status_code_fkey ( code, label, color, sort_order, is_terminal ),
  assignee:profiles!work_orders_assigned_to_fkey ( id, full_name, avatar_url ),
  team:teams!work_orders_team_id_fkey ( id, name )
`

export const getWorkOrderStatuses = cache(async (): Promise<WorkOrderStatus[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('work_order_statuses')
    .select('*')
    .order('sort_order')
    .returns<WorkOrderStatus[]>()
  return data ?? []
})

export interface WorkOrderFilters {
  busca?: string
  status?: string
  prioridade?: string
  responsavel?: string
  situacao?: 'abertas' | 'atrasadas' | 'finalizadas' | 'canceladas'
  pagina?: number
}

const PAGE_SIZE = 25

export async function listWorkOrders(filters: WorkOrderFilters = {}) {
  const supabase = await createClient()
  const page = Math.max(1, filters.pagina ?? 1)
  const from = (page - 1) * PAGE_SIZE

  let query = supabase.from('work_orders').select(LIST_SELECT, { count: 'exact' })

  if (filters.busca) {
    const term = filters.busca.replace(/[%,()]/g, '')
    query = query.or(`number.ilike.%${term}%,title.ilike.%${term}%`)
  }
  if (filters.status) query = query.eq('status_code', filters.status)
  if (filters.prioridade) query = query.eq('priority', filters.prioridade)
  if (filters.responsavel) query = query.eq('assigned_to', filters.responsavel)

  const today = new Date().toISOString().slice(0, 10)
  if (filters.situacao === 'abertas') {
    query = query.is('finished_at', null).is('cancelled_at', null)
  } else if (filters.situacao === 'atrasadas') {
    query = query.is('finished_at', null).is('cancelled_at', null).lt('deadline', today)
  } else if (filters.situacao === 'finalizadas') {
    query = query.not('finished_at', 'is', null)
  } else if (filters.situacao === 'canceladas') {
    query = query.not('cancelled_at', 'is', null)
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
    .returns<WorkOrder[]>()

  if (error) throw new Error(error.message)

  return {
    rows: data ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
  }
}

/** Cards do Kanban: apenas OS não finalizadas, agrupadas por status. */
export async function getKanbanData(filters: { busca?: string; prioridade?: string; responsavel?: string } = {}) {
  const supabase = await createClient()

  let query = supabase.from('work_orders').select(LIST_SELECT).is('cancelled_at', null)

  if (filters.busca) {
    const term = filters.busca.replace(/[%,()]/g, '')
    query = query.or(`number.ilike.%${term}%,title.ilike.%${term}%`)
  }
  if (filters.prioridade) query = query.eq('priority', filters.prioridade)
  if (filters.responsavel) query = query.eq('assigned_to', filters.responsavel)

  const [{ data }, statuses] = await Promise.all([
    query.order('deadline', { ascending: true, nullsFirst: false }).limit(300).returns<WorkOrder[]>(),
    getWorkOrderStatuses(),
  ])

  const columns = statuses.filter((status) => status.kanban)
  const rows = data ?? []

  return columns.map((status) => ({
    status,
    cards: rows.filter((row) => row.status_code === status.code),
  }))
}

export const getWorkOrder = cache(async (id: string): Promise<WorkOrder | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('work_orders')
    .select(
      `
      *,
      customer:customers!work_orders_customer_id_fkey ( * ),
      status:work_order_statuses!work_orders_status_code_fkey ( * ),
      assignee:profiles!work_orders_assigned_to_fkey ( id, full_name, avatar_url ),
      team:teams!work_orders_team_id_fkey ( id, name )
    `,
    )
    .eq('id', id)
    .maybeSingle<WorkOrder>()
  return data ?? null
})

export async function getWorkOrderItems(workOrderId: string): Promise<WorkOrderItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('work_order_items')
    .select('*, material:materials!work_order_items_material_id_fkey ( id, name )')
    .eq('work_order_id', workOrderId)
    .order('sort_order')
    .order('created_at')
    .returns<WorkOrderItem[]>()
  return data ?? []
}

export async function getWorkOrderHistory(workOrderId: string): Promise<WorkOrderHistory[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('work_order_history')
    .select('*, author:profiles!work_order_history_created_by_fkey ( id, full_name, avatar_url )')
    .eq('work_order_id', workOrderId)
    .order('created_at', { ascending: false })
    .limit(200)
    .returns<WorkOrderHistory[]>()
  return data ?? []
}

export async function getWorkOrderMeasurements(workOrderId: string): Promise<Measurement[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('work_order_measurements')
    .select(
      `*,
       responsible:profiles!work_order_measurements_responsible_id_fkey ( id, full_name ),
       items:work_order_measurement_items ( * )`,
    )
    .eq('work_order_id', workOrderId)
    .order('created_at', { ascending: false })
    .returns<Measurement[]>()
  return data ?? []
}

export async function getWorkOrderProduction(workOrderId: string): Promise<ProductionRecord[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('production_records')
    .select(
      `*,
       step:production_steps!production_records_step_code_fkey ( code, label, sort_order ),
       responsible:profiles!production_records_responsible_id_fkey ( id, full_name )`,
    )
    .eq('work_order_id', workOrderId)
    .order('created_at')
    .returns<ProductionRecord[]>()
  return data ?? []
}

export async function getWorkOrderInstallations(workOrderId: string): Promise<Installation[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('installations')
    .select(
      `*,
       team:teams!installations_team_id_fkey ( id, name ),
       responsible:profiles!installations_responsible_id_fkey ( id, full_name )`,
    )
    .eq('work_order_id', workOrderId)
    .order('created_at', { ascending: false })
    .returns<Installation[]>()
  return data ?? []
}

export async function getWorkOrderStock(workOrderId: string): Promise<StockItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('stock_items')
    .select('*, material:materials!stock_items_material_id_fkey ( id, name, color )')
    .eq('reserved_work_order_id', workOrderId)
    .order('created_at')
    .returns<StockItem[]>()
  return data ?? []
}

export async function getWorkOrderFiles(workOrderId: string): Promise<{
  photos: WorkOrderPhoto[]
  attachments: WorkOrderAttachment[]
}> {
  const supabase = await createClient()
  const [{ data: photos }, { data: attachments }] = await Promise.all([
    supabase
      .from('work_order_photos')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: false })
      .returns<WorkOrderPhoto[]>(),
    supabase
      .from('work_order_attachments')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: false })
      .returns<WorkOrderAttachment[]>(),
  ])
  return { photos: photos ?? [], attachments: attachments ?? [] }
}

/** Responsáveis disponíveis para atribuir a uma OS. */
export const getAssignableUsers = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('active', true)
    .order('full_name')
    .returns<{ id: string; full_name: string; role: string }[]>()
  return data ?? []
})

export const getTeamsList = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('teams')
    .select('id, name, kind')
    .eq('active', true)
    .order('name')
    .returns<{ id: string; name: string; kind: string }[]>()
  return data ?? []
})

export const getCustomersList = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('customers')
    .select('id, name, phone, whatsapp, city, address, address_number, district, zip_code, state')
    .eq('active', true)
    .order('name')
    .limit(500)
  return data ?? []
})

export const getMaterialsList = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('materials')
    .select('id, name, color, price_per_m2, thickness_mm, type_code')
    .eq('active', true)
    .order('name')
    .limit(500)
  return data ?? []
})
