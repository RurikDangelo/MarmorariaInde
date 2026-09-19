import type { Metadata } from 'next'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/auth/permissions'
import { SettingsForm } from '@/features/management/components/settings-form'
import type { CompanySettings, RoleCode, WorkOrderStatus } from '@/types/database'

export const metadata: Metadata = { title: 'Configurações' }

export default async function SettingsPage() {
  const user = await requirePermission('settings.read')
  const supabase = await createClient()

  const [{ data: settings }, { data: statuses }, { data: rolePermissions }, { data: permissions }] =
    await Promise.all([
      supabase.from('company_settings').select('*').eq('id', true).maybeSingle<CompanySettings>(),
      supabase.from('work_order_statuses').select('*').order('sort_order').returns<WorkOrderStatus[]>(),
      supabase.from('role_permissions').select('role, permission'),
      supabase.from('permissions').select('code, label, resource').order('code'),
    ])

  const canWrite = user.permissions.has('settings.write')
  const grants = (rolePermissions ?? []) as { role: string; permission: string }[]

  return (
    <PageContainer>
      <PageHeader
        title="Configurações"
        description="Identidade da empresa, etapas do fluxo e matriz de permissões."
      />

      <Tabs defaultValue="empresa">
        <TabsList>
          <TabsTrigger value="empresa">Empresa e tema</TabsTrigger>
          <TabsTrigger value="etapas">Etapas da OS</TabsTrigger>
          <TabsTrigger value="permissoes">Permissões</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa">
          {!settings ? (
            <p className="text-sm text-muted-foreground">Configurações não encontradas.</p>
          ) : canWrite ? (
            <SettingsForm settings={settings} />
          ) : (
            <Card>
              <CardContent className="pt-5 text-sm">
                <p className="font-medium">{settings.company_name}</p>
                <p className="text-muted-foreground">
                  {[settings.phone, settings.email, settings.city].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Somente administradores podem alterar as configurações.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="etapas">
          <Card>
            <CardHeader>
              <CardTitle>Etapas do fluxo da OS</CardTitle>
              <p className="text-sm text-muted-foreground">
                Estas etapas são as colunas do Kanban e alimentam a timeline.
              </p>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {(statuses ?? []).map((status) => (
                  <li key={status.code} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="w-6 text-right text-xs tabular text-muted-foreground">
                      {status.sort_order}
                    </span>
                    <StatusBadge label={status.label} color={status.color} />
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      {status.description ?? '—'}
                    </span>
                    {status.is_default && <Badge variant="secondary" size="sm">inicial</Badge>}
                    {status.is_terminal && <Badge variant="muted" size="sm">final</Badge>}
                    {!status.kanban && <Badge variant="outline" size="sm">fora do Kanban</Badge>}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {status.code}
                    </code>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissoes">
          <Card>
            <CardHeader>
              <CardTitle>Matriz de permissões</CardTitle>
              <p className="text-sm text-muted-foreground">
                Estas permissões valem no banco (RLS), não só na interface.
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Permissão</th>
                    {(Object.keys(ROLE_LABELS) as RoleCode[]).map((role) => (
                      <th key={role} className="px-1.5 py-2 text-center">
                        <span className="block text-[11px]">{ROLE_LABELS[role]}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(permissions ?? []).map((permission: { code: string; label: string }) => (
                    <tr key={permission.code} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <span className="block">{permission.label}</span>
                        <code className="text-[11px] text-muted-foreground">{permission.code}</code>
                      </td>
                      {(Object.keys(ROLE_LABELS) as RoleCode[]).map((role) => {
                        const granted = grants.some(
                          (grant) => grant.role === role && grant.permission === permission.code,
                        )
                        return (
                          <td key={role} className="px-1.5 py-2 text-center">
                            <span
                              className={
                                granted ? 'text-success' : 'text-muted-foreground/30'
                              }
                              aria-label={granted ? 'permitido' : 'negado'}
                            >
                              {granted ? '●' : '○'}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(ROLE_LABELS) as RoleCode[]).map((role) => (
              <Card key={role}>
                <CardContent className="pt-5">
                  <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
                  <p className="mt-2 text-xs tabular text-muted-foreground">
                    {grants.filter((grant) => grant.role === role).length} permissões
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
