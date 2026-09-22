import { createClient } from '@/lib/supabase/server'
import type { LineItem } from '@/types/database'

const IMAGE = /\.(jpe?g|png|webp)$/i

/** URLs assinadas (10 min) dos desenhos em imagem, para a impressao. */
export async function drawingUrlsFor(items: LineItem[]): Promise<Record<string, string>> {
  const withDrawing = items.filter((item) => item.drawing_path && IMAGE.test(item.drawing_path))
  if (!withDrawing.length) return {}
  const supabase = await createClient()
  const { data } = await supabase.storage
    .from('os-arquivos')
    .createSignedUrls(withDrawing.map((item) => item.drawing_path!), 60 * 10)
  const byPath = new Map((data ?? []).filter((row) => row.signedUrl).map((row) => [row.path, row.signedUrl]))
  return Object.fromEntries(
    withDrawing.flatMap((item) => {
      const url = byPath.get(item.drawing_path!)
      return url ? [[item.id, url]] : []
    }),
  )
}
