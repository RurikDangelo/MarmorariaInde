'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[marmoraria]', error)
  }, [error])

  return (
    <div className="flex min-h-[calc(var(--screen-h)*0.6)] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" />
        </div>
        <h1 className="text-lg font-semibold">Algo deu errado nesta tela</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nada foi perdido. Tente de novo — se continuar, avise a administração informando o código
          abaixo.
        </p>
        {error.digest && (
          <p className="mt-3 inline-block rounded-md bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground">
            {error.digest}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset}>Tentar novamente</Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Ir para o início</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
