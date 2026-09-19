'use client'

import * as React from 'react'
import { Download, FileText, ImagePlus, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/states'
import { createClient } from '@/lib/supabase/client'
import { formatDate, slugify } from '@/lib/utils'
import {
  deleteWorkOrderFile,
  getSignedUrl,
  registerWorkOrderAttachment,
  registerWorkOrderPhoto,
} from '@/features/work-orders/file-actions'
import type { WorkOrderAttachment, WorkOrderPhoto } from '@/types/database'

const STAGES = [
  { value: 'GERAL', label: 'Geral' },
  { value: 'MEDICAO', label: 'Medição' },
  { value: 'PRODUCAO', label: 'Produção' },
  { value: 'CONFERENCIA', label: 'Conferência' },
  { value: 'EXPEDICAO', label: 'Expedição' },
  { value: 'INSTALACAO_ANTES', label: 'Instalação · antes' },
  { value: 'INSTALACAO_DEPOIS', label: 'Instalação · depois' },
]

const MAX_SIZE = 25 * 1024 * 1024

export function FilesPanel({
  workOrderId,
  workOrderNumber,
  photos,
  attachments,
  canWrite,
}: {
  workOrderId: string
  workOrderNumber: string
  photos: WorkOrderPhoto[]
  attachments: WorkOrderAttachment[]
  canWrite: boolean
}) {
  const [stage, setStage] = React.useState('GERAL')
  const [uploading, setUploading] = React.useState(false)

  async function upload(files: FileList | null, asPhoto: boolean) {
    if (!files?.length) return
    setUploading(true)
    const supabase = createClient()

    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_SIZE) {
          toast.error(`${file.name}: arquivo maior que 25 MB.`)
          continue
        }

        const extension = file.name.split('.').pop() ?? 'bin'
        const path = `${workOrderNumber}/${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, ''))}.${extension}`

        const { error } = await supabase.storage.from('os-arquivos').upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        })

        if (error) {
          toast.error(`${file.name}: ${error.message}`)
          continue
        }

        const result = asPhoto
          ? await registerWorkOrderPhoto({ workOrderId, storagePath: path, stage })
          : await registerWorkOrderAttachment({
              workOrderId,
              storagePath: path,
              fileName: file.name,
              mimeType: file.type || null,
              sizeBytes: file.size,
              kind: 'DOCUMENTO',
            })

        if (result.error) toast.error(result.error)
      }
      toast.success('Upload concluído.')
    } finally {
      setUploading(false)
    }
  }

  async function open(path: string) {
    const url = await getSignedUrl(path)
    if (url) window.open(url, '_blank', 'noopener')
    else toast.error('Não foi possível abrir o arquivo.')
  }

  return (
    <div className="flex flex-col gap-5">
      {canWrite && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium">Etapa da foto</label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger className="sm:max-w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" disabled={uploading}>
                <label className="cursor-pointer">
                  {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                  Enviar fotos
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(event) => upload(event.target.files, true)}
                  />
                </label>
              </Button>

              <Button asChild variant="outline" disabled={uploading}>
                <label className="cursor-pointer">
                  {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
                  Enviar documento
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    multiple
                    className="sr-only"
                    onChange={(event) => upload(event.target.files, false)}
                  />
                </label>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold">Fotos ({photos.length})</h3>
        {photos.length === 0 ? (
          <EmptyState icon={ImagePlus} title="Nenhuma foto anexada" />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative overflow-hidden rounded-lg border">
                <button
                  type="button"
                  onClick={() => open(photo.storage_path)}
                  className="flex aspect-4/3 w-full flex-col items-center justify-center gap-1 bg-secondary/40 p-3 text-center transition-colors hover:bg-secondary"
                >
                  <ImagePlus className="size-5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">
                    {STAGES.find((item) => item.value === photo.stage)?.label ?? photo.stage}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70">{formatDate(photo.created_at)}</span>
                </button>
                {canWrite && (
                  <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <ConfirmDialog
                      trigger={
                        <Button variant="secondary" size="icon-sm" aria-label="Remover foto">
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      }
                      title="Remover foto"
                      variant="destructive"
                      confirmLabel="Remover"
                      onConfirm={async () => {
                        const result = await deleteWorkOrderFile(
                          'work_order_photos',
                          photo.id,
                          photo.storage_path,
                          workOrderId,
                        )
                        if (result.error) toast.error(result.error)
                        else toast.success(result.success ?? 'Removida.')
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Documentos ({attachments.length})</h3>
        {attachments.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhum documento anexado" />
        ) : (
          <ul className="divide-y rounded-lg border">
            {attachments.map((file) => (
              <li key={file.id} className="flex items-center gap-3 px-3 py-2.5">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(file.created_at)}
                    {file.size_bytes ? ` · ${(file.size_bytes / 1024 / 1024).toFixed(1)} MB` : ''}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => open(file.storage_path)} aria-label="Baixar">
                  <Download />
                </Button>
                {canWrite && (
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="Remover arquivo">
                        <Trash2 className="text-destructive" />
                      </Button>
                    }
                    title="Remover arquivo"
                    variant="destructive"
                    confirmLabel="Remover"
                    onConfirm={async () => {
                      const result = await deleteWorkOrderFile(
                        'work_order_attachments',
                        file.id,
                        file.storage_path,
                        workOrderId,
                      )
                      if (result.error) toast.error(result.error)
                      else toast.success(result.success ?? 'Removido.')
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
