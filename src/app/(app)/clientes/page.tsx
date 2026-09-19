import type { Metadata } from 'next'
import Link from 'next/link'
import { MessageCircle, Phone } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import { ClearFiltersButton, FilterBar, SearchInput } from '@/components/shared/filters'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { whatsappLink } from '@/lib/utils'
import { CustomerDialog } from '@/features/customers/components/customer-dialog'
import type { Customer } from '@/types/database'

export const metadata: Metadata = { title: 'Clientes' }

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; novo?: string }>
}) {
  const user = await requirePermission('customers.read')
  const { busca, novo } = await searchParams
  const canWrite = user.permissions.has('customers.write')

  const supabase = await createClient()
  let query = supabase.from('customers').select('*', { count: 'exact' })
  if (busca) {
    const term = busca.replace(/[%,()]/g, '')
    query = query.or(`name.ilike.%${term}%,document.ilike.%${term}%,phone.ilike.%${term}%`)
  }

  const { data, count } = await query.order('name').limit(100).returns<Customer[]>()
  const rows = data ?? []

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Cliente',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">
            {row.person_type === 'PJ' ? 'PJ' : 'PF'}
            {row.document ? ` · ${row.document}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contato',
      render: (row) => (
        <div className="flex flex-col gap-0.5 text-sm">
          {row.phone && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="size-3.5" />
              {row.phone}
            </span>
          )}
          {row.whatsapp && whatsappLink(row.whatsapp) && (
            <a
              href={whatsappLink(row.whatsapp)!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-success hover:underline"
            >
              <MessageCircle className="size-3.5" />
              WhatsApp
            </a>
          )}
        </div>
      ),
    },
    {
      key: 'city',
      header: 'Cidade',
      secondary: true,
      render: (row) => <span className="text-sm">{[row.city, row.state].filter(Boolean).join(' · ') || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Situação',
      render: (row) => (
        <div className="flex gap-1.5">
          {!row.active && <Badge variant="muted">Inativo</Badge>}
          {row.is_demo && <Badge variant="warning">DEMO</Badge>}
          {row.active && !row.is_demo && <Badge variant="success">Ativo</Badge>}
        </div>
      ),
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Clientes"
        description="Cadastro operacional: quem contrata, onde instalar e como falar."
        actions={canWrite ? <CustomerDialog openByDefault={novo === '1'} /> : undefined}
      />

      <FilterBar>
        <SearchInput placeholder="Buscar por nome, documento ou telefone…" />
        <ClearFiltersButton keys={['busca']} />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/clientes/${row.id}`}
        emptyTitle="Nenhum cliente encontrado"
        emptyDescription={busca ? 'Tente outro termo de busca.' : 'Cadastre o primeiro cliente.'}
        footer={`${count ?? rows.length} cliente(s)`}
        mobileCard={(row) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{row.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.phone ?? row.whatsapp ?? 'sem telefone'}
                  {row.city ? ` · ${row.city}` : ''}
                </p>
              </div>
              {!row.active && <Badge variant="muted">Inativo</Badge>}
            </div>
          </div>
        )}
      />

      {rows.length === 100 && (
        <p className="text-center text-xs text-muted-foreground">
          Mostrando os 100 primeiros. Use a busca para refinar.{' '}
          <Link href="/relatorios" className="underline">
            Relatórios
          </Link>{' '}
          trazem a lista completa.
        </p>
      )}
    </PageContainer>
  )
}
