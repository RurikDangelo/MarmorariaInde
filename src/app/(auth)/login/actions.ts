'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(6, 'A senha precisa ter ao menos 6 caracteres'),
  redirectTo: z.string().optional(),
})

export interface AuthFormState {
  error?: string
  success?: string
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    redirectTo: formData.get('redirectTo') ?? undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    // Mensagem generica de proposito: nao revela se o e-mail existe.
    return { error: 'E-mail ou senha incorretos.' }
  }

  const destination = parsed.data.redirectTo?.startsWith('/') ? parsed.data.redirectTo : '/dashboard'
  revalidatePath('/', 'layout')
  redirect(destination)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

const emailSchema = z.string().email('Informe um e-mail válido')

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = emailSchema.safeParse(formData.get('email'))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'E-mail inválido' }

  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteUrl}/auth/callback?next=/nova-senha`,
  })

  // Resposta identica com ou sem cadastro, para nao expor a base de usuarios.
  return { success: 'Se o e-mail estiver cadastrado, enviamos o link de recuperação.' }
}

const passwordSchema = z
  .object({
    password: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'As senhas não conferem',
    path: ['confirm'],
  })

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = passwordSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Link expirado. Solicite a recuperação novamente.' }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: 'Não foi possível alterar a senha. Tente novamente.' }

  redirect('/dashboard')
}
