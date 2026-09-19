import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export default async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Tudo, exceto arquivos estaticos, imagens, manifest e service worker.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
