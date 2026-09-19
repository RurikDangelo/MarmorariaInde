import 'server-only'

import { createClient } from '@supabase/supabase-js'

/**
 * Client administrativo do Supabase (service_role).
 *
 * REGRAS:
 * - `import 'server-only'` faz o build QUEBRAR se este arquivo for importado
 *   por um Client Component. A chave nunca pode chegar ao browser.
 * - Ignora RLS por completo. Use exclusivamente para o que a API pública não
 *   consegue fazer: criar usuário no Auth e disparar convite.
 * - Toda action que usar este client precisa checar a permissão ANTES
 *   (`assertPermission('users.write')`). Sem RLS para defender, a checagem
 *   explícita é a única barreira.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) return null

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** A criação de usuários pelo sistema depende da service_role estar configurada. */
export function isUserManagementEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}
