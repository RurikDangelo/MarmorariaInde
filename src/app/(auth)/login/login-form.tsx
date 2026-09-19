'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { signIn, type AuthFormState } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signIn, {})

  return (
    <div>
      <div className="mb-7 lg:hidden">
        <div className="mb-4 flex size-11 items-center justify-center rounded-md bg-primary text-lg font-semibold text-primary-foreground">
          MI
        </div>
      </div>

      <h1 className="text-xl font-semibold tracking-tight">Entrar no sistema</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Use o e-mail cadastrado pela administração da marmoraria.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            placeholder="voce@marmoraria.com.br"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link
              href="/recuperar-senha"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Esqueci a senha
            </Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>

        {state.error && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="size-4 shrink-0" />
            {state.error}
          </p>
        )}

        <Button type="submit" loading={pending} className="mt-1 w-full">
          Entrar
        </Button>
      </form>
    </div>
  )
}
