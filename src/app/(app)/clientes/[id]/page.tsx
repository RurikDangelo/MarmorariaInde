import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, MessageCircle, Phone, Plus } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, whatsappLink } from '@/lib/utils'
import { CustomerDialog } from '@/features/customers/components/customer-dialog'
import type { Customer, WorkOrder } from '@/types/database'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('customers').select('name').eq('id', id).maybeSingle<{ name: string }>()
  return { title: data?.name ?? 'Cliente' }
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requirePermission('customers.read')
  const supabase = await createClient()

  const [{ data: customer }, { data: orders }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).maybeSingle<Customer>(),
    user.permissions.has('work_orders.read')
      ? supabase
          .from('work_orders')
          .select(
            `id, number, title, status_code, total_value, received_value, pending_value, deadline, created_at, finished_at,
             status:work_order_statuses!work_orders_status_code_fkey ( code, label, color )`,
          )
          .eq('customer_id', id)
          .order('created_at', { ascending: false })
          .returns<WorkOrder[]>()
      : Promise.resolve({ data: [] as WorkOrder[] }),
  ])

  if (!customer) notFound()

  const list = orders ?? []
  const totalBilled = list.reduce((sum, order) => sum + Number(order.total_value ?? 0), 0)
  const totalPending = list.reduce((sum, order) => sum + Number(order.pending_value ?? 0), 0)
  const whatsapp = whatsappLink(customer.whatsapp ?? customer.phone)

  return (
    <PageContainer>
      <PageHeader
        title={customer.name}
        description={[customer.document, customer.email].filter(Boolean).join(' · ') || undefined}
        breadcrumb={[{ label: 'Clientes', href: '/clientes' }, { label: customer.name }]}
        badge={
          <div className="flex gap-1.5">
            <Badge variant="secondary">{customer.person_type === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'}</Badge>
            {!customer.active && <Badge variant="muted">Inativo</Badge>}
            {customer.is_demo && <Badge variant="warning">DEMO</Badge>}
          </div>
        }
        actions={
          <>
            {user.permissions.has('customers.write') && (
              <CustomerDialog customer={customer} trigger={<Button variant="outline">Editar</Button>} />
            )}
            {user.permissions.has('work_orders.write') && (
              <Button asChild>
                <Link href="/os/nova">
                  <Plus />
                  Nova OS
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Ordens de serviço" value={list.length} />
        <MetricCard label="Total contratado" value={formatCurrency(totalBilled)} />
        <MetricCard
          label="Em aberto"
          value={formatCurrency(totalPending)}
          tone={totalPending > 0 ? 'warning' : 'success'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Contato</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {customer.phone && (
              <p className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" />
                {customer.phone}
              </p>
            )}
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-success hover:underline"
              >
                <MessageCircle className="size-4" />
                Abrir WhatsApp
              </a>
            )}
            {customer.address && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  {customer.address}
                  {customer.address_number ? `, ${customer.address_number}` : ''}
                  <br />
                  <span className="text-muted-foreground">
                    {[customer.district, customer.city, customer.state].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </p>
            )}
            {customer.notes && (
              <p className="mt-1 rounded-md bg-secondary/50 px-3 py-2 text-sm">{customer.notes}</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Histórico de ordens de serviço</CardTitle>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Este cliente ainda não tem ordens de serviço.
              </p>
            ) : (
              <ul className="divide-y">
                {list.map((order) => (
                  <li key={order.id}>
                    <Link href={`/os/${order.id}`} className="flex items-center gap-3 py-2.5 hover:bg-secondary/40">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{order.number}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {order.title ?? 'Sem descrição'} · criada {formatDate(order.created_at)}
                        </p>
                      </div>
                      <StatusBadge label={order.status?.label ?? order.status_code} color={order.status?.color} />
                      <span className="w-24 text-right text-sm tabular">{formatCurrency(order.total_value)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
