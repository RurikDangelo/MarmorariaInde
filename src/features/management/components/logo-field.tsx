'use client'

import * as React from 'react'
import { ImageUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

const MAX_SIZE = 5 * 1024 * 1024

/**
 * Logo da marmoraria: envia a imagem para o bucket publico "empresa" e preenche
 * o endereco. Sai no topo da OS emitida, do orcamento e na barra lateral.
 */
export function LogoField({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [url, setUrl] = React.useState(defaultValue)
  const [uploading, setUploading] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function upload(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_SIZE) {
      toast.error('Imagem maior que 5 MB.')
      return
    }
    setUploading(true)
    try {
      const supabase = createClient()
      const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const path = `logo-${Date.now()}.${extension}`
      const { error } = await supabase.storage.from('empresa').upload(path, file, { upsert: false, cacheControl: '31536000' })
      if (error) {
        toast.error(`Não foi possível enviar: ${error.message}`)
        return
      }
      const { data } = supabase.storage.from('empresa').getPublicUrl(path)
      setUrl(data.publicUrl)
      toast.success('Logo enviado. Clique em Salvar para aplicar.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Logo atual" className="h-10 max-w-32 rounded border bg-white object-contain p-0.5" />
        )}
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" /> : <ImageUp />}
          {url ? 'Trocar logo' : 'Enviar logo'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          hidden
          onChange={(event) => upload(event.target.files?.[0])}
        />
      </div>
      <Input name={name} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" />
    </div>
  )
}
