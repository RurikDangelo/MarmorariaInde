import {
  AlertTriangle,
  Banknote,
  ClipboardList,
  FileText,
  Hammer,
  LayoutDashboard,
  Layers,
  ListChecks,
  MapPin,
  Ruler,
  Settings,
  ShieldCheck,
  Tags,
  Users,
  UsersRound,
} from 'lucide-react'
import type { Permission } from '@/lib/auth/permissions'

export interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  permission: Permission
  /** Atalho exibido no menu de comando. */
  keywords?: string[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAVIGATION: NavGroup[] = [
  {
    label: 'Operação',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.read', keywords: ['painel', 'inicio'] },
      { href: '/os', label: 'Ordens de serviço', icon: ClipboardList, permission: 'work_orders.read', keywords: ['os', 'kanban', 'producao'] },
      { href: '/orcamentos', label: 'Orçamentos', icon: FileText, permission: 'quotes.read', keywords: ['orcamento', 'proposta'] },
      { href: '/medicoes', label: 'Medições', icon: Ruler, permission: 'measurements.read', keywords: ['medir', 'campo'] },
      { href: '/producao', label: 'Produção', icon: Hammer, permission: 'production.read', keywords: ['corte', 'acabamento', 'oficina'] },
      { href: '/instalacoes', label: 'Instalações', icon: MapPin, permission: 'installations.read', keywords: ['obra', 'montagem'] },
    ],
  },
  {
    label: 'Recursos',
    items: [
      { href: '/estoque', label: 'Estoque', icon: Layers, permission: 'stock.read', keywords: ['chapa', 'material', 'retalho'] },
      { href: '/cadastros', label: 'Cadastros', icon: Tags, permission: 'stock.read', keywords: ['produto', 'servico', 'acabamento', 'revenda', 'insumo', 'lista'] },
      { href: '/clientes', label: 'Clientes', icon: Users, permission: 'customers.read', keywords: ['cliente', 'contato'] },
      { href: '/equipe', label: 'Equipe', icon: UsersRound, permission: 'team.read', keywords: ['time', 'colaborador'] },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/financeiro', label: 'Financeiro', icon: Banknote, permission: 'financial.read', keywords: ['caixa', 'receber', 'pagar'] },
      { href: '/alertas', label: 'Alertas', icon: AlertTriangle, permission: 'alerts.read', keywords: ['aviso', 'pendencia'] },
      { href: '/planos-de-acao', label: 'Planos de ação', icon: ListChecks, permission: 'action_plans.read', keywords: ['plano', 'acao', 'melhoria'] },
      { href: '/relatorios', label: 'Relatórios', icon: FileText, permission: 'reports.read', keywords: ['relatorio', 'exportar'] },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/configuracoes', label: 'Configurações', icon: Settings, permission: 'settings.read', keywords: ['tema', 'empresa', 'cores'] },
      { href: '/auditoria', label: 'Auditoria', icon: ShieldCheck, permission: 'audit.read', keywords: ['log', 'seguranca'] },
    ],
  },
]

/** Filtra a navegação pelas permissões efetivas do usuário. */
export function visibleNavigation(permissions: Set<string>): NavGroup[] {
  return NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => permissions.has(item.permission)),
  })).filter((group) => group.items.length > 0)
}
