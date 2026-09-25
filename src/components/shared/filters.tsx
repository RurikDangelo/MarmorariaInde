'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/**
 * Atualiza a query string preservando os demais filtros.
 *
 * A navegação vai dentro de `startTransition` por um motivo concreto: sem isso
 * o Next considera a troca urgente, descarta a tela e exibe o `loading.tsx` —
 * o dashboard inteiro desmonta e remonta a cada mudança de período. Dentro da
 * transição a tela atual continua no lugar enquanto o servidor recalcula, e
 * `pending` dá o feedback de que algo está acontecendo.
 */
function useUrlFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = React.useTransition()

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value && value !== 'TODOS') params.set(key, value)
      else params.delete(key)
      params.delete('pagina')
      const query = params.toString()
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
      })
    },
    [pathname, router, searchParams],
  )

  const clear = React.useCallback(() => {
    startTransition(() => router.replace(pathname, { scroll: false }))
  }, [pathname, router])

  return { searchParams, setParam, clear, pending, pathname, router }
}

export function SearchInput({
  paramName = 'busca',
  placeholder = 'Buscar…',
  className,
}: {
  paramName?: string
  placeholder?: string
  className?: string
}) {
  const { searchParams, setParam } = useUrlFilters()
  const [value, setValue] = React.useState(searchParams.get(paramName) ?? '')
  const initial = React.useRef(true)

  React.useEffect(() => {
    if (initial.current) {
      initial.current = false
      return
    }
    const timeout = setTimeout(() => setParam(paramName, value.trim() || null), 350)
    return () => clearTimeout(timeout)
  }, [value, paramName, setParam])

  return (
    <div className={cn('relative w-full sm:max-w-xs', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-8"
        aria-label={placeholder}
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Limpar busca"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

export function FilterSelect({
  paramName,
  label,
  options,
  allLabel = 'Todos',
  className,
}: {
  paramName: string
  label: string
  options: { value: string; label: string }[]
  allLabel?: string
  className?: string
}) {
  const { searchParams, setParam, pending } = useUrlFilters()
  const current = searchParams.get(paramName) ?? 'TODOS'

  return (
    <Select value={current} onValueChange={(value) => setParam(paramName, value)}>
      <SelectTrigger
        className={cn('w-full sm:w-44', className)}
        aria-label={label}
        aria-busy={pending || undefined}
      >
        {pending && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="TODOS">{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center', className)}>{children}</div>
  )
}

export function ClearFiltersButton({ keys }: { keys: string[] }) {
  const { searchParams, clear, pending } = useUrlFilters()
  const active = keys.some((key) => searchParams.get(key))
  if (!active) return null

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={clear}
      disabled={pending}
      className="text-muted-foreground"
    >
      <X className="size-3.5" />
      Limpar filtros
    </Button>
  )
}

/** Filtro de período para dashboards e relatórios. */
export function PeriodFilter({ paramName = 'periodo' }: { paramName?: string }) {
  return (
    <FilterSelect
      paramName={paramName}
      label="Período"
      allLabel="Este mês"
      options={[
        { value: 'hoje', label: 'Hoje' },
        { value: 'semana', label: 'Esta semana' },
        { value: 'mes', label: 'Este mês' },
        { value: 'trimestre', label: 'Últimos 90 dias' },
        { value: 'ano', label: 'Este ano' },
      ]}
    />
  )
}
