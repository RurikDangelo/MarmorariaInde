'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Copy, KeyRound, RefreshCw, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useActionForm } from '@/lib/hooks/use-action-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FormSection } from '@/components/shared/form'
import { PhoneInput } from '@/components/shared/inputs'
import { createUser, resetUserPassword, sendPasswordReset } from '@/features/management/user-actions'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/auth/permissions'
import { buildLoginEmail } from '@/features/management/login-email'
import type { RoleCode } from '@/types/database'

/** Senha provisória legível: duas sílabas + número. Fácil de ditar no telefone. */
function suggestPassword(): string {
  const parts = ['pedra', 'granito', 'marmore', 'bancada', 'chapa', 'polido', 'corte', 'serra']
  const pick = () => parts[Math.floor(Math.random() * parts.length)]
  const number = Math.floor(Math.random() * 9000) + 1000
  return `${pick()}-${pick()}-${number}`
}

export function NewUserDialog({
  enabled,
  loginDomain,
}: {
  enabled: boolean
  loginDomain: string
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [password, setPassword] = React.useState(suggestPassword)
  const [role, setRole] = React.useState<RoleCode>('OPERACIONAL')
  const [login, setLogin] = React.useState('')

  const [state, formAction, pending] = useActionForm(createUser, {
    onSuccess: () => {
      setOpen(false)
      setPassword(suggestPassword())
      setLogin('')
      router.refresh()
    },
  })

  function copyPassword() {
    navigator.clipboard.writeText(password).then(
      () => toast.success('Senha provisória copiada.'),
      () => toast.error('Não foi possível copiar.'),
    )
  }

  if (!enabled) {
    return (
      <Button
        variant="outline"
        onClick={() =>
          toast.error(
            'Falta configurar SUPABASE_SERVICE_ROLE_KEY no servidor para criar usuários por aqui.',
          )
        }
      >
        <UserPlus />
        Novo usuário
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus />
          Novo usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>
            Não precisa de e-mail real: digite um nome de usuário e o sistema monta o acesso.
            A pessoa entra com esse acesso e a senha provisória que você entregar.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="role" value={role} />

          <FormSection columns={2}>
            <Field label="Nome completo" required span="full" error={state.fieldErrors?.full_name}>
              <Input name="full_name" required autoFocus placeholder="Ex.: João Marmorista" />
            </Field>

            <Field
              label="Acesso"
              required
              span="full"
              error={state.fieldErrors?.login}
              hint={
                login.includes('@')
                  ? 'E-mail real: a pessoa também poderá usar "Esqueci a senha".'
                  : buildLoginEmail(login, loginDomain)
                    ? `Vai entrar como: ${buildLoginEmail(login, loginDomain)} — sem e-mail, a senha é entregue por você.`
                    : `Digite um nome de usuário (ex.: joao.silva) ou um e-mail real.`
              }
            >
              <Input
                name="login"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                required
                placeholder="joao.silva"
                autoComplete="off"
              />
            </Field>

            <Field label="Função na marmoraria">
              <Input name="job_title" placeholder="Ex.: Marmorista" />
            </Field>

            <Field label="Telefone">
              <PhoneInput name="phone" />
            </Field>

            <Field label="Papel de acesso" required span="full" hint={ROLE_DESCRIPTIONS[role]}>
              <Select value={role} onValueChange={(value) => setRole(value as RoleCode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as RoleCode[]).map((code) => (
                    <SelectItem key={code} value={code}>
                      {ROLE_LABELS[code]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Senha provisória"
              required
              span="full"
              error={state.fieldErrors?.password}
              hint="Anote e entregue para a pessoa. Ela deve trocar no primeiro acesso."
            >
              <div className="flex gap-2">
                <Input
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="font-mono"
                  required
                  minLength={8}
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setPassword(suggestPassword())} aria-label="Gerar outra senha">
                  <RefreshCw />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={copyPassword} aria-label="Copiar senha">
                  <Copy />
                </Button>
              </div>
            </Field>
          </FormSection>

          {role === 'ADMINISTRADOR' && (
            <p className="rounded-md border border-warning/30 bg-warning/8 px-3 py-2 text-xs text-warning">
              Administrador vê e altera tudo, inclusive usuários, permissões e configurações.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Criar usuário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ResetPasswordButton({
  userId,
  email,
  enabled,
}: {
  userId: string
  email: string | null
  enabled: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [password, setPassword] = React.useState(suggestPassword)
  const [pending, startTransition] = React.useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <KeyRound />
          Senha
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Senha de acesso</DialogTitle>
          <DialogDescription>{email ?? 'usuário sem e-mail'}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field
            label="Definir senha provisória"
            hint="Você entrega a senha para a pessoa. Ela troca no primeiro acesso."
          >
            <div className="flex gap-2">
              <Input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="font-mono"
                minLength={8}
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setPassword(suggestPassword())} aria-label="Gerar outra">
                <RefreshCw />
              </Button>
            </div>
          </Field>

          <Button
            loading={pending}
            disabled={!enabled}
            onClick={() =>
              startTransition(async () => {
                const result = await resetUserPassword(userId, password)
                if (result.error) toast.error(result.error)
                else {
                  toast.success(result.success ?? 'Senha definida.')
                  setOpen(false)
                }
              })
            }
          >
            Definir esta senha
          </Button>

          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            variant="outline"
            loading={pending}
            disabled={!email}
            onClick={() =>
              startTransition(async () => {
                const result = await sendPasswordReset(email!)
                if (result.error) toast.error(result.error)
                else {
                  toast.success(result.success ?? 'Link enviado.')
                  setOpen(false)
                }
              })
            }
          >
            Enviar link de redefinição por e-mail
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
