import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, Bell, Info } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { EmptyState } from '@/components/shared/states'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { cn, formatDateTime } from '@/lib/utils'
import { AlertActions, RefreshAlertsButton } from '@/features/management/components/alert-actions'
import type { Alert } from '@/types/database'

export const metadata: Metadata = { title: 'Alertas' }

const SEVERITY_LABEL: Record<string, string> = {
  CRITICO: 'Crítico',
  ATENCAO: 'Atenção',
  INFO: 'Informativo',
}

export default async function AlertsPage() {
  const user = await requirePermission('alerts.read')
  const supabase = await createClient()

  await supabase.rpc('refresh_alerts').then(() => null, () => null)

  const { data } = await supabase
    .from('alerts')
    .select('*')
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(200)
    .returns<Alert[]>()

  const alerts = data ?? []
  const critical = alerts.filter((alert) => alert.severity === 'CRITICO')
  const warning = alerts.filter((alert) => alert.severity === 'ATENCAO')
  const info = alerts.filter((alert) => alert.severity === 'INFO')

  return (
    <PageContainer>
      <PageHeader
        title="Alertas"
        description="O que precisa de atenção agora — recalculado a cada abertura."
        actions={<RefreshAlertsButton />}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Críticos" value={critical.length} icon={AlertTriangle} tone={critical.length ? 'destructive' : 'success'} />
        <MetricCard label="Atenção" value={warning.length} icon={Bell} tone={warning.length ? 'warning' : 'success'} />
        <MetricCard label="Informativos" value={info.length} icon={Info} tone="info" />
      </section>

      {alerts.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nenhum alerta ativo"
          description="Prazos, estoque, pagamentos e medições estão em dia."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {alerts.map((alert) => (
            <Card key={alert.id}>
              <CardContent className="flex items-start gap-3 py-3.5">
                <span
                  className={cn(
                    'mt-1 size-2.5 shrink-0 rounded-full',
                    alert.severity === 'CRITICO' && 'bg-destructive',
                    alert.severity === 'ATENCAO' && 'bg-warning',
                    alert.severity === 'INFO' && 'bg-info',
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {alert.href ? (
                      <Link href={alert.href} className="text-sm font-medium hover:underline">
                        {alert.title}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium">{alert.title}</p>
                    )}
                    <Badge
                      variant={
                        alert.severity === 'CRITICO'
                          ? 'destructive'
                          : alert.severity === 'ATENCAO'
                            ? 'warning'
                            : 'info'
                      }
                      size="sm"
                    >
                      {SEVERITY_LABEL[alert.severity] ?? alert.severity}
                    </Badge>
                  </div>
                  {alert.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{alert.description}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground/70">{formatDateTime(alert.created_at)}</p>
                </div>

                {user.permissions.has('alerts.write') && <AlertActions alertId={alert.id} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  )
}
