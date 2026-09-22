'use client'

import * as React from 'react'
import { Download, FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { createClient } from '@/lib/supabase/client'
import { formatDate, slugify } from '@/lib/utils'
import { useDocument } from '@/features/composition/components/document-context'
import { deleteQuoteAttachment, registerQuoteAttachment } from '@/features/quotes/actions'
import { getSignedUrl } from '@/features/work-orders/file-actions'
import type { QuoteAttachment } from '@/types/database'

const MAX_SIZE = 25 * 1024 * 1024

/** Aba "Arquivos Anexos" do orcamento (projeto do arquiteto, fotos, PDF). A OS gerada enxerga os mesmos. */
export function QuoteFiles({ attachments }: { attachments: QuoteAttachment[] }) {
  const { ensureDocument, refresh, canEdit } = useDocument()
  const [uploading, setUploading] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try {
      const doc = await ensureDocument()
      if (!doc) return
      const supabase = createClient()
      for (const file of Array.from(files)) {
        if (file.size > MAX_SIZE) {
          toast.error(`${file.name}: arquivo maior que 25 MB.`)
          continue
        }
        const extension = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
        const path = `orcamentos/${doc.id}/${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, '')).slice(0, 50)}.${extension}`
        const { error } = await supabase.storage.from('os-arquivos').upload(path, file, { upsert: false })
        if (error) {
          toast.error(`${file.name}: ${error.message}`)
          continue
        }
        const result = await registerQuoteAttachment({
          quoteId: doc.id,
          storagePath: path,
          fileName: file.name,
          mimeType: file.type || null,
          sizeBytes: file.size,
        })
        if (!result.ok) toast.error(result.error)
      }
      toast.success('Arquivos anexados.')
      refresh()
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function download(path: string) {
    const url = await getSignedUrl(path)
    if (url) window.open(url, '_blank', 'noopener')
    else toast.error('Não foi possível abrir o arquivo.')
  }

  return (
    <div className="flex flex-col gap-3">
      {attachments.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          Nenhum arquivo. Anexe o projeto, fotos do local ou o croqui.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="flex items-center gap-3 px-3 py-2">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{attachment.file_name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(attachment.created_at)}</p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Baixar" onClick={() => download(attachment.storage_path)}>
                <Download />
              </Button>
              {canEdit && (
                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover">
                      <Trash2 className="text-destructive" />
                    </Button>
                  }
                  title="Remover arquivo"
                  description={attachment.file_name}
                  variant="destructive"
                  confirmLabel="Remover"
                  onConfirm={async () => {
                    const result = await deleteQuoteAttachment(attachment.quote_id, attachment.id)
                    if (!result.ok) toast.error(result.error)
                    else {
                      toast.success(result.message)
                      refresh()
                    }
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div>
          <input ref={inputRef} type="file" multiple hidden onChange={(event) => upload(event.target.files)} />
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            Anexar arquivos
          </Button>
        </div>
      )}
    </div>
  )
}
