import type { CompanySettings } from '@/types/database'

/** Luminancia relativa para decidir se o texto sobre a cor deve ser claro ou escuro. */
function luminance(hex: string): number {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return 0.5
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(clean.slice(i, i + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function readableForeground(hex: string): string {
  return luminance(hex) > 0.45 ? 'oklch(0.2 0.01 60)' : 'oklch(0.99 0.004 90)'
}

function isHex(value: string | null | undefined): value is string {
  return !!value && /^#[0-9a-fA-F]{6}$/.test(value)
}

/**
 * Aplica as cores da empresa (company_settings) sobre os design tokens.
 * Renderizado no servidor, sem flash: entra como <style> no layout raiz.
 */
export function BrandTheme({ settings }: { settings: CompanySettings | null }) {
  if (!settings) return null

  const rules: string[] = []

  if (isHex(settings.primary_color)) {
    rules.push(`--primary:${settings.primary_color}`)
    rules.push(`--primary-foreground:${readableForeground(settings.primary_color)}`)
    rules.push(`--ring:${settings.primary_color}`)
    // --chart-* nao entra aqui de proposito: a paleta de dados e validada para
    // daltonismo/contraste e nao deve depender da cor escolhida pela empresa.
  }
  if (isHex(settings.secondary_color)) {
    rules.push(`--sidebar-foreground:${settings.secondary_color}`)
  }
  if (isHex(settings.accent_color)) {
    rules.push(`--accent:${settings.accent_color}`)
    rules.push(`--accent-foreground:${readableForeground(settings.accent_color)}`)
  }

  if (!rules.length) return null

  // Only the brand tokens are overridden; o restante da paleta continua vindo do CSS.
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root{${rules.join(';')}}.dark{${rules.join(';')}}`,
      }}
    />
  )
}
