import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="size-6 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço não existe ou o registro foi removido.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link href="/dashboard">Voltar para o início</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
