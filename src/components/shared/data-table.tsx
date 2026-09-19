import * as React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/shared/states'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  className?: string
  headerClassName?: string
  /** Oculta a coluna em telas menores que lg. */
  secondary?: boolean
  align?: 'left' | 'right' | 'center'
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  rowHref?: (row: T) => string
  /** Layout alternativo para celular. Quando ausente, a tabela rola na horizontal. */
  mobileCard?: (row: T) => React.ReactNode
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

/**
 * Tabela de dados responsiva. No desktop usa <table>; no celular, se `mobileCard`
 * for informado, vira lista de cartoes (nao apenas uma tabela espremida).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  mobileCard,
  emptyTitle = 'Nenhum registro encontrado',
  emptyDescription,
  emptyAction,
  footer,
  className,
}: DataTableProps<T>) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
  }

  const alignClass = (align?: Column<T>['align']) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

  return (
    <div className={className}>
      {/* Desktop */}
      <div className={cn('rounded-lg border', mobileCard && 'hidden md:block')}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(alignClass(col.align), col.secondary && 'hidden lg:table-cell', col.headerClassName)}
                >
                  {col.header}
                </TableHead>
              ))}
              {rowHref && <TableHead className="w-8" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const href = rowHref?.(row)
              return (
                <TableRow key={rowKey(row)} className={href ? 'cursor-pointer' : undefined}>
                  {columns.map((col, index) => (
                    <TableCell
                      key={col.key}
                      className={cn(alignClass(col.align), col.secondary && 'hidden lg:table-cell', col.className)}
                    >
                      {href && index === 0 ? (
                        <Link href={href} className="block focus-visible:outline-none">
                          {col.render(row)}
                        </Link>
                      ) : (
                        col.render(row)
                      )}
                    </TableCell>
                  ))}
                  {href && (
                    <TableCell className="w-8 text-right">
                      <Link href={href} aria-label="Abrir" className="inline-flex text-muted-foreground hover:text-foreground">
                        <ChevronRight className="size-4" />
                      </Link>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {footer && <div className="border-t px-3 py-2.5 text-sm text-muted-foreground">{footer}</div>}
      </div>

      {/* Mobile */}
      {mobileCard && (
        <div className="flex flex-col gap-2.5 md:hidden">
          {rows.map((row) => {
            const href = rowHref?.(row)
            const card = (
              <div className="rounded-lg border bg-card p-3.5 shadow-sm transition-colors active:bg-secondary/40">
                {mobileCard(row)}
              </div>
            )
            return href ? (
              <Link key={rowKey(row)} href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
                {card}
              </Link>
            ) : (
              <div key={rowKey(row)}>{card}</div>
            )
          })}
          {footer && <p className="px-1 text-xs text-muted-foreground">{footer}</p>}
        </div>
      )}
    </div>
  )
}
