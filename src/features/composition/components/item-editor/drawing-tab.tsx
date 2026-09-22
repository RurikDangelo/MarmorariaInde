'use client'

import * as React from 'react'
import { ExternalLink, ImageUp, Loader2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { slugify } from '@/lib/utils'
import { getSignedUrl } from '@/features/work-orders/file-actions'
import { useDocument } from '../document-context'
import type { DocumentRef } from '../../types'

const MAX_SIZE = 25 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,application/pdf'

/** Pasta dos desenhos: a do orcamento fica visivel tambem na OS gerada a partir dele. */
export function drawingFolder(doc: DocumentRef) {
  return doc.kind === 'quote' ? `orcamentos/${doc.id}/desenhos` : `os/${doc.id}/desenhos`
}

/** Aba Desenho: croqui ou projeto do produto (foto do desenho, PDF do projeto). */
export function DrawingTab({
  itemId,
  path,
  onChange,
  readOnly,
}: {
  itemId: string
  path: string | null
  onChange: (path: string | null) => void
  readOnly: boolean
}) {
  const { ensureDocument } = useDocument()
  const [uploading, setUploading] = React.useState(false)
  const [url, setUrl] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const isPdf = path?.toLowerCase().endsWith('.pdf')

  React.useEffect(() => {
    let cancelled = false
    if (path) {
      getSignedUrl(path).then((signed) => {
        if (!cancelled) setUrl(signed)
      })
    }
    return () => {
      cancelled = true
    }
  }, [path])

  async function upload(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_SIZE) {
      toast.error('Arquivo maior que 25 MB.')
      return
    }
    setUploading(true)
    try {
      const doc = await ensureDocument()
      if (!doc) return
      const extension = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const name = `${itemId}-${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, '')).slice(0, 40)}.${extension}`
      const target = `${drawingFolder(doc)}/${name}`
      const { error } = await createClient().storage.from('os-arquivos').upload(target, file, { upsert: false })
      if (error) {
        toast.error(`Não foi possível enviar: ${error.message}`)
        return
      }
      onChange(target)
      toast.success('Desenho anexado. Grave o produto (F2) para guardar.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {path ? (
        <div className="overflow-hidden rounded-md border bg-muted/30">
          {url && !isPdf ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Desenho do produto" className="mx-auto max-h-[45dvh] object-contain" />
          ) : (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {isPdf ? 'Projeto em PDF anexado.' : 'Carregando desenho…'}
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
          Anexe o desenho do produto: foto do croqui, imagem ou PDF do projeto.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!readOnly && (
          <>
            <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={(event) => upload(event.target.files?.[0])} />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? <Loader2 className="animate-spin" /> : <ImageUp />}
              {path ? 'Trocar desenho' : 'Anexar desenho'}
            </Button>
          </>
        )}
        {url && (
          <Button type="button" variant="ghost" size="sm" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              Abrir
            </a>
          </Button>
        )}
        {path && !readOnly && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <Unlink />
            Tirar do produto
          </Button>
        )}
      </div>
    </div>
  )
}
