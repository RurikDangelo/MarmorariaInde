import Image from 'next/image'
import { getCompanySettings } from '@/lib/auth/session'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getCompanySettings().catch(() => null)
  const companyName = settings?.company_name ?? 'MARMORARIA INDEPENDENCIA'

  return (
    <div className="grid min-h-(--screen-h) lg:grid-cols-2">
      {/* Painel de marca - oculto no celular para nao empurrar o formulario */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-secondary p-10 lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(115deg, currentColor 0 1px, transparent 1px 9px), repeating-linear-gradient(65deg, currentColor 0 1px, transparent 1px 14px)',
          }}
        />
        <div className="relative flex items-center gap-3">
          {settings?.logo_url ? (
            <Image
              src={settings.logo_url}
              alt={companyName}
              width={44}
              height={44}
              className="size-11 rounded-md object-contain"
              unoptimized
            />
          ) : (
            <div className="flex size-11 items-center justify-center rounded-md bg-primary text-lg font-semibold text-primary-foreground">
              MI
            </div>
          )}
          <div>
            <p className="text-sm font-semibold leading-tight">{companyName}</p>
            <p className="text-xs text-muted-foreground">Sistema de gestão</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-2xl font-semibold leading-snug tracking-tight">
            Do orçamento à instalação, cada peça no lugar certo.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Ordem de serviço, medição, corte, acabamento, estoque de chapas e financeiro em um só
            lugar — com histórico de tudo que acontece.
          </p>
        </div>

        <p className="relative text-xs text-muted-foreground">
          {settings?.city ? `${settings.city} · ` : ''}
          Desde 2009
        </p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
