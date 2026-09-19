'use client'

import { useActionState } from 'react'
import { AlertCircle } from 'lucide-react'
import { updatePassword, type AuthFormState } from '../login/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function NewPasswordPage() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(updatePassword, {})

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Criar nova senha</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha uma senha com pelo menos 8 caracteres.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Nova senha</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required autoFocus />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm">Repetir a senha</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </div>

        {state.error && (
          <p role="alert" className="flex items-center gap-2 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {state.error}
          </p>
        )}

        <Button type="submit" loading={pending} className="w-full">
          Salvar nova senha
        </Button>
      </form>
    </div>
  )
}
