import * as React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export function PageBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (!items.length) return null
  return (
    <nav aria-label="Trilha de navegação" className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground">
      {items.map((item, i) => (
        <React.Fragment key={`${item.label}-${i}`}>
          {i > 0 && <ChevronRight className="size-3 shrink-0 opacity-60" />}
          {item.href ? (
            <Link href={item.href} className="truncate transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="truncate text-foreground">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumb?: BreadcrumbItem[]
  actions?: React.ReactNode
  badge?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, breadcrumb, actions, badge, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {breadcrumb && <PageBreadcrumb items={breadcrumb} />}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function PageContainer({
  children,
  className,
  size = 'default',
}: {
  children: React.ReactNode
  className?: string
  size?: 'default' | 'wide' | 'full'
}) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6',
        size === 'default' && 'max-w-7xl',
        size === 'wide' && 'max-w-[110rem]',
        size === 'full' && 'max-w-none',
        className,
      )}
    >
      {children}
    </div>
  )
}
