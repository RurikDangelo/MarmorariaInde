'use client'

import Link from 'next/link'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function LabelsToolbar({ format, count, workOrderId }: { format: 'a4' | 'termica'; count: number; workOrderId: string }) {
  const tab = (value: 'a4' | 'termica', label: string) => (
    <Link
      href={`/os/${workOrderId}/etiquetas?formato=${value}`}
      replace
      className={cn('rounded-md px-3 py-1.5 text-sm', format === value ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary')}
    >
      {label}
    </Link>
  )

  return (
    <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1">
        {tab('a4', 'Folha A4 (2 colunas)')}
        {tab('termica', 'Térmica 100 × 50 mm')}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{count} etiqueta(s) · QTD de Etiquetas de cada peça</span>
        <Button type="button" size="sm" onClick={() => window.print()} disabled={count === 0}>
          <Printer />
          Imprimir
        </Button>
      </div>
    </div>
  )
}
