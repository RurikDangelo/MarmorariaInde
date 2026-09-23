import * as React from 'react'
import {
  Banknote,
  CheckCircle2,
  FileText,
  Hammer,
  Layers,
  MapPin,
  Package,
  Paperclip,
  PlusCircle,
  Ruler,
  Truck,
  User,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { cn, formatDateTime, initials } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { WorkOrderHistory } from '@/types/database'

const EVENT_CONFIG: Record<string, { icon: React.ElementType; tone: string }> = {
  CRIACAO: { icon: PlusCircle, tone: 'bg-primary/12 text-primary' },
  STATUS: { icon: CheckCircle2, tone: 'bg-info/12 text-info' },
  PRIORIDADE: { icon: FileText, tone: 'bg-warning/16 text-warning' },
  RESPONSAVEL: { icon: User, tone: 'bg-accent/12 text-accent' },
  PRAZO: { icon: FileText, tone: 'bg-warning/16 text-warning' },
  VALOR: { icon: Banknote, tone: 'bg-success/12 text-success' },
  MEDICAO: { icon: Ruler, tone: 'bg-accent/12 text-accent' },
  PRODUCAO: { icon: Hammer, tone: 'bg-primary/12 text-primary' },
  MATERIAL: { icon: Layers, tone: 'bg-warning/16 text-warning' },
  INSTALACAO: { icon: MapPin, tone: 'bg-info/12 text-info' },
  EXPEDICAO: { icon: Truck, tone: 'bg-info/12 text-info' },
  PAGAMENTO: { icon: Banknote, tone: 'bg-success/12 text-success' },
  ANEXO: { icon: Paperclip, tone: 'bg-muted text-muted-foreground' },
  OBSERVACAO: { icon: FileText, tone: 'bg-muted text-muted-foreground' },
  CANCELAMENTO: { icon: XCircle, tone: 'bg-destructive/12 text-destructive' },
  REATIVACAO: { icon: RotateCcw, tone: 'bg-success/12 text-success' },
  ITEM: { icon: Package, tone: 'bg-primary/12 text-primary' },
}

export function Timeline({ events, className }: { events: WorkOrderHistory[]; className?: string }) {
  if (!events.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
  }

  return (
    <ol className={cn('relative flex flex-col', className)}>
      {events.map((event, index) => {
        const config = EVENT_CONFIG[event.event_type] ?? {
          icon: FileText,
          tone: 'bg-muted text-muted-foreground',
        }
        const Icon = config.icon
        const isLast = index === events.length - 1

        return (
          <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && <span className="absolute left-4 top-9 h-[calc(100%-1.75rem)] w-px bg-border" aria-hidden />}
            <div className={cn('z-10 flex size-8 shrink-0 items-center justify-center rounded-full', config.tone)}>
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className="text-sm font-medium">{event.title}</p>
                <time className="text-xs text-muted-foreground" dateTime={event.created_at}>
                  {formatDateTime(event.created_at)}
                </time>
              </div>

              {(event.from_value || event.to_value) && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {event.from_value && <span className="line-through opacity-70">{event.from_value}</span>}
                  {event.from_value && event.to_value && <span className="mx-1.5">→</span>}
                  {event.to_value && <span className="font-medium text-foreground">{event.to_value}</span>}
                </p>
              )}

              {event.description && <p className="mt-0.5 text-sm text-muted-foreground">{event.description}</p>}

              {event.author?.full_name && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Avatar className="size-5">
                    <AvatarFallback className="text-[10px]">{initials(event.author.full_name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">{event.author.full_name}</span>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
