'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, Plus, Search, User } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { visibleNavigation } from '@/lib/navigation'

interface QuickResult {
  id: string
  label: string
  hint: string | null
  href: string
  type: 'os' | 'cliente'
}

export function CommandMenu({ permissions }: { permissions: string[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<QuickResult[]>([])
  const permissionSet = React.useMemo(() => new Set(permissions), [permissions])
  const groups = React.useMemo(() => visibleNavigation(permissionSet), [permissionSet])

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || event.key === '/') {
        const target = event.target as HTMLElement | null
        if (event.key === '/' && target && /input|textarea/i.test(target.tagName)) return
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  React.useEffect(() => {
    const term = query.trim()
    let cancelled = false

    const timeout = setTimeout(async () => {
      if (term.length < 2) {
        if (!cancelled) setResults([])
        return
      }

      const supabase = createClient()
      const found: QuickResult[] = []

      if (permissionSet.has('work_orders.read')) {
        const { data } = await supabase
          .from('work_orders')
          .select('id, number, title, customer:customers(name)')
          .or(`number.ilike.%${term}%,title.ilike.%${term}%`)
          .limit(5)

        const orders = (data ?? []) as unknown as {
          id: string
          number: string
          title: string | null
          customer: { name: string } | { name: string }[] | null
        }[]

        for (const row of orders) {
          const customerName = Array.isArray(row.customer) ? row.customer[0]?.name : row.customer?.name
          found.push({
            id: row.id,
            label: `${row.number}${row.title ? ` · ${row.title}` : ''}`,
            hint: customerName ?? null,
            href: `/os/${row.id}`,
            type: 'os',
          })
        }
      }

      if (permissionSet.has('customers.read')) {
        const { data } = await supabase
          .from('customers')
          .select('id, name, phone')
          .ilike('name', `%${term}%`)
          .limit(5)

        for (const row of (data ?? []) as unknown as { id: string; name: string; phone: string | null }[]) {
          found.push({ id: row.id, label: row.name, hint: row.phone, href: `/clientes/${row.id}`, type: 'cliente' })
        }
      }

      if (!cancelled) setResults(found)
    }, term.length < 2 ? 0 : 250)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [query, permissionSet])

  function go(href: string) {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full justify-start gap-2 px-2.5 text-muted-foreground sm:w-56"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left text-sm font-normal">Buscar…</span>
        <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={results.length === 0}>
        <CommandInput placeholder="Buscar OS, cliente ou página…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>Nada encontrado.</CommandEmpty>

          {results.length > 0 && (
            <>
              <CommandGroup heading="Resultados">
                {results.map((result) => (
                  <CommandItem key={`${result.type}-${result.id}`} value={`${result.label} ${result.hint ?? ''}`} onSelect={() => go(result.href)}>
                    {result.type === 'os' ? <ClipboardList /> : <User />}
                    <span className="truncate">{result.label}</span>
                    {result.hint && <span className="ml-auto truncate text-xs text-muted-foreground">{result.hint}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {permissionSet.has('work_orders.write') && (
            <CommandGroup heading="Ações rápidas">
              <CommandItem value="nova os criar ordem de servico" onSelect={() => go('/os/nova')}>
                <Plus />
                Nova ordem de serviço
                <CommandShortcut>OS</CommandShortcut>
              </CommandItem>
              {permissionSet.has('quotes.write') && (
                <CommandItem value="novo orcamento criar proposta" onSelect={() => go('/orcamentos/novo')}>
                  <Plus />
                  Novo orçamento
                </CommandItem>
              )}
              {permissionSet.has('customers.write') && (
                <CommandItem value="novo cliente cadastrar" onSelect={() => go('/clientes?novo=1')}>
                  <Plus />
                  Novo cliente
                </CommandItem>
              )}
            </CommandGroup>
          )}

          {groups.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <CommandItem
                    key={item.href}
                    value={`${item.label} ${item.keywords?.join(' ') ?? ''}`}
                    onSelect={() => go(item.href)}
                  >
                    <Icon />
                    {item.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  )
}
