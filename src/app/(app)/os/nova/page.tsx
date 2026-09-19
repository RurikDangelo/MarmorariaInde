import type { Metadata } from 'next'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { requirePermission } from '@/lib/auth/session'
import {
  getAssignableUsers,
  getCustomersList,
  getTeamsList,
  getWorkOrderStatuses,
} from '@/features/work-orders/queries'
import { WorkOrderForm } from '@/features/work-orders/components/work-order-form'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Users } from 'lucide-react'

export const metadata: Metadata = { title: 'Nova OS' }

export default async function NewWorkOrderPage() {
  await requirePermission('work_orders.write')

  const [customers, users, teams, statuses] = await Promise.all([
    getCustomersList(),
    getAssignableUsers(),
    getTeamsList(),
    getWorkOrderStatuses(),
  ])

  return (
    <PageContainer>
      <PageHeader
        title="Nova ordem de serviço"
        description="Depois de criar, adicione as peças, a medição e reserve o material."
        breadcrumb={[
          { label: 'Ordens de serviço', href: '/os' },
          { label: 'Nova OS' },
        ]}
      />

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Cadastre um cliente primeiro"
          description="A OS precisa estar vinculada a um cliente."
          action={
            <Button asChild>
              <Link href="/clientes?novo=1">Cadastrar cliente</Link>
            </Button>
          }
        />
      ) : (
        <WorkOrderForm mode="create" customers={customers} users={users} teams={teams} statuses={statuses} />
      )}
    </PageContainer>
  )
}
