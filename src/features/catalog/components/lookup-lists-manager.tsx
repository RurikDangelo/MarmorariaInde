'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { deleteLookupOption, saveLookupOption } from '@/features/catalog/actions'
import { LOOKUP_LISTS } from '@/lib/labels'
import type { LookupList, LookupOption } from '@/types/database'

function ListCard({ list, options, canWrite }: { list: (typeof LOOKUP_LISTS)[number]; options: LookupOption[]; canWrite: boolean }) {
  const router = useRouter()
  const [label, setLabel] = React.useState('')
  const [days, setDays] = React.useState('')
  const [business, setBusiness] = React.useState(false)
  const [installments, setInstallments] = React.useState('')
  const [pending, startTransition] = React.useTransition()
  const withDays = list.value === 'VALIDADE' || list.value === 'PREVISAO_ENTREGA'

  function add(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await saveLookupOption({
        id: null,
        list: list.value as LookupList,
        label,
        days: withDays && days ? Number.parseInt(days, 10) : null,
        business_days: list.value === 'PREVISAO_ENTREGA' && business,
        installments: list.value === 'FORMA_PAGAMENTO' ? installments : '',
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message)
      setLabel('')
      setDays('')
      setInstallments('')
      router.refresh()
    })
  }

  async function remove(option: LookupOption) {
    const result = await deleteLookupOption(option.id)
    if (!result.ok) toast.error(result.error)
    else router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{list.label}</CardTitle>
        <CardDescription>{list.hint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-wrap gap-1.5">
          {options.map((option) => (
            <li key={option.id} className="flex items-center gap-1 rounded-full border bg-secondary/40 py-0.5 pl-2.5 pr-1 text-sm">
              {option.label}
              {option.installments && <span className="text-xs text-muted-foreground">({option.installments})</span>}
              {withDays && option.days != null && (
                <span className="text-xs text-muted-foreground">
                  ({option.days} {option.business_days ? 'úteis' : 'dias'})
                </span>
              )}
              {canWrite && (
                <button
                  type="button"
                  onClick={() => remove(option)}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Remover ${option.label}`}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
          {options.length === 0 && <li className="text-sm text-muted-foreground">Lista vazia.</li>}
        </ul>
        {canWrite && (
          <form onSubmit={add} className="flex flex-wrap items-center gap-2">
            <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Novo item" className="min-w-40 flex-1" required />
            {withDays && (
              <Input value={days} onChange={(event) => setDays(event.target.value.replace(/\D/g, ''))} placeholder="Dias" className="w-20" inputMode="numeric" />
            )}
            {list.value === 'PREVISAO_ENTREGA' && (
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={business} onCheckedChange={(value) => setBusiness(!!value)} />
                úteis
              </label>
            )}
            {list.value === 'FORMA_PAGAMENTO' && (
              <Input value={installments} onChange={(event) => setInstallments(event.target.value)} placeholder="0/30/60" className="w-28" />
            )}
            <Button type="submit" size="sm" variant="outline" loading={pending}>
              <Plus />
              Incluir
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

/** Listas rapidas usadas na tela da OS/orcamento. */
export function LookupListsManager({ options, canWrite }: { options: LookupOption[]; canWrite: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {LOOKUP_LISTS.map((list) => (
        <ListCard key={list.value} list={list} options={options.filter((option) => option.list === list.value)} canWrite={canWrite} />
      ))}
    </div>
  )
}
