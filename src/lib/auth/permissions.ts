import type { RoleCode } from '@/types/database'

/** Espelha public.permissions. Mantenha em sincronia com 0009_seed_catalog.sql. */
export const PERMISSIONS = [
  'customers.read',
  'customers.write',
  'quotes.read',
  'quotes.write',
  'quotes.approve',
  'work_orders.read',
  'work_orders.write',
  'work_orders.status',
  'work_orders.delete',
  'measurements.read',
  'measurements.write',
  'production.read',
  'production.write',
  'installations.read',
  'installations.write',
  'stock.read',
  'stock.write',
  'financial.read',
  'financial.write',
  'team.read',
  'team.write',
  'users.read',
  'users.write',
  'settings.read',
  'settings.write',
  'alerts.read',
  'alerts.write',
  'action_plans.read',
  'action_plans.write',
  'reports.read',
  'dashboard.read',
  'audit.read',
] as const

export type Permission = (typeof PERMISSIONS)[number]

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMINISTRADOR: 'Administrador',
  GESTOR: 'Gestor',
  PRODUCAO: 'Produção',
  MEDICAO: 'Medição',
  INSTALACAO: 'Instalação',
  FINANCEIRO: 'Financeiro',
  ESTOQUE: 'Estoque',
  OPERACIONAL: 'Operacional',
}

export const ROLE_DESCRIPTIONS: Record<RoleCode, string> = {
  ADMINISTRADOR: 'Acesso total, inclusive usuários e configurações',
  GESTOR: 'Gestão operacional completa',
  PRODUCAO: 'Apontamento de produção e acompanhamento das OS',
  MEDICAO: 'Registro e conferência de medições',
  INSTALACAO: 'Execução e checklist de instalação',
  FINANCEIRO: 'Contas a pagar, a receber e fluxo de caixa',
  ESTOQUE: 'Chapas, insumos, reservas, consumo e perdas',
  OPERACIONAL: 'Consulta das informações operacionais',
}
