import type { Metadata } from 'next'
import { PageContainer, PageHeader } from '@/components/shared/page-header'
import { getCompanySettings, requirePermission } from '@/lib/auth/session'
import { getAssignableUsers } from '@/features/work-orders/queries'
import { getCatalog } from '@/features/composition/queries'
import { QuoteEditor } from '@/features/quotes/components/editor/quote-editor'
import { quoteEditorPermissions } from '@/features/quotes/editor-data'

export const metadata: Metadata = { title: 'Novo orçamento' }

/** Orcamento numa tela so; e gravado na primeira acao (salvar, ambiente ou produto). */
export default async function NewQuotePage() {
  const user = await requirePermission('quotes.write')
  const [catalog, users, settings] = await Promise.all([getCatalog(), getAssignableUsers(), getCompanySettings()])

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Novo orçamento"
        description="Cliente, ambientes, produtos com m², totais e fatura na mesma tela. Aprovado, vira OS com tudo."
        breadcrumb={[{ label: 'Orçamentos', href: '/orcamentos' }, { label: 'Novo' }]}
      />
      <QuoteEditor
        quote={null}
        composition={{ environments: [], items: [] }}
        catalog={catalog}
        users={users}
        currentUserId={user.id}
        defaultWastePct={Number(settings?.default_waste_pct ?? 0)}
        validityDays={settings?.quote_validity_days ?? 15}
        permissions={quoteEditorPermissions(user, null)}
        canApprove={user.permissions.has('quotes.approve')}
        installments={[]}
        reserves={[]}
        attachments={[]}
      />
    </PageContainer>
  )
}
