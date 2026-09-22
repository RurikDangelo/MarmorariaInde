import type { Metadata } from 'next'
import { z } from 'zod'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { getCompanySettings, requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { getAssignableUsers, getTeamsList } from '@/features/work-orders/queries'
import { getCatalog } from '@/features/composition/queries'
import { WorkOrderEditor } from '@/features/work-orders/components/editor/work-order-editor'
import { workOrderEditorPermissions } from '@/features/work-orders/editor-data'
import type { Customer } from '@/types/database'

export const metadata: Metadata = { title: 'Nova OS' }

/**
 * Nova OS numa tela so: cliente (com cadastro na hora), ambientes, produtos,
 * materiais, pecas e m2, totais, fatura e RT. A OS e gravada na primeira acao.
 * ?cliente=<id> abre com o cliente escolhido (atalho da ficha do cliente).
 */
export default async function NewWorkOrderPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const user = await requirePermission('work_orders.write')
  const { cliente } = await searchParams
  const customerId = z.guid().safeParse(cliente).success ? cliente : null
  const supabase = await createClient()

  const [catalog, users, teams, settings, { data: customer }] = await Promise.all([
    getCatalog(),
    getAssignableUsers(),
    getTeamsList(),
    getCompanySettings(),
    customerId
      ? supabase.from('customers').select('*').eq('id', customerId).maybeSingle<Customer>()
      : Promise.resolve({ data: null }),
  ])

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Nova ordem de serviço"
        description="Tudo numa tela só: cliente, ambientes, produtos com m², totais e fatura. Depois é só emitir."
        breadcrumb={[{ label: 'Ordens de serviço', href: '/os' }, { label: 'Nova OS' }]}
      />
      <WorkOrderEditor
        workOrder={null}
        initialCustomer={customer}
        composition={{ environments: [], items: [] }}
        catalog={catalog}
        users={users}
        teams={teams}
        currentUserId={user.id}
        defaultWastePct={Number(settings?.default_waste_pct ?? 0)}
        permissions={workOrderEditorPermissions(user, null)}
        reserves={[]}
        receivables={[]}
      />
    </PageContainer>
  )
}
