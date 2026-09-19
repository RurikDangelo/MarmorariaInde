'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PrintButton() {
  return (
    <div className="no-print mb-4 flex justify-end">
      <Button size="sm" onClick={() => window.print()}>
        <Printer />
        Imprimir
      </Button>
    </div>
  )
}
