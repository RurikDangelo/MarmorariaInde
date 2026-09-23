import 'server-only'
import { createClient } from '@/lib/supabase/server'

export interface StoredFile {
  bucket: string
  path: string
}

/**
 * Apaga do Storage os arquivos que ficaram sem dono depois de excluir um
 * documento. O banco devolve a lista ja sem os arquivos que outro documento
 * ainda usa. Falha aqui nao desfaz a exclusao: o arquivo so fica ocupando espaco.
 */
export async function removeStoredFiles(files: StoredFile[]): Promise<void> {
  const byBucket = new Map<string, string[]>()
  for (const file of files ?? []) {
    if (!file?.bucket || !file?.path) continue
    byBucket.set(file.bucket, [...(byBucket.get(file.bucket) ?? []), file.path])
  }
  if (!byBucket.size) return

  const supabase = await createClient()
  await Promise.all(
    Array.from(byBucket, ([bucket, paths]) => supabase.storage.from(bucket).remove(paths)),
  )
}
