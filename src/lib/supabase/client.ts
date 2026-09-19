'use client'

import { createBrowserClient } from '@supabase/ssr'

/** Client do Supabase no browser. Apenas chave anonima - RLS protege os dados. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
