'use client'

import * as React from 'react'
import Link from 'next/link'
import { LogOut, Menu, Moon, Settings, Sun, User } from 'lucide-react'
import { useTheme } from 'next-themes'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { CommandMenu } from '@/components/layout/command-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { initials } from '@/lib/utils'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import type { RoleCode } from '@/types/database'

interface TopbarProps {
  companyName: string
  logoUrl: string | null
  userName: string
  userRole: RoleCode
  avatarUrl: string | null
  permissions: string[]
  alertCount: number
  signOutAction: () => Promise<void>
}

export function Topbar({
  companyName,
  logoUrl,
  userName,
  userRole,
  avatarUrl,
  permissions,
  alertCount,
  signOutAction,
}: TopbarProps) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const { theme, setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-4 print:hidden">
      {/* Menu mobile */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="flex items-center gap-2.5 border-b px-4 py-3.5 text-sm">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="size-8 rounded object-contain" />
            ) : (
              <span className="flex size-8 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
                MI
              </span>
            )}
            <span className="truncate font-semibold">{companyName}</span>
          </SheetTitle>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarNav permissions={permissions} onNavigate={() => setMenuOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1 sm:flex-none">
        <CommandMenu permissions={permissions} />
      </div>

      <div className="ml-auto flex items-center gap-1">
        {permissions.includes('alerts.read') && alertCount > 0 && (
          <Button variant="ghost" size="sm" asChild className="gap-1.5 px-2">
            <Link href="/alertas" aria-label={`${alertCount} alertas ativos`}>
              <Badge variant="destructive" size="sm">
                {alertCount}
              </Badge>
              <span className="hidden text-xs sm:inline">alertas</span>
            </Link>
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          aria-label="Alternar tema"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menu do usuário">
              <Avatar className="size-7">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                <AvatarFallback>{initials(userName)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-foreground">
              <span className="block truncate text-sm font-medium">{userName}</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {ROLE_LABELS[userRole] ?? userRole}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/perfil">
                <User />
                Meu perfil
              </Link>
            </DropdownMenuItem>
            {permissions.includes('settings.read') && (
              <DropdownMenuItem asChild>
                <Link href="/configuracoes">
                  <Settings />
                  Configurações
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild variant="destructive">
              <form action={signOutAction} className="w-full">
                <button type="submit" className="flex w-full items-center gap-2">
                  <LogOut />
                  Sair
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
