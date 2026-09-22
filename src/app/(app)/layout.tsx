import Link from 'next/link'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { Topbar } from '@/components/layout/topbar'
import { createClient } from '@/lib/supabase/server'
import { getCompanySettings, requireUser } from '@/lib/auth/session'
import { signOut } from '@/app/(auth)/login/actions'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  // tudo em paralelo: a contagem de alertas nao espera a sessao (a RLS ja filtra quem nao pode ver)
  const [user, settings, { count: activeAlerts }] = await Promise.all([
    requireUser(),
    getCompanySettings(),
    supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .is('dismissed_at', null)
      .in('severity', ['CRITICO', 'ATENCAO']),
  ])
  const permissions = Array.from(user.permissions)
  const alertCount = user.permissions.has('alerts.read') ? (activeAlerts ?? 0) : 0

  const companyName = settings?.company_name ?? 'Marmoraria Independência'

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar fixa no desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar lg:flex print:hidden">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 border-b px-4 py-3.5 transition-colors hover:bg-sidebar-accent"
        >
          {settings?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo_url} alt="" className="size-8 shrink-0 rounded object-contain" />
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
              MI
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-tight">{companyName}</span>
            <span className="block text-[11px] text-muted-foreground">Gestão da marmoraria</span>
          </span>
        </Link>

        <div className="flex-1 overflow-y-auto">
          <SidebarNav permissions={permissions} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          companyName={companyName}
          logoUrl={settings?.logo_url ?? null}
          userName={user.profile.full_name || user.email || 'Usuário'}
          userRole={user.profile.role}
          avatarUrl={user.profile.avatar_url}
          permissions={permissions}
          alertCount={alertCount}
          signOutAction={signOut}
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
