'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { visibleNavigation } from '@/lib/navigation'

export function SidebarNav({
  permissions,
  onNavigate,
  className,
}: {
  permissions: string[]
  onNavigate?: () => void
  className?: string
}) {
  const pathname = usePathname()
  const groups = visibleNavigation(new Set(permissions))

  return (
    <nav className={cn('flex flex-col gap-5 px-3 py-4', className)} aria-label="Menu principal">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'bg-primary/12 text-primary'
                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
                    )}
                  >
                    <Icon className={cn('size-4 shrink-0', active && 'text-primary')} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
