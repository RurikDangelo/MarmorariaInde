import type { Metadata } from 'next'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { requireUser } from '@/lib/auth/session'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/auth/permissions'
import { ProfileForm } from './profile-form'

export const metadata: Metadata = { title: 'Meu perfil' }

export default async function ProfilePage() {
  const user = await requireUser()
  const permissions = Array.from(user.permissions).sort()

  return (
    <PageContainer>
      <PageHeader title="Meu perfil" description="Seus dados e o que seu perfil permite fazer." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Dados pessoais</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm profile={user.profile} email={user.email} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acesso</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Papel</p>
              <p className="font-medium">{ROLE_LABELS[user.profile.role] ?? user.profile.role}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[user.profile.role] ?? ''}
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">
                Permissões efetivas ({permissions.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {permissions.map((permission) => (
                  <Badge key={permission} variant="secondary" size="sm" className="font-mono">
                    {permission}
                  </Badge>
                ))}
              </div>
            </div>

            <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              Para mudar seu papel ou sua senha, fale com um administrador. A troca de senha também
              pode ser feita pelo link &quot;Esqueci a senha&quot; na tela de login.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
