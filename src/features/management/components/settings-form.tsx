'use client'

import * as React from 'react'
import { useActionForm } from '@/lib/hooks/use-action-form'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, FormActions, FormSection } from '@/components/shared/form'
import { DocumentInput, PhoneInput } from '@/components/shared/inputs'
import { saveCompanySettings } from '@/features/management/actions'
import type { CompanySettings } from '@/types/database'

export function SettingsForm({ settings }: { settings: CompanySettings }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionForm(saveCompanySettings, { onSuccess: () => router.refresh() })
  const [colors, setColors] = React.useState({
    primary: settings.primary_color,
    secondary: settings.secondary_color,
    accent: settings.accent_color,
  })

  const error = (field: string) => state.fieldErrors?.[field]

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Card>
        <CardContent className="pt-5">
          <FormSection title="Dados da empresa" columns={2}>
            <Field label="Nome" required span="full" error={error('company_name')}>
              <Input name="company_name" defaultValue={settings.company_name} required />
            </Field>
            <Field label="Razão social">
              <Input name="legal_name" defaultValue={settings.legal_name ?? ''} />
            </Field>
            <Field label="CNPJ">
              <DocumentInput name="document" defaultValue={settings.document ?? ''} />
            </Field>
            <Field label="Telefone">
              <PhoneInput name="phone" defaultValue={settings.phone ?? ''} />
            </Field>
            <Field label="WhatsApp">
              <PhoneInput name="whatsapp" defaultValue={settings.whatsapp ?? ''} />
            </Field>
            <Field label="E-mail">
              <Input name="email" type="email" defaultValue={settings.email ?? ''} />
            </Field>
            <Field label="Endereço">
              <Input name="address" defaultValue={settings.address ?? ''} />
            </Field>
            <Field label="Cidade">
              <Input name="city" defaultValue={settings.city ?? ''} />
            </Field>
            <Field label="UF">
              <Input name="state" defaultValue={settings.state ?? ''} maxLength={2} />
            </Field>
          </FormSection>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <FormSection
            title="Identidade visual"
            description="As cores são aplicadas no sistema inteiro assim que você salva."
            columns={3}
          >
            <ColorField
              label="Cor primária"
              name="primary_color"
              value={colors.primary}
              onChange={(value) => setColors((current) => ({ ...current, primary: value }))}
              error={error('primary_color')}
            />
            <ColorField
              label="Cor secundária"
              name="secondary_color"
              value={colors.secondary}
              onChange={(value) => setColors((current) => ({ ...current, secondary: value }))}
              error={error('secondary_color')}
            />
            <ColorField
              label="Cor de destaque"
              name="accent_color"
              value={colors.accent}
              onChange={(value) => setColors((current) => ({ ...current, accent: value }))}
              error={error('accent_color')}
            />

            <Field label="Logo (URL)" hint="Envie a imagem no bucket 'empresa' do Storage e cole o link público">
              <Input name="logo_url" defaultValue={settings.logo_url ?? ''} placeholder="https://…" />
            </Field>
            <Field label="Favicon (URL)">
              <Input name="favicon_url" defaultValue={settings.favicon_url ?? ''} placeholder="https://…" />
            </Field>
            <Field label="Tema padrão">
              <Select name="default_theme" defaultValue={settings.default_theme}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">Seguir o sistema</SelectItem>
                  <SelectItem value="light">Claro</SelectItem>
                  <SelectItem value="dark">Escuro</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FormSection>

          <p className="mt-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            As cores dos gráficos não mudam com a marca: elas são validadas para daltonismo e contraste.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <FormSection title="Parâmetros operacionais" columns={2}>
            <Field label="Validade padrão do orçamento (dias)">
              <Input
                name="quote_validity_days"
                type="number"
                min={1}
                max={365}
                defaultValue={settings.quote_validity_days}
              />
            </Field>
            <Field label="Perda esperada de material (%)" hint="Usada como referência no dashboard de desperdício">
              <Input
                name="default_waste_pct"
                type="number"
                min={0}
                max={100}
                step="0.5"
                defaultValue={settings.default_waste_pct}
              />
            </Field>

            <Field
              label="Domínio de login"
              span="full"
              error={error('login_domain')}
              hint="Usado quando você cria um acesso por nome de usuário: joao.silva vira joao.silva@este-domínio. Esses endereços não recebem e-mail."
            >
              <Input
                name="login_domain"
                defaultValue={settings.login_domain ?? 'marmoraria.app'}
                className="font-mono lowercase"
                placeholder="marmoraria.app"
              />
            </Field>
          </FormSection>
        </CardContent>
      </Card>

      <FormActions sticky>
        <Button type="submit" loading={pending}>
          Salvar configurações
        </Button>
      </FormActions>
    </form>
  )
}

function ColorField({
  label,
  name,
  value,
  onChange,
  error,
}: {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  return (
    <Field label={label} error={error}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
          aria-label={`${label} — seletor`}
        />
        <Input
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono uppercase"
          maxLength={7}
        />
      </div>
    </Field>
  )
}
