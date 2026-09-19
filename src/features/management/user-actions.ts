'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertPermission } from '@/lib/auth/session'
import { formToObject, zodToFieldErrors, type ActionState } from '@/features/work-orders/schema'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { buildLoginEmail, DEFAULT_LOGIN_DOMAIN } from '@/features/management/login-email'

const ROLE_CODES = [
  'ADMINISTRADOR',
  'GESTOR',
  'PRODUCAO',
  'MEDICAO',
  'INSTALACAO',
  'FINANCEIRO',
  'ESTOQUE',
  'OPERACIONAL',
] as const

const createUserSchema = z.object({
  login: z.string().trim().min(2, 'Informe o e-mail ou o nome de usuário'),
  full_name: z.string().trim().min(2, 'Informe o nome da pessoa'),
  role: z.enum(ROLE_CODES),
  password: z
    .string()
    .min(8, 'A senha provisória precisa ter ao menos 8 caracteres')
    .max(72, 'Senha muito longa'),
  job_title: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
  phone: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
})

const NOT_CONFIGURED =
  'Criação de usuários não está configurada: falta a variável SUPABASE_SERVICE_ROLE_KEY no servidor. ' +
  'Veja docs/05-USUARIOS-E-PERMISSOES.md.'

/**
 * Cria o usuário no Auth e ajusta o perfil.
 *
 * O papel é aplicado em um segundo passo, com a SESSÃO DO ADMINISTRADOR (não com
 * a service_role). Assim a RLS e o trigger tg_protect_profile_role continuam
 * valendo: quem não tem users.write não consegue promover ninguém, nem por aqui.
 */
export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('users.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const parsed = createUserSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: 'Revise os campos do usuário.', fieldErrors: zodToFieldErrors(parsed.error) }
  }

  const admin = createAdminClient()
  if (!admin) return { error: NOT_CONFIGURED }

  const { login, full_name, role, password, job_title, phone } = parsed.data

  const supabaseForSettings = await createClient()
  const { data: settings } = await supabaseForSettings
    .from('company_settings')
    .select('login_domain')
    .eq('id', true)
    .maybeSingle<{ login_domain: string }>()

  const email = buildLoginEmail(login, settings?.login_domain ?? DEFAULT_LOGIN_DOMAIN)

  if (!z.string().email().safeParse(email).success) {
    return {
      error: `"${login}" não formou um acesso válido (${email}). Use letras, números, ponto ou hífen.`,
      fieldErrors: { login: 'Acesso inválido' },
    }
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  })

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('already been registered') || message.includes('already exists')) {
      return { error: `Já existe um acesso com ${email}.` }
    }
    if (message.includes('invalid') && message.includes('email')) {
      return {
        error:
          `O Supabase recusou o endereço ${email}. Troque o "domínio de login" em ` +
          'Configurações → Empresa por um domínio que ele aceite (ex.: um domínio real da empresa).',
      }
    }
    return { error: `Não foi possível criar o acesso: ${error.message}` }
  }

  const userId = data.user?.id
  if (!userId) return { error: 'O Auth não devolveu o usuário criado. Tente novamente.' }

  // Passo 2, sob RLS: completa o cadastro e aplica o papel escolhido.
  const supabase = await createClient()
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name, role, job_title: job_title ?? null, phone: phone ?? null })
    .eq('id', userId)

  if (profileError) {
    return {
      error:
        `Usuário criado no acesso, mas o perfil não foi completado: ${profileError.message}. ` +
        'Ajuste o papel na lista de pessoas.',
    }
  }

  revalidatePath('/equipe')
  return {
    success: `${full_name} já pode entrar com ${email}. Entregue a senha e peça para trocar no primeiro acesso.`,
  }
}

/** Envia o link de redefinição de senha para o usuário. */
export async function sendPasswordReset(email: string): Promise<ActionState> {
  try {
    await assertPermission('users.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/nova-senha`,
  })

  if (error) return { error: `Não foi possível enviar o link: ${error.message}` }
  return { success: `Link de redefinição enviado para ${email}.` }
}

/** Define uma nova senha provisória para o usuário (uso do administrador). */
export async function resetUserPassword(userId: string, password: string): Promise<ActionState> {
  try {
    await assertPermission('users.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  if (password.length < 8) return { error: 'A senha precisa ter ao menos 8 caracteres.' }

  const admin = createAdminClient()
  if (!admin) return { error: NOT_CONFIGURED }

  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) return { error: `Não foi possível alterar a senha: ${error.message}` }

  return { success: 'Senha provisória definida. Peça para a pessoa trocar no primeiro acesso.' }
}

/** Lista as permissões de um papel — usado para explicar o acesso na tela. */
export async function permissionsForRole(role: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('role_permissions')
    .select('permission')
    .eq('role', role)
    .returns<{ permission: string }[]>()

  const granted = new Set((data ?? []).map((row) => row.permission))
  return PERMISSIONS.filter((permission) => granted.has(permission))
}
