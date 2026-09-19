import { ArrowDown, ArrowUp, Equal, Flame } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Priority } from '@/types/database'

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'info' | 'accent' | 'muted'

/** As cores vem de work_order_statuses.color (dado, nao codigo). */
const COLOR_MAP: Record<string, BadgeVariant> = {
  primary: 'default',
  success: 'success',
  warning: 'warning',
  destructive: 'destructive',
  info: 'info',
  accent: 'accent',
  muted: 'muted',
}

export function StatusBadge({
  label,
  color = 'muted',
  className,
}: {
  label: string
  color?: string | null
  className?: string
}) {
  return (
    <Badge variant={COLOR_MAP[color ?? 'muted'] ?? 'muted'} className={className}>
      {label}
    </Badge>
  )
}

const PRIORITY_CONFIG: Record<Priority, { label: string; variant: BadgeVariant; icon: React.ElementType }> = {
  BAIXA: { label: 'Baixa', variant: 'muted', icon: ArrowDown },
  NORMAL: { label: 'Normal', variant: 'secondary', icon: Equal },
  ALTA: { label: 'Alta', variant: 'warning', icon: ArrowUp },
  URGENTE: { label: 'Urgente', variant: 'destructive', icon: Flame },
}

export function PriorityBadge({
  priority,
  compact = false,
  className,
}: {
  priority: Priority
  compact?: boolean
  className?: string
}) {
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.NORMAL
  const Icon = config.icon
  return (
    <Badge variant={config.variant} className={cn(compact && 'px-1.5', className)}>
      <Icon className="size-3" />
      {!compact && config.label}
    </Badge>
  )
}

const GENERIC_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  // Orcamento
  RASCUNHO: { label: 'Rascunho', variant: 'muted' },
  ENVIADO: { label: 'Enviado', variant: 'info' },
  APROVADO: { label: 'Aprovado', variant: 'success' },
  RECUSADO: { label: 'Recusado', variant: 'destructive' },
  EXPIRADO: { label: 'Expirado', variant: 'warning' },
  CANCELADO: { label: 'Cancelado', variant: 'muted' },
  // Estoque
  DISPONIVEL: { label: 'Disponível', variant: 'success' },
  RESERVADA: { label: 'Reservada', variant: 'warning' },
  EM_PRODUCAO: { label: 'Em produção', variant: 'info' },
  CONSUMIDA: { label: 'Consumida', variant: 'muted' },
  DANIFICADA: { label: 'Danificada', variant: 'destructive' },
  DESCARTADA: { label: 'Descartada', variant: 'destructive' },
  // Medicao / producao / instalacao
  PENDENTE: { label: 'Pendente', variant: 'muted' },
  AGENDADA: { label: 'Agendada', variant: 'info' },
  REALIZADA: { label: 'Realizada', variant: 'accent' },
  REPROVADA: { label: 'Reprovada', variant: 'destructive' },
  EM_ANDAMENTO: { label: 'Em andamento', variant: 'info' },
  PAUSADO: { label: 'Pausado', variant: 'warning' },
  CONCLUIDO: { label: 'Concluído', variant: 'success' },
  CONCLUIDA: { label: 'Concluída', variant: 'success' },
  RETRABALHO: { label: 'Retrabalho', variant: 'destructive' },
  REAGENDADA: { label: 'Reagendada', variant: 'warning' },
  CANCELADA: { label: 'Cancelada', variant: 'muted' },
  // Financeiro
  PAGO: { label: 'Pago', variant: 'success' },
  ATRASADO: { label: 'Atrasado', variant: 'destructive' },
  // Planos de acao
  ABERTO: { label: 'Aberto', variant: 'info' },
  // Itens da OS
  PRONTO: { label: 'Pronto', variant: 'success' },
  INSTALADO: { label: 'Instalado', variant: 'success' },
}

/** Badge para status de modulos com enum fixo (orcamento, estoque, financeiro...). */
export function GenericStatusBadge({ status, className }: { status: string; className?: string }) {
  const config = GENERIC_STATUS[status] ?? { label: status, variant: 'muted' as BadgeVariant }
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}

export function statusLabel(status: string): string {
  return GENERIC_STATUS[status]?.label ?? status
}
