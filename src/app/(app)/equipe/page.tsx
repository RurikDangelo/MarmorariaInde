import type { Metadata } from 'next'
import { Award, Clock, UsersRound } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { EmptyState } from '@/components/shared/states'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import { formatNumber, initials } from '@/lib/utils'
import {
  RoleSelect,
  TeamDialog,
  TeamMemberToggle,
  UserActiveToggle,
} from '@/features/management/components/team-components'
import type { Profile, RoleCode, Team } from '@/types/database'

export const metadata: Metadata = { title: 'Equipe' }

export default async function TeamPage() {
  const user = await requirePermission('team.read')
  const canManageTeams = user.permissions.has('team.write')
  const canManageUsers = user.permissions.has('users.write')
  const supabase = await createClient()

  const [{ data: profiles }, { data: teams }, { data: members }, { data: production }, { data: workOrders }] =
    await Promise.all([
      user.permissions.has('users.read')
        ? supabase.from('profiles').select('*').order('full_name').returns<Profile[]>()
        : supabase
            .from('profiles')
            .select('id, full_name, role, active, job_title, phone, email, avatar_url, notes, created_at, updated_at')
            .eq('active', true)
            .order('full_name')
            .returns<Profile[]>(),
      supabase
        .from('teams')
        .select('*, leader:profiles!teams_leader_id_fkey ( id, full_name )')
        .order('name')
        .returns<Team[]>(),
      supabase.from('team_members').select('team_id, profile_id'),
      supabase.from('production_records').select('responsible_id, status, duration_minutes, is_rework'),
      supabase.from('work_orders').select('assigned_to, finished_at, cancelled_at, deadline'),
    ])

  const people = profiles ?? []
  const teamList = teams ?? []
  const memberList = (members ?? []) as { team_id: string; profile_id: string }[]
  const today = new Date().toISOString().slice(0, 10)

  const performance = people.map((person) => {
    const records = (production ?? []).filter(
      (record: { responsible_id: string | null }) => record.responsible_id === person.id,
    ) as { status: string; duration_minutes: number | null; is_rework: boolean }[]
    const orders = (workOrders ?? []).filter(
      (order: { assigned_to: string | null }) => order.assigned_to === person.id,
    ) as { finished_at: string | null; cancelled_at: string | null; deadline: string | null }[]

    const durations = records
      .filter((record) => record.duration_minutes != null)
      .map((record) => record.duration_minutes as number)

    return {
      person,
      finishedSteps: records.filter((record) => record.status === 'CONCLUIDO').length,
      rework: records.filter((record) => record.is_rework).length,
      avgMinutes: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
      ordersOpen: orders.filter((order) => !order.finished_at && !order.cancelled_at).length,
      ordersLate: orders.filter(
        (order) => !order.finished_at && !order.cancelled_at && order.deadline && order.deadline < today,
      ).length,
      ordersDone: orders.filter((order) => order.finished_at).length,
    }
  })

  return (
    <PageContainer>
      <PageHeader
        title="Equipe"
        description="Quem faz o quê, em qual equipe, com qual desempenho."
        actions={
          canManageTeams ? (
            <TeamDialog users={people.map((person) => ({ id: person.id, full_name: person.full_name }))} />
          ) : undefined
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Pessoas ativas" value={people.filter((person) => person.active).length} icon={UsersRound} />
        <MetricCard label="Equipes" value={teamList.filter((team) => team.active).length} icon={UsersRound} tone="info" />
        <MetricCard
          label="Retrabalhos"
          value={performance.reduce((sum, item) => sum + item.rework, 0)}
          icon={Award}
          tone="warning"
        />
      </section>

      <Tabs defaultValue="pessoas">
        <TabsList>
          <TabsTrigger value="pessoas">Pessoas</TabsTrigger>
          <TabsTrigger value="equipes">Equipes</TabsTrigger>
          <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
        </TabsList>

        <TabsContent value="pessoas">
          {people.length === 0 ? (
            <EmptyState icon={UsersRound} title="Nenhum usuário cadastrado" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {people.map((person) => (
                <Card key={person.id} className={person.active ? undefined : 'opacity-60'}>
                  <CardContent className="flex items-start gap-3 pt-5">
                    <Avatar className="size-10">
                      <AvatarFallback>{initials(person.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{person.full_name || 'Sem nome'}</p>
                      <p className="truncate text-xs text-muted-foreground">{person.email ?? '—'}</p>
                      {person.job_title && (
                        <p className="truncate text-xs text-muted-foreground">{person.job_title}</p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {canManageUsers ? (
                          <RoleSelect profileId={person.id} role={person.role as RoleCode} />
                        ) : (
                          <Badge variant="secondary">{ROLE_LABELS[person.role as RoleCode] ?? person.role}</Badge>
                        )}
                        {!person.active && <Badge variant="muted">Inativo</Badge>}
                      </div>

                      {canManageUsers && (
                        <div className="mt-1">
                          <UserActiveToggle profileId={person.id} active={person.active} />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {canManageUsers && (
            <p className="mt-4 rounded-md border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
              Novos usuários são criados pelo painel de autenticação do Supabase (Authentication → Users).
              Assim que o usuário existe, o perfil aparece aqui e o papel pode ser ajustado.
            </p>
          )}
        </TabsContent>

        <TabsContent value="equipes">
          {teamList.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="Nenhuma equipe criada"
              description="Crie equipes de produção, medição e instalação para escalar o trabalho."
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {teamList.map((team) => {
                const teamMembers = memberList.filter((member) => member.team_id === team.id)
                return (
                  <Card key={team.id}>
                    <CardHeader className="flex-row items-start justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {team.name}
                          <Badge variant="secondary" size="sm">
                            {team.kind.toLowerCase()}
                          </Badge>
                        </CardTitle>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {team.leader?.full_name ? `Líder: ${team.leader.full_name}` : 'Sem líder definido'}
                          {team.phone ? ` · ${team.phone}` : ''}
                        </p>
                      </div>
                      {canManageTeams && (
                        <TeamDialog
                          users={people.map((person) => ({ id: person.id, full_name: person.full_name }))}
                          team={team}
                          trigger={<button className="text-xs text-primary hover:underline">Editar</button>}
                        />
                      )}
                    </CardHeader>
                    <CardContent>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Integrantes ({teamMembers.length})
                      </p>
                      {canManageTeams ? (
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {people
                            .filter((person) => person.active)
                            .map((person) => (
                              <TeamMemberToggle
                                key={person.id}
                                teamId={team.id}
                                profileId={person.id}
                                checked={teamMembers.some((member) => member.profile_id === person.id)}
                                label={person.full_name}
                              />
                            ))}
                        </div>
                      ) : (
                        <ul className="flex flex-wrap gap-1.5">
                          {teamMembers.map((member) => {
                            const person = people.find((item) => item.id === member.profile_id)
                            return (
                              <li key={member.profile_id}>
                                <Badge variant="secondary">{person?.full_name ?? '—'}</Badge>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="desempenho">
          <Card>
            <CardHeader>
              <CardTitle>Desempenho por colaborador</CardTitle>
              <p className="text-sm text-muted-foreground">
                Baseado nos apontamentos de produção e nas OS atribuídas. Sem dados, sem número inventado.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2">Pessoa</th>
                      <th className="py-2 text-right">OS abertas</th>
                      <th className="py-2 text-right">OS atrasadas</th>
                      <th className="py-2 text-right">OS concluídas</th>
                      <th className="py-2 text-right">Etapas concluídas</th>
                      <th className="py-2 text-right">Retrabalhos</th>
                      <th className="py-2 text-right">Tempo médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performance
                      .filter((item) => item.person.active)
                      .map((item) => (
                        <tr key={item.person.id} className="border-b last:border-0">
                          <td className="py-2.5">
                            <span className="font-medium">{item.person.full_name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {ROLE_LABELS[item.person.role as RoleCode] ?? item.person.role}
                            </span>
                          </td>
                          <td className="py-2.5 text-right tabular">{item.ordersOpen}</td>
                          <td className={`py-2.5 text-right tabular ${item.ordersLate ? 'text-destructive' : ''}`}>
                            {item.ordersLate}
                          </td>
                          <td className="py-2.5 text-right tabular">{item.ordersDone}</td>
                          <td className="py-2.5 text-right tabular">{item.finishedSteps}</td>
                          <td className={`py-2.5 text-right tabular ${item.rework ? 'text-warning' : ''}`}>
                            {item.rework}
                          </td>
                          <td className="py-2.5 text-right tabular">
                            {item.avgMinutes != null ? (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="size-3 text-muted-foreground" />
                                {formatNumber(item.avgMinutes / 60, 1)}h
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
