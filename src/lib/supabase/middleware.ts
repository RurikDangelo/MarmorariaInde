import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_ROUTES = ['/login', '/recuperar-senha', '/nova-senha', '/auth']

/**
 * Renova a sessao do Supabase a cada request e bloqueia rotas privadas.
 * Roda no middleware do Next - e a primeira barreira, nao a unica:
 * as policies de RLS continuam valendo no banco.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return response

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))

  if (!user && !isPublic) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && (pathname === '/login' || pathname === '/')) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = pathname === '/' ? '/dashboard' : '/dashboard'
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  return response
}
