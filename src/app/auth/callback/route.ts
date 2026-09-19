import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Troca o `code` do link enviado por e-mail (recuperação de senha, convite)
 * por uma sessão válida e redireciona para a página seguinte.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const safeNext = next.startsWith('/') ? next : '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?erro=link-invalido`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?erro=link-expirado`)
  }

  return NextResponse.redirect(`${origin}${safeNext}`)
}
