import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Permission } from '@/lib/auth/permissions'
import type { CompanySettings, Profile } from '@/types/database'

export interface SessionUser {
  id: string
  email: string | null
  profile: Profile
  permissions: Set<Permission>
}

/**
 * Usuario autenticado + perfil + permissoes efetivas.
 * `cache` garante uma unica ida ao banco por request, mesmo com varios
 * Server Components consultando.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()

  // Assinatura do JWT conferida aqui mesmo (sem ida ao Auth); o banco confere de novo
  // em cada consulta e o perfil inativo continua barrado logo abaixo.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null

  const [{ data: profile }, { data: permissions }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', claims.sub).single<Profile>(),
    supabase.rpc('my_permissions').returns<string[]>(),
  ])

  if (!profile || !profile.active) return null

  return {
    id: claims.sub,
    email: claims.email ?? null,
    profile,
    permissions: new Set((permissions ?? []) as Permission[]),
  }
})

/** Configuracoes da empresa (tema, logo, nome). Cacheado por request. */
export const getCompanySettings = cache(async (): Promise<CompanySettings | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('company_settings')
    .select('*')
    .eq('id', true)
    .maybeSingle<CompanySettings>()
  return data ?? null
})

/** Exige sessao valida. Redireciona para o login se nao houver. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  return user
}

/**
 * Exige uma permissao. Use no topo de toda page e Server Action.
 * O banco revalida via RLS - isto e a primeira camada, nao a unica.
 */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser()
  if (!user.permissions.has(permission)) {
    redirect(`/sem-acesso?permissao=${encodeURIComponent(permission)}`)
  }
  return user
}

/** Versao para Server Actions: lanca erro em vez de redirecionar. */
export async function assertPermission(permission: Permission): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new Error('Sessão expirada. Faça login novamente.')
  if (!user.permissions.has(permission)) {
    throw new Error('Você não tem permissão para executar esta ação.')
  }
  return user
}

export async function can(permission: Permission): Promise<boolean> {
  const user = await getSessionUser()
  return user?.permissions.has(permission) ?? false
}
