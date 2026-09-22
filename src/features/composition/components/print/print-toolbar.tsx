'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { PRINT_OPTIONS, type PrintOptions } from '../../print-options'

/** Painel "Impressão": escolhe o que exibir (como no sistema antigo) e imprime/salva em PDF. */
export function PrintToolbar({ options, extra }: { options: PrintOptions; extra?: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function toggle(key: string, value: boolean) {
    const hidden = new Set((searchParams.get('ocultar') ?? '').split(',').filter(Boolean))
    if (value) hidden.delete(key)
    else hidden.add(key)
    const params = new URLSearchParams(searchParams.toString())
    if (hidden.size) params.set('ocultar', [...hidden].join(','))
    else params.delete('ocultar')
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
  }

  return (
    <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-col gap-3 rounded-lg border bg-card p-3 text-card-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Exibir</p>
        <div className="flex gap-2">
          {extra}
          <Button type="button" size="sm" onClick={() => window.print()}>
            <Printer />
            Imprimir / salvar PDF
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        {PRINT_OPTIONS.map((option) => (
          <label key={option.key} className="flex items-center gap-2 text-xs">
            <Checkbox checked={options[option.key]} onCheckedChange={(value) => toggle(option.key, !!value)} />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  )
}
