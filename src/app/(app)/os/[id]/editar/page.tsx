import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { requirePermission } from '@/lib/auth/session'
import {
  getAssignableUsers,
  getCustomersList,
  getTeamsList,
  getWorkOrder,
  getWorkOrderStatuses,
} from '@/features/work-orders/queries'
import { WorkOrderForm } from '@/features/work-orders/components/work-order-form'

export const metadata: Metadata = { title: 'Editar OS' }

export default async function EditWorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requirePermission('work_orders.write')

  const [workOrder, customers, users, teams, statuses] = await Promise.all([
    getWorkOrder(id),
    getCustomersList(),
    getAssignableUsers(),
    getTeamsList(),
    getWorkOrderStatuses(),
  ])

  if (!workOrder) notFound()

  return (
    <PageContainer>
      <PageHeader
        title={`Editar ${workOrder.number}`}
        breadcrumb={[
          { label: 'Ordens de serviço', href: '/os' },
          { label: workOrder.number, href: `/os/${workOrder.id}` },
          { label: 'Editar' },
        ]}
      />
      <WorkOrderForm
        mode="edit"
        workOrder={workOrder}
        customers={customers}
        users={users}
        teams={teams}
        statuses={statuses}
      />
    </PageContainer>
  )
}
