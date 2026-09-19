'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/** Atualiza a query string preservando os demais filtros. */
function useUrlFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value && value !== 'TODOS') params.set(key, value)
      else params.delete(key)
      params.delete('pagina')
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  return { searchParams, setParam, pathname, router }
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
  const { searchParams, setParam } = useUrlFilters()
  const current = searchParams.get(paramName) ?? 'TODOS'

  return (
    <Select value={current} onValueChange={(value) => setParam(paramName, value)}>
      <SelectTrigger className={cn('w-full sm:w-44', className)} aria-label={label}>
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
  const { searchParams, pathname, router } = useUrlFilters()
  const active = keys.some((key) => searchParams.get(key))
  if (!active) return null

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.replace(pathname, { scroll: false })}
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
