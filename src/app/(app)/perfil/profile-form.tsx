'use client'

import * as React from 'react'
import { useActionForm } from '@/lib/hooks/use-action-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FormActions, FormSection } from '@/components/shared/form'
import { PhoneInput } from '@/components/shared/inputs'
import { updateOwnProfile } from '@/features/management/actions'
import type { Profile } from '@/types/database'

export function ProfileForm({ profile, email }: { profile: Profile; email: string | null }) {
  const [state, formAction, pending] = useActionForm(updateOwnProfile)

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormSection columns={2}>
        <Field label="Nome completo" required span="full" error={state.fieldErrors?.full_name}>
          <Input name="full_name" defaultValue={profile.full_name} required />
        </Field>

        <Field label="E-mail" hint="O e-mail é gerenciado pelo login e não muda por aqui">
          <Input value={email ?? ''} disabled readOnly />
        </Field>

        <Field label="Telefone">
          <PhoneInput name="phone" defaultValue={profile.phone ?? ''} />
        </Field>

        <Field label="Função na marmoraria" span="full">
          <Input name="job_title" defaultValue={profile.job_title ?? ''} placeholder="Ex.: Marmorista" />
        </Field>

        <Field label="Observações" span="full">
          <Textarea name="notes" rows={2} defaultValue={profile.notes ?? ''} />
        </Field>
      </FormSection>

      <FormActions>
        <Button type="submit" loading={pending}>
          Salvar
        </Button>
      </FormActions>
    </form>
  )
}
