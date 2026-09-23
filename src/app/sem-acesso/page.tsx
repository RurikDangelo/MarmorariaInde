import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSessionUser } from '@/lib/auth/session'
import { ROLE_LABELS } from '@/lib/auth/permissions'

export const metadata = { title: 'Sem acesso' }

export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ permissao?: string }>
}) {
  const { permissao } = await searchParams
  const user = await getSessionUser()

  return (
    <div className="flex min-h-(--screen-h) items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-warning/15">
          <ShieldAlert className="size-6 text-warning" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Você não tem acesso a esta área</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {user?.profile.role
            ? `Seu perfil é ${ROLE_LABELS[user.profile.role] ?? user.profile.role}.`
            : 'Seu perfil não permite ver esta página.'}{' '}
          Fale com um administrador se precisar desta permissão.
        </p>
        {permissao && (
          <p className="mt-3 inline-block rounded-md bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground">
            {permissao}
          </p>
        )}
        <div className="mt-6">
          <Button asChild>
            <Link href="/dashboard">Voltar para o início</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
