import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

function readEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Supabase nao configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }
  return { url, key }
}

/**
 * Client do Supabase para Server Components, Server Actions e Route Handlers.
 * Sempre usa a chave anonima: a autorizacao real acontece nas policies de RLS.
 */
export async function createClient() {
  const { url, key } = readEnv()
  const cookieStore = await cookies()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Chamado de um Server Component: o middleware ja renova a sessao.
        }
      },
    },
  })
}
