'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { visibleNavigation } from '@/lib/navigation'

/**
 * Menu lateral.
 *
 * O item ativo recebe três marcas ao mesmo tempo — trilho na borda esquerda,
 * fundo tingido e ícone na cor da marca. Antes era só texto verde, que se
 * perdia entre os outros itens quando a lista é longa como esta.
 */
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
    <nav className={cn('flex flex-col gap-6 px-3 py-5', className)} aria-label="Menu principal">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="text-eyebrow px-3 pb-2 text-muted-foreground/60">{group.label}</p>

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
                      'group relative flex items-center gap-3 rounded-lg py-2 pl-3 pr-2.5 text-sm transition-all duration-[var(--motion-hover)] ease-[var(--ease-out)]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'bg-primary/10 font-semibold text-foreground'
                        : 'font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
                    )}
                  >
                    {/* Trilho: some quando inativo, cresce no hover, cheio no ativo. */}
                    <span
                      aria-hidden
                      className={cn(
                        'absolute left-0 top-1/2 w-0.5 -translate-y-1/2 rounded-r-full bg-primary transition-all duration-[var(--motion-hover)] ease-[var(--ease-out)]',
                        active ? 'h-6' : 'h-0 group-hover:h-3',
                      )}
                    />
                    <Icon
                      className={cn(
                        'size-4.5 shrink-0 transition-colors',
                        active ? 'text-primary' : 'text-muted-foreground/80 group-hover:text-foreground',
                      )}
                    />
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
