/**
 * Tipos das tabelas do banco (espelho de supabase/migrations).
 * Mantido a mao de proposito: o schema e a fonte da verdade e as consultas
 * usam .returns<T>() para tipar o resultado no ponto de uso.
 */

export type RoleCode =
  | 'ADMINISTRADOR'
  | 'GESTOR'
  | 'PRODUCAO'
  | 'MEDICAO'
  | 'INSTALACAO'
  | 'FINANCEIRO'
  | 'ESTOQUE'
  | 'OPERACIONAL'

export type Priority = 'BAIXA' | 'NORMAL' | 'ALTA' | 'URGENTE'

export type QuoteStatus = 'RASCUNHO' | 'ENVIADO' | 'APROVADO' | 'RECUSADO' | 'EXPIRADO' | 'CANCELADO'

export type StockStatus =
  | 'DISPONIVEL'
  | 'RESERVADA'
  | 'EM_PRODUCAO'
  | 'CONSUMIDA'
  | 'DANIFICADA'
  | 'DESCARTADA'

export type MovementType =
  | 'ENTRADA'
  | 'RESERVA'
  | 'LIBERACAO'
  | 'CONSUMO'
  | 'SOBRA'
  | 'PERDA'
  | 'AJUSTE'
  | 'TRANSFERENCIA'
  | 'DESCARTE'

export type LossReason =
  | 'QUEBRA'
  | 'ERRO_CORTE'
  | 'DEFEITO'
  | 'MEDICAO_INCORRETA'
  | 'TRANSPORTE'
  | 'RETRABALHO'
  | 'OUTRO'

export type MeasurementStatus = 'PENDENTE' | 'AGENDADA' | 'REALIZADA' | 'APROVADA' | 'REPROVADA'

export type ProductionStatus = 'PENDENTE' | 'EM_ANDAMENTO' | 'PAUSADO' | 'CONCLUIDO' | 'RETRABALHO'

export type InstallationStatus =
  | 'AGENDADA'
  | 'EM_ANDAMENTO'
  | 'CONCLUIDA'
  | 'REAGENDADA'
  | 'CANCELADA'

export type TransactionKind = 'RECEITA' | 'DESPESA'
export type TransactionStatus = 'PENDENTE' | 'PAGO' | 'ATRASADO' | 'CANCELADO'
export type ActionPlanStatus = 'ABERTO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO'
export type AlertSeverity = 'INFO' | 'ATENCAO' | 'CRITICO'
export type PricingMode = 'M2' | 'ML' | 'UN'

