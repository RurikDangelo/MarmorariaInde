'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertPermission } from '@/lib/auth/session'
import { formToObject, zodToFieldErrors, type ActionState } from '@/features/work-orders/schema'

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === '' || value === 'NENHUM' ? null : value))
  .nullable()
  .optional()

/* ------------------------------------------------------------------ */
/* Planos de ação                                                      */
/* ------------------------------------------------------------------ */

const actionPlanSchema = z.object({
  title: z.string().trim().min(3, 'Informe o título'),
  problem: optionalString,
  action: optionalString,
  responsible_id: optionalString,
  work_order_id: optionalString,
  priority: z.enum(['BAIXA', 'NORMAL', 'ALTA', 'URGENTE']).default('NORMAL'),
  due_date: optionalString,
  status: z.enum(['ABERTO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO']).default('ABERTO'),
  notes: optionalString,
})

export async function saveActionPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('action_plans.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const parsed = actionPlanSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: 'Revise os campos do plano.', fieldErrors: zodToFieldErrors(parsed.error) }
  }

  const payload: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.status === 'CONCLUIDO') payload.completed_at = new Date().toISOString()

  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()

  const { error } = id
    ? await supabase.from('action_plans').update(payload).eq('id', id)
    : await supabase.from('action_plans').insert(payload)

  if (error) return { error: error.message }

  revalidatePath('/planos-de-acao')
  revalidatePath('/dashboard')
  return { success: id ? 'Plano atualizado.' : 'Plano de ação criado.' }
}

export async function updateActionPlanStatus(id: string, status: string): Promise<ActionState> {
  try {
    await assertPermission('action_plans.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('action_plans')
    .update({ status, completed_at: status === 'CONCLUIDO' ? new Date().toISOString() : null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/planos-de-acao')
  return { success: 'Plano atualizado.' }
}

/* ------------------------------------------------------------------ */
/* Alertas                                                             */
/* ------------------------------------------------------------------ */

export async function dismissAlert(id: string): Promise<ActionState> {
  try {
    await assertPermission('alerts.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('alerts')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/alertas')
  revalidatePath('/dashboard')
  // Deixa claro que dispensar não resolve: o aviso volta se o problema continuar.
  return { success: 'Alerta dispensado por hoje. Volta amanhã se o problema continuar.' }
}

export async function recalculateAlerts(): Promise<ActionState> {
  try {
    await assertPermission('alerts.read')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('refresh_alerts')
  if (error) return { error: error.message }

  revalidatePath('/alertas')
  revalidatePath('/dashboard')
  return { success: 'Alertas atualizados.' }
}

/* ------------------------------------------------------------------ */
/* Equipe                                                              */
/* ------------------------------------------------------------------ */

const teamSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da equipe'),
  kind: z.enum(['PRODUCAO', 'MEDICAO', 'INSTALACAO', 'MISTA']).default('MISTA'),
  leader_id: optionalString,
  phone: optionalString,
  notes: optionalString,
})

export async function saveTeam(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission('team.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const parsed = teamSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: 'Revise os campos da equipe.', fieldErrors: zodToFieldErrors(parsed.error) }
  }

  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()

  const { error } = id
    ? await supabase.from('teams').update(parsed.data).eq('id', id)
    : await supabase.from('teams').insert(parsed.data)

  if (error) return { error: error.message }

  revalidatePath('/equipe')
  return { success: id ? 'Equipe atualizada.' : 'Equipe criada.' }
}

export async function setTeamMember(
  teamId: string,
  profileId: string,
  member: boolean,
): Promise<ActionState> {
  try {
    await assertPermission('team.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = member
    ? await supabase.from('team_members').upsert({ team_id: teamId, profile_id: profileId })
    : await supabase.from('team_members').delete().eq('team_id', teamId).eq('profile_id', profileId)

  if (error) return { error: error.message }

  revalidatePath('/equipe')
  return { success: member ? 'Integrante adicionado.' : 'Integrante removido.' }
}

/* ------------------------------------------------------------------ */
/* Usuários e permissões                                               */
/* ------------------------------------------------------------------ */

const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Informe o nome'),
  phone: optionalString,
  job_title: optionalString,
  notes: optionalString,
})

export async function updateOwnProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão expirada.' }

  const parsed = profileSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: 'Revise os campos.', fieldErrors: zodToFieldErrors(parsed.error) }
  }

  const { error } = await supabase.from('profiles').update(parsed.data).eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/perfil')
  revalidatePath('/', 'layout')
  return { success: 'Perfil atualizado.' }
}

export async function updateUserRole(profileId: string, role: string): Promise<ActionState> {
  try {
    await assertPermission('users.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ role }).eq('id', profileId)
  if (error) return { error: error.message }

  revalidatePath('/equipe')
  return { success: 'Papel atualizado.' }
}

export async function setUserActive(profileId: string, active: boolean): Promise<ActionState> {
  try {
    await assertPermission('users.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ active }).eq('id', profileId)
  if (error) return { error: error.message }

  revalidatePath('/equipe')
  return { success: active ? 'Usuário reativado.' : 'Usuário desativado.' }
}

/* ------------------------------------------------------------------ */
/* Configurações da empresa                                            */
/* ------------------------------------------------------------------ */

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use uma cor no formato #RRGGBB')

const settingsSchema = z.object({
  company_name: z.string().trim().min(2, 'Informe o nome da empresa'),
  legal_name: optionalString,
  document: optionalString,
  phone: optionalString,
  whatsapp: optionalString,
  email: optionalString,
  address: optionalString,
  city: optionalString,
  state: optionalString,
  logo_url: optionalString,
  favicon_url: optionalString,
  primary_color: hexColor,
  secondary_color: hexColor,
  accent_color: hexColor,
  default_theme: z.enum(['light', 'dark', 'system']).default('system'),
  login_domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, 'Informe um domínio válido, ex.: marmoraria.app')
    .default('marmoraria.app'),
  quote_validity_days: z.coerce.number().int().min(1).max(365).default(15),
  default_waste_pct: z.coerce.number().min(0).max(100).default(10),
})

export async function saveCompanySettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertPermission('settings.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const parsed = settingsSchema.safeParse(formToObject(formData))
  if (!parsed.success) {
    return { error: 'Revise as configurações.', fieldErrors: zodToFieldErrors(parsed.error) }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('company_settings').update(parsed.data).eq('id', true)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: 'Configurações salvas. O tema já está aplicado.' }
}

export async function saveWorkOrderStatus(
  code: string,
  patch: { label?: string; color?: string; kanban?: boolean },
): Promise<ActionState> {
  try {
    await assertPermission('settings.write')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sem permissão.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('work_order_statuses').update(patch).eq('code', code)
  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  revalidatePath('/os/kanban')
  return { success: 'Etapa atualizada.' }
}
