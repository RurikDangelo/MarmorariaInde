'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useDocument } from '../document-context'
import { newId } from './use-item-draft'

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * Ambiente do produto: um dos ambientes do documento ou um nome novo
 * (da lista ou digitado), que nasce junto quando o produto e gravado.
 */
export function EnvironmentSelect({
  environmentId,
  environmentName,
  onChange,
  invalid,
}: {
  environmentId: string | null
  environmentName: string
  onChange: (value: { environment_id: string; environment_name: string }) => void
  invalid?: boolean
}) {
  const { environments, catalog } = useDocument()
  const [open, setOpen] = React.useState(false)
  const [term, setTerm] = React.useState('')

  const existing = environments.find((environment) => environment.id === environmentId)
  const label = existing ? `${existing.number} - ${existing.name}` : environmentName ? `${environmentName} (novo)` : ''
  const used = new Set(environments.map((environment) => normalize(environment.name)))
  const suggestions = catalog.lookups.filter(
    (option) => option.list === 'AMBIENTE' && !used.has(normalize(option.label)) && normalize(option.label).includes(normalize(term)),
  )
  const shown = environments.filter((environment) => normalize(environment.name).includes(normalize(term)))
  const clean = term.trim()

  function chooseNew(name: string) {
    onChange({ environment_id: newId(), environment_name: name })
    setOpen(false)
    setTerm('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className={cn('h-9 w-full justify-between px-3 font-normal', !label && 'text-muted-foreground', invalid && 'border-destructive')}
        >
          <span className="truncate">{label || 'Escolha ou digite o ambiente'}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={term} onValueChange={setTerm} placeholder="Cozinha, banheiro…" autoFocus />
          <CommandList>
            {shown.length > 0 && (
              <CommandGroup heading="Ambientes desta OS">
                {shown.map((environment) => (
                  <CommandItem
                    key={environment.id}
                    value={environment.id}
                    onSelect={() => {
                      onChange({ environment_id: environment.id, environment_name: '' })
                      setOpen(false)
                      setTerm('')
                    }}
                  >
                    <Check className={cn(environment.id === environmentId ? 'opacity-100' : 'opacity-0')} />
                    {environment.number} - {environment.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {suggestions.length > 0 && (
              <CommandGroup heading="Novo ambiente">
                {suggestions.slice(0, 12).map((option) => (
                  <CommandItem key={option.id} value={option.id} onSelect={() => chooseNew(option.label)}>
                    <Plus />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {clean && !shown.some((environment) => normalize(environment.name) === normalize(clean)) && (
              <CommandGroup>
                <CommandItem value="__novo__" onSelect={() => chooseNew(clean)} className="text-primary">
                  <Plus className="text-primary" />
                  Criar ambiente “{clean}”
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
