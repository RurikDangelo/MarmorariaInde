'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, ListPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { saveLookupOption } from '@/features/catalog/actions'
import type { LookupList, LookupOption } from '@/types/database'

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** "20 dias úteis" -> 20 dias uteis; "Entrada + 30/60" -> 0/30/60. */
export function inferLookupFields(list: LookupList, label: string) {
  const numbers = (label.match(/\d{1,3}/g) ?? []).map(Number)
  const days = numbers.length ? numbers[0] : null
  let installments = ''
  if (list === 'FORMA_PAGAMENTO') {
    const withEntry = /entrada|vista/i.test(label) && numbers[0] !== 0 ? [0, ...numbers] : numbers
    installments = (withEntry.length ? withEntry : [0]).slice(0, 24).join('/')
  }
  return {
    days: list === 'VALIDADE' || list === 'PREVISAO_ENTREGA' ? days : null,
    business_days: list === 'PREVISAO_ENTREGA' && /[uú]teis/i.test(label),
    installments,
  }
}

/**
 * Lista rapida (ambiente, validade, previsao, forma de pagamento): escolhe da
 * lista, usa um texto livre ou inclui o texto na lista sem sair da tela.
 */
export function LookupCombobox({
  list,
  options,
  value,
  onSelect,
  onCreated,
  placeholder,
  canAddToList,
  allowFreeText = true,
  disabled,
  invalid,
  id,
}: {
  list: LookupList
  options: LookupOption[]
  value: string
  onSelect: (label: string, option: LookupOption | null) => void
  onCreated?: (option: LookupOption) => void
  placeholder: string
  canAddToList: boolean
  allowFreeText?: boolean
  disabled?: boolean
  invalid?: boolean
  id?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [term, setTerm] = React.useState('')
  const [pending, startTransition] = React.useTransition()
  const clean = term.trim()
  const shown = options.filter((option) => normalize(option.label).includes(normalize(term)))
  const exists = options.some((option) => normalize(option.label) === normalize(clean))

  function choose(label: string, option: LookupOption | null) {
    onSelect(label, option)
    setOpen(false)
    setTerm('')
  }

  function addToList() {
    startTransition(async () => {
      const result = await saveLookupOption({ id: null, list, label: clean, ...inferLookupFields(list, clean) })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message)
      onCreated?.(result.data)
      choose(result.data.label, result.data)
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn(
            'h-9 w-full justify-between px-3 font-normal',
            !value && 'text-muted-foreground',
            invalid && 'border-destructive',
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={term} onValueChange={setTerm} placeholder="Buscar ou digitar…" autoFocus />
          <CommandList>
            <CommandGroup>
              {shown.map((option) => (
                <CommandItem key={option.id} value={option.id} onSelect={() => choose(option.label, option)}>
                  <Check className={cn(normalize(option.label) === normalize(value) ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex-1 truncate">{option.label}</span>
                  {option.installments && list === 'FORMA_PAGAMENTO' && (
                    <span className="text-xs tabular text-muted-foreground">{option.installments}</span>
                  )}
                </CommandItem>
              ))}
              {!shown.length && !clean && (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">Lista vazia. Digite para incluir.</p>
              )}
            </CommandGroup>
            {clean && !exists && (
              <CommandGroup>
                {allowFreeText && (
                  <CommandItem value="__usar__" onSelect={() => choose(clean, null)}>
                    Usar “{clean}”
                  </CommandItem>
                )}
                {canAddToList && (
                  <CommandItem value="__salvar__" onSelect={addToList} disabled={pending} className="text-primary">
                    <ListPlus className="text-primary" />
                    Incluir “{clean}” na lista
                  </CommandItem>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
