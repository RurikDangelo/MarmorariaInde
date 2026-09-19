'use client'

import * as React from 'react'
import { useActionForm } from '@/lib/hooks/use-action-form'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FormSection } from '@/components/shared/form'
import { PhoneInput } from '@/components/shared/inputs'
import { saveTeam, setTeamMember, setUserActive, updateUserRole } from '@/features/management/actions'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import type { RoleCode, Team } from '@/types/database'

export function TeamDialog({
  users,
  team,
  trigger,
}: {
  users: { id: string; full_name: string }[]
  team?: Team
  trigger?: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [, formAction, pending] = useActionForm(saveTeam, {
    onSuccess: () => {
      setOpen(false)
      router.refresh()
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus />
            Nova equipe
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team ? 'Editar equipe' : 'Nova equipe'}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-5">
          {team && <input type="hidden" name="id" value={team.id} />}

          <FormSection columns={2}>
            <Field label="Nome" required span="full">
              <Input name="name" defaultValue={team?.name ?? ''} required autoFocus />
            </Field>

            <Field label="Tipo">
              <Select name="kind" defaultValue={team?.kind ?? 'MISTA'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MISTA">Mista</SelectItem>
                  <SelectItem value="PRODUCAO">Produção</SelectItem>
                  <SelectItem value="MEDICAO">Medição</SelectItem>
                  <SelectItem value="INSTALACAO">Instalação</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Líder">
              <Select name="leader_id" defaultValue={team?.leader_id ?? 'NENHUM'}>
                <SelectTrigger>
                  <SelectValue placeholder="Não definido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NENHUM">Não definido</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Telefone" span="full">
              <PhoneInput name="phone" defaultValue={team?.phone ?? ''} />
            </Field>
          </FormSection>

          <Field label="Observações">
            <Textarea name="notes" rows={2} defaultValue={team?.notes ?? ''} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Salvar equipe
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TeamMemberToggle({
  teamId,
  profileId,
  checked,
  label,
}: {
  teamId: string
  profileId: string
  checked: boolean
  label: string
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        checked={checked}
        disabled={pending}
        onCheckedChange={(value) =>
          startTransition(async () => {
            const result = await setTeamMember(teamId, profileId, !!value)
            if (result.error) toast.error(result.error)
            else {
              toast.success(result.success ?? 'Atualizado.')
              router.refresh()
            }
          })
        }
      />
      {label}
    </label>
  )
}

export function RoleSelect({ profileId, role }: { profileId: string; role: RoleCode }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  return (
    <Select
      value={role}
      disabled={pending}
      onValueChange={(value) =>
        startTransition(async () => {
          const result = await updateUserRole(profileId, value)
          if (result.error) toast.error(result.error)
          else {
            toast.success(result.success ?? 'Papel atualizado.')
            router.refresh()
          }
        })
      }
    >
      <SelectTrigger size="sm" className="w-44">
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
  )
}

export function UserActiveToggle({ profileId, active }: { profileId: string; active: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      className={active ? 'text-muted-foreground' : 'text-success'}
      onClick={() =>
        startTransition(async () => {
          const result = await setUserActive(profileId, !active)
          if (result.error) toast.error(result.error)
          else {
            toast.success(result.success ?? 'Atualizado.')
            router.refresh()
          }
        })
      }
    >
      {active ? 'Desativar' : 'Reativar'}
    </Button>
  )
}