export interface Profile {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  job_title: string | null
  avatar_url: string | null
  role: RoleCode
  active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CompanySettings {
  id: boolean
  company_name: string
  legal_name: string | null
  document: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  secondary_color: string
  accent_color: string
  default_theme: 'light' | 'dark' | 'system'
  quote_validity_days: number
  default_waste_pct: number
  low_stock_alert: boolean
}

export interface Customer {
  id: string
  name: string
  document: string | null
  person_type: 'PF' | 'PJ'
  phone: string | null
  whatsapp: string | null
  email: string | null
  zip_code: string | null
  address: string | null
  address_number: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  notes: string | null
  active: boolean
  is_demo: boolean
  created_at: string
}

export interface MaterialType {
  code: string
  label: string
  category: 'PEDRA' | 'INSUMO' | 'FERRAMENTA' | 'EPI'
  sort_order: number
}

export interface Material {
  id: string
  name: string
  type_code: string
  color: string | null
  origin: 'NACIONAL' | 'IMPORTADO' | null
  finish_default: string | null
  thickness_mm: number | null
  price_per_m2: number | null
  unit: string
  min_quantity: number
  supplier: string | null
  notes: string | null
  active: boolean
  is_demo: boolean
  material_type?: MaterialType | null
}

export interface StockLocation {
  id: string
  name: string
  kind: string
  notes: string | null
  active: boolean
}

export interface StockItem {
  id: string
  kind: 'CHAPA' | 'INSUMO'
  code: string | null
  material_id: string
  location_id: string | null
  supplier: string | null
  batch: string | null
  thickness_mm: number | null
  length_mm: number | null
  width_mm: number | null
  area_m2: number | null
  is_remnant: boolean
  parent_item_id: string | null
  quantity: number
  unit: string
  unit_cost: number | null
  status: StockStatus
  reserved_work_order_id: string | null
  notes: string | null
  is_demo: boolean
  created_at: string
  material?: Material | null
  location?: StockLocation | null
  work_order?: Pick<WorkOrder, 'id' | 'number'> | null
}

export interface StockMovement {
  id: string
  stock_item_id: string | null
  material_id: string | null
  work_order_id: string | null
  movement_type: MovementType
  quantity: number
  area_m2: number | null
  unit_cost: number | null
  total_cost: number | null
  loss_reason: LossReason | null
  notes: string | null
  created_at: string
  created_by: string | null
  material?: Pick<Material, 'id' | 'name'> | null
  stock_item?: Pick<StockItem, 'id' | 'code'> | null
  work_order?: Pick<WorkOrder, 'id' | 'number'> | null
  author?: Pick<Profile, 'id' | 'full_name'> | null
}

export interface WorkOrderStatus {
  code: string
  label: string
  description: string | null
  color: string
  sort_order: number
  is_default: boolean
  is_terminal: boolean
  kanban: boolean
}

export interface Quote {
  id: string
  number: string
  customer_id: string
  status: QuoteStatus
  issue_date: string
  valid_until: string | null
  subtotal: number
  discount: number
  surcharge: number
  total: number
  notes: string | null
  internal_notes: string | null
  approved_at: string | null
  rejected_reason: string | null
  is_demo: boolean
  created_at: string
  customer?: Customer | null
  items?: QuoteItem[]
}

export interface QuoteItem {
  id: string
  quote_id: string
  sort_order: number
  description: string
  environment: string | null
  material_id: string | null
  color: string | null
  thickness_mm: number | null
  length_mm: number
  width_mm: number
  quantity: number
  area_m2: number
  pricing_mode: PricingMode
  unit_price: number
  total_price: number
  finish: string | null
  edge: string | null
  notes: string | null
  material?: Pick<Material, 'id' | 'name'> | null
}

export interface WorkOrder {
  id: string
  number: string
  customer_id: string
  quote_id: string | null
  status_code: string
  priority: Priority
  assigned_to: string | null
  team_id: string | null
  title: string | null
  deadline: string | null
  scheduled_measurement_at: string | null
  scheduled_install_at: string | null
  zip_code: string | null
  address: string | null
  address_number: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  total_value: number
  received_value: number
  pending_value: number
  discount: number
  notes: string | null
  internal_notes: string | null
  started_at: string | null
  finished_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  is_demo: boolean
  created_at: string
  updated_at: string
  customer?: Customer | null
  status?: WorkOrderStatus | null
  assignee?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
  team?: Pick<Team, 'id' | 'name'> | null
  items?: WorkOrderItem[]
}

export interface WorkOrderItem {
  id: string
  work_order_id: string
  sort_order: number
  description: string
  environment: string | null
  material_id: string | null
  color: string | null
  thickness_mm: number | null
  length_mm: number
  width_mm: number
  quantity: number
  area_m2: number
  pricing_mode: PricingMode
  unit_price: number
  total_price: number
  finish: string | null
  edge: string | null
  skirt_mm: number | null
  backsplash_mm: number | null
  cutouts: number
  has_sink: boolean
  sink_type: string | null
  sink_quantity: number
  has_cooktop: boolean
  cooktop_type: string | null
  faucet_holes: number
  outlet_holes: number
  extra_holes: number
  notes: string | null
  production_status: 'PENDENTE' | 'EM_PRODUCAO' | 'PRONTO' | 'INSTALADO' | 'RETRABALHO'
  material?: Pick<Material, 'id' | 'name'> | null
}

export interface WorkOrderHistory {
  id: string
  work_order_id: string
  event_type: string
  title: string
  description: string | null
  from_value: string | null
  to_value: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  created_by: string | null
  author?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
}

export interface WorkOrderPhoto {
  id: string
  work_order_id: string
  stage: string
  storage_path: string
  caption: string | null
  created_at: string
}

export interface WorkOrderAttachment {
  id: string
  work_order_id: string
  file_name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  kind: string
  created_at: string
}

export interface Measurement {
  id: string
  work_order_id: string
  responsible_id: string | null
  team_id: string | null
  scheduled_at: string | null
  measured_at: string | null
  status: MeasurementStatus
  zip_code: string | null
  address: string | null
  address_number: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  obstacles: string | null
  hydraulics_notes: string | null
  electrical_notes: string | null
  wall_notes: string | null
  notes: string | null
  sketch_path: string | null
  check_measures: boolean
  check_square: boolean
  check_level: boolean
  check_wall: boolean
  check_sink: boolean
  check_cooktop: boolean
  check_faucet: boolean
  check_outlets: boolean
  check_hydraulics: boolean
  check_photos: boolean
  customer_present: boolean
  approved: boolean
  approved_at: string | null
  rejected_reason: string | null
  revision: number
  created_at: string
  responsible?: Pick<Profile, 'id' | 'full_name'> | null
  work_order?: Pick<WorkOrder, 'id' | 'number' | 'customer_id'> & { customer?: Customer | null }
  items?: MeasurementItem[]
}

export interface MeasurementItem {
  id: string
  measurement_id: string
  sort_order: number
  environment: string | null
  description: string
  length_mm: number
  width_mm: number
  thickness_mm: number | null
  quantity: number
  area_m2: number
  notes: string | null
}

export interface ProductionStep {
  code: string
  label: string
  sort_order: number
  active: boolean
}

export interface ProductionRecord {
  id: string
  work_order_id: string
  work_order_item_id: string | null
  step_code: string
  responsible_id: string | null
  team_id: string | null
  status: ProductionStatus
  started_at: string | null
  finished_at: string | null
  duration_minutes: number | null
  is_rework: boolean
  rework_reason: string | null
  notes: string | null
  created_at: string
  step?: ProductionStep | null
  responsible?: Pick<Profile, 'id' | 'full_name'> | null
  work_order?: Pick<WorkOrder, 'id' | 'number'> & { customer?: Pick<Customer, 'name'> | null }
}

export interface Team {
  id: string
  name: string
  kind: 'PRODUCAO' | 'MEDICAO' | 'INSTALACAO' | 'MISTA'
  leader_id: string | null
  phone: string | null
  notes: string | null
  active: boolean
  leader?: Pick<Profile, 'id' | 'full_name'> | null
  members?: { profile: Pick<Profile, 'id' | 'full_name' | 'role'> }[]
}

export interface Installation {
  id: string
  work_order_id: string
  team_id: string | null
  responsible_id: string | null
  scheduled_at: string | null
  started_at: string | null
  finished_at: string | null
  status: InstallationStatus
  zip_code: string | null
  address: string | null
  address_number: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  notes: string | null
  check_material: boolean
  check_pieces: boolean
  check_measures: boolean
  check_site_ready: boolean
  check_installed: boolean
  check_finish: boolean
  check_photos: boolean
  customer_present: boolean
  approved: boolean
  approved_at: string | null
  reschedule_reason: string | null
  created_at: string
  team?: Pick<Team, 'id' | 'name'> | null
  responsible?: Pick<Profile, 'id' | 'full_name'> | null
  work_order?: Pick<WorkOrder, 'id' | 'number'> & { customer?: Pick<Customer, 'name'> | null }
}

export interface FinancialAccount {
  id: string
  name: string
  kind: string
  initial_balance: number
  active: boolean
}

export interface FinancialCategory {
  id: string
  name: string
  kind: TransactionKind
  color: string | null
  active: boolean
}

export interface FinancialTransaction {
  id: string
  description: string
  kind: TransactionKind
  category_id: string | null
  account_id: string | null
  work_order_id: string | null
  customer_id: string | null
  amount: number
  due_date: string
  paid_at: string | null
  status: TransactionStatus
  payment_method: string | null
  installment: number
  installments: number
  notes: string | null
  created_at: string
  category?: FinancialCategory | null
  account?: Pick<FinancialAccount, 'id' | 'name'> | null
  work_order?: Pick<WorkOrder, 'id' | 'number'> | null
  customer?: Pick<Customer, 'id' | 'name'> | null
}

export interface ActionPlan {
  id: string
  title: string
  problem: string | null
  action: string | null
  responsible_id: string | null
  work_order_id: string | null
  priority: Priority
  due_date: string | null
  status: ActionPlanStatus
  completed_at: string | null
  notes: string | null
  created_at: string
  responsible?: Pick<Profile, 'id' | 'full_name'> | null
  work_order?: Pick<WorkOrder, 'id' | 'number'> | null
}

export interface Alert {
  id: string
  alert_key: string
  alert_type: string
  severity: AlertSeverity
  title: string
  description: string | null
  entity_type: string | null
  entity_id: string | null
  href: string | null
  auto: boolean
  dismissed_at: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  table_name: string
  record_id: string | null
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  actor_id: string | null
  changes: Record<string, unknown> | null
  created_at: string
  actor?: Pick<Profile, 'id' | 'full_name'> | null
}
