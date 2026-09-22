'use client'

import * as React from 'react'
import { ChevronsUpDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

export interface CatalogPickerOption {
  id: string
  code: string | null
  name: string
  /** Texto a direita: preco, unidade... */
  hint?: string
}

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Busca sem acento, por codigo ou descricao ("sao gab" acha "Gran. Preto São Gabriel"). */
export function filterCatalog<T extends CatalogPickerOption>(options: T[], term: string, limit = 60): T[] {
  const tokens = normalize(term).split(/\s+/).filter(Boolean)
  if (!tokens.length) return options.slice(0, limit)
  const matches = options.filter((option) => {
    const haystack = normalize(`${option.code ?? ''} ${option.name}`)
    return tokens.every((token) => haystack.includes(token))
  })
  const first = tokens[0]
  const rank = (option: T) =>
    option.code && normalize(option.code) === first ? 0 : normalize(option.name).startsWith(first) ? 1 : 2
  return matches.sort((a, b) => rank(a) - rank(b)).slice(0, limit)
}

/**
 * Busca num cadastro (materiais, produtos, servicos...) com "+ Cadastrar"
 * para incluir sem sair da tela, como a grade de busca do sistema antigo.
 */
export function CatalogPicker({
  options,
  value,
  selectedLabel,
  placeholder,
  onSelect,
  onCreate,
  createLabel = 'Cadastrar',
  disabled,
  invalid,
  id,
  className,
}: {
  options: CatalogPickerOption[]
  value: string | null
  /** Texto mostrado quando o item escolhido nao esta (mais) no cadastro. */
  selectedLabel?: string
  placeholder: string
  onSelect: (id: string) => void
  onCreate?: (term: string) => void
  createLabel?: string
  disabled?: boolean
  invalid?: boolean
  id?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [term, setTerm] = React.useState('')
  const selected = options.find((option) => option.id === value)
  const shown = React.useMemo(() => filterCatalog(options, term), [options, term])
  const label = selected ? `${selected.code ? `${selected.code} · ` : ''}${selected.name}` : selectedLabel

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setTerm('')
      }}
    >
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
            !label && 'text-muted-foreground',
            invalid && 'border-destructive',
            className,
          )}
        >
          <span className="truncate">{label ?? placeholder}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(34rem,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={term} onValueChange={setTerm} placeholder="Código ou descrição…" autoFocus />
          <CommandList>
            <CommandEmpty>Nada encontrado com “{term}”.</CommandEmpty>
            <CommandGroup>
              {shown.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => {
                    onSelect(option.id)
                    setOpen(false)
                    setTerm('')
                  }}
                  className="px-2 py-2"
                >
                  <span className="w-14 shrink-0 text-xs tabular text-muted-foreground">{option.code ?? '—'}</span>
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  {option.hint && <span className="shrink-0 text-xs tabular text-muted-foreground">{option.hint}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
            {onCreate && (
              <CommandGroup>
                <CommandItem
                  value="__cadastrar__"
                  onSelect={() => {
                    setOpen(false)
                    onCreate(term.trim())
                    setTerm('')
                  }}
                  className="px-2 py-2 text-primary"
                >
                  <Plus className="text-primary" />
                  {term.trim() ? `${createLabel} “${term.trim()}”` : createLabel}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
