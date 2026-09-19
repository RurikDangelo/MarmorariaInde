'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { requestPasswordReset, type AuthFormState } from '../login/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RecoverPasswordPage() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(requestPasswordReset, {})

  return (
    <div>
      <Link
        href="/login"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar para o login
      </Link>

      <h1 className="text-xl font-semibold tracking-tight">Recuperar senha</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Informe seu e-mail e enviaremos um link para você criar uma nova senha.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </div>

        {state.error && (
          <p role="alert" className="flex items-center gap-2 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {state.error}
          </p>
        )}

        {state.success && (
          <p className="flex items-center gap-2 rounded-md border border-success/25 bg-success/5 px-3 py-2 text-sm text-success">
            <CheckCircle2 className="size-4 shrink-0" />
            {state.success}
          </p>
        )}

        <Button type="submit" loading={pending} className="w-full">
          Enviar link de recuperação
        </Button>
      </form>
    </div>
  )
}
