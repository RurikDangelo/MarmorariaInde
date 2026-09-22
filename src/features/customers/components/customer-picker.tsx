'use client'

import * as React from 'react'
import { ChevronsUpDown, Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { CustomerDialog } from '@/features/customers/components/customer-dialog'
import type { Customer } from '@/types/database'

export type CustomerSummary = Pick<
  Customer,
  | 'id'
  | 'name'
  | 'document'
  | 'phone'
  | 'whatsapp'
  | 'email'
  | 'city'
  | 'state'
  | 'district'
  | 'zip_code'
  | 'address'
  | 'address_number'
  | 'complement'
>

const SUMMARY_COLUMNS = 'id, name, document, phone, whatsapp, email, city, state, district, zip_code, address, address_number, complement'

/**
 * Cliente da OS/orcamento: busca por nome, CPF/CNPJ ou telefone e, se nao
 * achar, cadastra ali mesmo com o que foi digitado.
 */
export function CustomerPicker({
  value,
  onChange,
  canCreate,
  disabled,
  invalid,
  id,
}: {
  value: CustomerSummary | null
  onChange: (customer: CustomerSummary) => void
  canCreate: boolean
  disabled?: boolean
  invalid?: boolean
  id?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [term, setTerm] = React.useState('')
  const [results, setResults] = React.useState<CustomerSummary[]>([])
  const [loading, setLoading] = React.useState(false)
  const [creating, setCreating] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const clean = term.replace(/[%,()]/g, '').trim()
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      let query = supabase.from('customers').select(SUMMARY_COLUMNS).eq('active', true).order('name').limit(20)
      if (clean) {
        query = query.or(
          `name.ilike.%${clean}%,document.ilike.%${clean}%,phone.ilike.%${clean}%,whatsapp.ilike.%${clean}%`,
        )
      }
      const { data } = await query.returns<CustomerSummary[]>()
      if (!cancelled) {
        setResults(data ?? [])
        setLoading(false)
      }
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [term, open])

  function choose(customer: CustomerSummary) {
    onChange(customer)
    setOpen(false)
    setTerm('')
  }

  return (
    <>
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
            <span className="truncate">
              {value ? value.name : 'Buscar cliente por nome, CPF/CNPJ ou telefone'}
              {value?.city && <span className="text-muted-foreground"> · {value.city}</span>}
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput value={term} onValueChange={setTerm} placeholder="Digite para buscar…" autoFocus />
            <CommandList>
              {loading && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Buscando…
                </div>
              )}
              {!loading && <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>}
              <CommandGroup>
                {results.map((customer) => (
                  <CommandItem key={customer.id} value={customer.id} onSelect={() => choose(customer)} className="px-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate">{customer.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[customer.document, customer.whatsapp ?? customer.phone, customer.city].filter(Boolean).join(' · ') ||
                          'Sem contato'}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              {canCreate && (
                <CommandGroup>
                  <CommandItem
                    value="__novo__"
                    onSelect={() => {
                      setOpen(false)
                      setCreating(true)
                    }}
                    className="px-2 py-2 text-primary"
                  >
                    <UserPlus className="text-primary" />
                    {term.trim() ? `Cadastrar "${term.trim()}"` : 'Cadastrar novo cliente'}
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {canCreate && creating && (
        <CustomerDialog
          open={creating}
          onOpenChange={setCreating}
          defaultName={term.trim()}
          onSaved={(customer) => {
            setCreating(false)
            choose(customer)
          }}
        />
      )}
    </>
  )
}
