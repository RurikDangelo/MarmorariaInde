'use client'

import { useOptimistic, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { PRINT_OPTIONS, type PrintOptionKey, type PrintOptions } from '../../print-options'

/** Painel "Impressão": escolhe o que exibir (como no sistema antigo) e imprime/salva em PDF. */
export function PrintToolbar({ options, extra }: { options: PrintOptions; extra?: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  // marca na hora; o documento acompanha quando o servidor devolver a nova versao
  const [checked, setChecked] = useOptimistic(
    options,
    (current, change: { key: PrintOptionKey; value: boolean }) => ({ ...current, [change.key]: change.value }),
  )

  function toggle(key: PrintOptionKey, value: boolean) {
    const hidden = new Set((searchParams.get('ocultar') ?? '').split(',').filter(Boolean))
    if (value) hidden.delete(key)
    else hidden.add(key)
    const params = new URLSearchParams(searchParams.toString())
    if (hidden.size) params.set('ocultar', [...hidden].join(','))
    else params.delete('ocultar')
    // URLSearchParams.size nao existe antes do Chrome 113: usar toString()
    const query = params.toString()
    startTransition(() => {
      setChecked({ key, value })
      router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false })
    })
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
            <Checkbox checked={checked[option.key]} onCheckedChange={(value) => toggle(option.key, !!value)} />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  )
}
