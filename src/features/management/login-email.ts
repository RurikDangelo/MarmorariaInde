/**
 * Monta o endereço de acesso a partir do que o administrador digita.
 *
 * A marmoraria não quer depender de e-mail real para dar acesso ao medidor ou
 * ao instalador. O Auth exige um e-mail, então um nome de usuário vira
 * `joao.silva@<domínio de login>`. Esses endereços não recebem e-mail: a senha
 * provisória é entregue pelo administrador.
 *
 * Fica fora de actions.ts de propósito: em arquivo `'use server'` todo export
 * precisa ser uma função async, e o formulário precisa desta mesma regra para
 * mostrar o acesso enquanto a pessoa digita.
 */

export const DEFAULT_LOGIN_DOMAIN = 'marmoraria.app'

export function slugifyLogin(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/(^[.\-_]+|[.\-_]+$)/g, '')
}

export function buildLoginEmail(login: string, domain = DEFAULT_LOGIN_DOMAIN): string {
  const clean = login.trim()
  if (!clean) return ''
  if (clean.includes('@')) return clean.toLowerCase()
  const slug = slugifyLogin(clean)
  return slug ? `${slug}@${domain}` : ''
}
