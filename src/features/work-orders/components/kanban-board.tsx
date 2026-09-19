'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CalendarClock, GripVertical, User } from 'lucide-react'
import { toast } from 'sonner'
import { cn, daysUntil, formatCurrency, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { PriorityBadge } from '@/components/shared/status-badge'
import { moveWorkOrder } from '@/features/work-orders/actions'
import type { WorkOrder, WorkOrderStatus } from '@/types/database'

interface KanbanColumn {
  status: WorkOrderStatus
  cards: WorkOrder[]
}

const COLUMN_ACCENT: Record<string, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  info: 'bg-info',
  accent: 'bg-accent',
  muted: 'bg-muted-foreground/40',
}

export function KanbanBoard({ columns, canMove }: { columns: KanbanColumn[]; canMove: boolean }) {
  const [board, setBoard] = React.useState(columns)
  const [syncedColumns, setSyncedColumns] = React.useState(columns)
  const [activeCard, setActiveCard] = React.useState<WorkOrder | null>(null)
  const [pending, startTransition] = React.useTransition()

  // Dados novos do servidor substituem o estado otimista (ajuste durante o render,
  // que e o padrao recomendado do React para estado derivado de props).
  if (syncedColumns !== columns) {
    setSyncedColumns(columns)
    setBoard(columns)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    const card = board.flatMap((column) => column.cards).find((item) => item.id === event.active.id)
    setActiveCard(card ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null)
    const { active, over } = event
    if (!over) return

    const workOrderId = String(active.id)
    const targetStatus = String(over.id)
    const source = board.find((column) => column.cards.some((card) => card.id === workOrderId))
    if (!source || source.status.code === targetStatus) return

    const card = source.cards.find((item) => item.id === workOrderId)!
    const previous = board

    // Otimista: move o card na hora e reverte se o servidor recusar.
    setBoard((current) =>
      current.map((column) => {
        if (column.status.code === source.status.code) {
          return { ...column, cards: column.cards.filter((item) => item.id !== workOrderId) }
        }
        if (column.status.code === targetStatus) {
          return { ...column, cards: [{ ...card, status_code: targetStatus }, ...column.cards] }
        }
        return column
      }),
    )

    startTransition(async () => {
      const result = await moveWorkOrder(workOrderId, targetStatus)
      if (result.error) {
        setBoard(previous)
        toast.error(result.error)
      } else {
        const label = board.find((column) => column.status.code === targetStatus)?.status.label
        toast.success(`${card.number} movida para ${label ?? targetStatus}`)
      }
    })
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={cn('scroll-snap-x flex gap-3 overflow-x-auto pb-4', pending && 'opacity-95')}>
        {board.map((column) => (
          <Column key={column.status.code} column={column} canMove={canMove} />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard ? (
          <div className="w-72 rotate-2 opacity-95">
            <Card card={activeCard} canMove={false} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function Column({ column, canMove }: { column: KanbanColumn; canMove: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status.code, disabled: !canMove })
  const total = column.cards.reduce((sum, card) => sum + Number(card.total_value ?? 0), 0)

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'scroll-snap-start flex w-[17rem] shrink-0 flex-col rounded-lg border bg-sidebar/60 transition-colors sm:w-72',
        isOver && 'border-primary bg-primary/5',
      )}
      aria-label={column.status.label}
    >
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <span className={cn('size-2 rounded-full', COLUMN_ACCENT[column.status.color] ?? COLUMN_ACCENT.muted)} />
        <h2 className="truncate text-sm font-medium">{column.status.label}</h2>
        <Badge variant="secondary" size="sm" className="ml-auto">
          {column.cards.length}
        </Badge>
      </header>

      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {column.cards.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nenhuma OS aqui</p>
        ) : (
          column.cards.map((card) => <Card key={card.id} card={card} canMove={canMove} />)
        )}
      </div>

      {total > 0 && (
        <footer className="border-t px-3 py-2 text-xs text-muted-foreground tabular">
          {formatCurrency(total)}
        </footer>
      )}
    </section>
  )
}

function Card({ card, canMove, dragging }: { card: WorkOrder; canMove: boolean; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    disabled: !canMove,
  })

  const days = daysUntil(card.deadline)
  const late = days !== null && days < 0 && !card.finished_at
  const near = days !== null && days >= 0 && days <= 3 && !card.finished_at

  return (
    <article
      ref={setNodeRef}
      className={cn(
        'group rounded-md border bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md',
        isDragging && 'opacity-40',
        dragging && 'shadow-lg',
      )}
    >
      <div className="flex items-start gap-1.5">
        {canMove && (
          <button
            type="button"
            className="mt-0.5 cursor-grab touch-none text-muted-foreground/50 transition-colors hover:text-muted-foreground active:cursor-grabbing"
            aria-label={`Mover ${card.number}`}
            {...listeners}
            {...attributes}
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <Link href={`/os/${card.id}`} className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{card.number}</span>
            <PriorityBadge priority={card.priority} compact />
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{card.customer?.name ?? '—'}</p>
          {card.title && <p className="mt-0.5 truncate text-xs text-muted-foreground/80">{card.title}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {card.deadline && (
              <span
                className={cn(
                  'inline-flex items-center gap-1',
                  late && 'font-medium text-destructive',
                  near && 'font-medium text-warning',
                )}
              >
                <CalendarClock className="size-3" />
                {formatDate(card.deadline)}
              </span>
            )}
            {card.assignee?.full_name && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <User className="size-3 shrink-0" />
                <span className="truncate">{card.assignee.full_name.split(' ')[0]}</span>
              </span>
            )}
            <span className="tabular ml-auto font-medium text-foreground">
              {formatCurrency(card.total_value)}
            </span>
          </div>
        </Link>
      </div>
    </article>
  )
}
