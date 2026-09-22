import type { CompanySettings, Customer } from '@/types/database'

/** Cabecalho da folha: logo e dados da marmoraria, titulo do documento e o cliente. */
export function PrintHeader({
  settings,
  title,
  subtitle,
  customer,
  siteDetails,
}: {
  settings: CompanySettings | null
  title: string
  subtitle?: string
  customer: Customer | null | undefined
  siteDetails?: string | null
}) {
  const companyName = settings?.company_name ?? 'Marmoraria Independência'
  const phones = [settings?.phone, settings?.whatsapp].filter(Boolean).join('  ')
  const address = [settings?.address, [settings?.city, settings?.state].filter(Boolean).join(' - ')].filter(Boolean).join(' · ')
  const customerAddress = [
    customer?.address,
    customer?.address_number,
    customer?.complement,
    customer?.district,
    [customer?.city, customer?.state].filter(Boolean).join('/'),
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <>
      <header className="flex items-center justify-between gap-6 border-b-2 border-black pb-3">
        <div className="flex min-h-16 min-w-0 flex-1 items-center">
          {settings?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo_url} alt={companyName} className="max-h-20 max-w-[85mm] object-contain" />
          ) : (
            <p className="text-2xl font-black uppercase leading-tight tracking-tight">{companyName}</p>
          )}
        </div>
        <div className="text-right text-[11px] leading-snug">
          <p className="text-sm font-bold uppercase">{companyName}</p>
          {address && <p>{address}</p>}
          {phones && <p>{phones}</p>}
          {settings?.email && <p>{settings.email}</p>}
          {settings?.document && <p>CNPJ: {settings.document}</p>}
        </div>
      </header>

      <div className="border-b border-black py-1.5 text-center">
        <p className="text-sm font-bold">{title}</p>
        {subtitle && <p className="text-[11px]">{subtitle}</p>}
      </div>

      <section className="grid grid-cols-2 gap-x-6 gap-y-0.5 border-b border-black py-2 text-[11px]">
        <p className="col-span-2 text-sm">
          <span className="font-semibold">Cliente: </span>
          {customer?.name ?? '—'}
        </p>
        <p>
          <span className="font-semibold">Endereço: </span>
          {customerAddress || '—'}
        </p>
        <p>
          <span className="font-semibold">CPF / CNPJ: </span>
          {customer?.document || '—'}
        </p>
        <p>
          <span className="font-semibold">Telefones: </span>
          {[customer?.phone, customer?.whatsapp].filter(Boolean).join(' · ') || '—'}
        </p>
        <p>
          <span className="font-semibold">E-mail: </span>
          {customer?.email || '—'}
        </p>
        {siteDetails && (
          <p className="col-span-2 whitespace-pre-line">
            <span className="font-semibold">Dados da obra: </span>
            {siteDetails}
          </p>
        )}
      </section>
    </>
  )
}
