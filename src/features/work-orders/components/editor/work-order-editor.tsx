'use client'

import * as React from 'react'
import { Printer, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CompositionSection } from '@/features/composition/components/composition-section'
import { DocumentProvider, useLiveCatalog } from '@/features/composition/components/document-context'
import { DocumentTotals } from '@/features/composition/components/document-totals'
import { EditorActionBar } from '@/features/composition/components/editor-action-bar'
import { MaterialsSummary } from '@/features/composition/components/materials-summary'
import { TechnicalReservesPanel } from '@/features/composition/components/technical-reserves-panel'
import { useDocumentEditor } from '@/features/composition/components/use-document-editor'
import { saveWorkOrderHeader } from '@/features/work-orders/header-actions'
import type { Catalog, Composition } from '@/features/composition/types'
import type { CustomerSummary } from '@/features/customers/components/customer-picker'
import type { FinancialTransaction, TechnicalReserve, WorkOrder } from '@/types/database'
import { headerFromWorkOrder, headerToInput } from './header-draft'
import { WorkOrderBilling } from './work-order-billing'
import { WorkOrderHeader, type PersonOption } from './work-order-header'

export interface EditorPermissions {
  canEdit: boolean
  canManageCatalog: boolean
  canAddToLists: boolean
  canCreateCustomer: boolean
  canFinancial: boolean
}

/**
 * A OS inteira numa tela so, como no sistema antigo: cliente, dados da obra,
 * ambientes, produtos com materiais/pecas/m2, totais, fatura e RT.
 * Na Nova OS o documento nasce na primeira gravacao, sem trocar de tela.
 */
export function WorkOrderEditor({
  workOrder,
  composition,
  catalog: initialCatalog,
  users,
  teams,
  currentUserId,
  defaultWastePct,
  permissions,
  reserves,
  receivables,
  initialCustomer = null,
}: {
  workOrder: WorkOrder | null
  /** Nova OS aberta a partir de um cliente. */
  initialCustomer?: CustomerSummary | null
  composition: Composition
  catalog: Catalog
  users: PersonOption[]
  teams: { id: string; name: string }[]
  currentUserId: string
  defaultWastePct: number
  permissions: EditorPermissions
  reserves: TechnicalReserve[]
  receivables: FinancialTransaction[]
}) {
  const live = useLiveCatalog(initialCatalog)
  const editor = useDocumentEditor({
    kind: 'work_order',
    existingId: workOrder?.id ?? null,
    initialDraft: headerFromWorkOrder(workOrder, currentUserId, initialCustomer),
    basePath: '/os',
    validate: (draft) => (draft.customer ? null : 'Escolha o cliente da OS.'),
    persist: (draft, id) => saveWorkOrderHeader(headerToInput(draft, id)),
  })
  const { draft, change } = editor
  const [emitting, startEmitting] = React.useTransition()
  const productsTotal = Number(workOrder?.products_total ?? 0)
  const total = Math.round((productsTotal + draft.freight + draft.surcharge - draft.discount) * 100) / 100

  function open(path: string) {
    // a janela abre no clique (senao o navegador bloqueia) e recebe o endereco depois de salvar
    const popup = window.open('', '_blank')
    startEmitting(async () => {
      const doc = await editor.persistIfNeeded()
      if (!doc) {
        popup?.close()
        return
      }
      const url = `/os/${doc.id}/${path}`
      if (popup) popup.location.href = url
      else window.open(url, '_blank')
      if (!workOrder) editor.refresh()
    })
  }

  return (
    <DocumentProvider
      value={{
        kind: 'work_order',
        doc: editor.doc,
        ensureDocument: editor.ensureDocument,
        missingForCreate: editor.missingForCreate,
        refresh: editor.refresh,
        canEdit: permissions.canEdit,
        canManageCatalog: permissions.canManageCatalog,
        canAddToLists: permissions.canAddToLists,
        ...live,
        environments: composition.environments,
        defaultWastePct,
      }}
    >
      <div className="flex flex-col gap-4">
        <EditorActionBar
          isNew={!editor.doc}
          dirty={editor.dirty}
          saving={editor.saving}
          canEdit={permissions.canEdit}
          onSave={editor.save}
        >
          <Button type="button" variant="outline" size="sm" onClick={() => open('etiquetas')} disabled={emitting}>
            <Tags />
            Etiquetas
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => open('imprimir')} loading={emitting}>
            <Printer />
            Emitir OS
          </Button>
        </EditorActionBar>

        <WorkOrderHeader
          draft={draft}
          onChange={change}
          users={users}
          teams={teams}
          number={workOrder?.number ?? null}
          createdAt={workOrder?.created_at ?? null}
          canCreateCustomer={permissions.canCreateCustomer}
          showErrors={editor.showErrors}
        />

        <CompositionSection items={composition.items} />

        <DocumentTotals
          productsTotal={productsTotal}
          values={{ freight: draft.freight, surcharge: draft.surcharge, discount: draft.discount }}
          onChange={change}
          readOnly={!permissions.canEdit}
          totalLabel="Total da OS"
          dirty={editor.dirty && Boolean(editor.doc)}
        />

        <Card>
          <CardContent className="pt-5">
            <Tabs defaultValue="materiais">
              <TabsList>
                <TabsTrigger value="materiais">Total de Materiais</TabsTrigger>
                <TabsTrigger value="fatura">Fatura</TabsTrigger>
                <TabsTrigger value="rt">RT&apos;s</TabsTrigger>
              </TabsList>
              <TabsContent value="materiais">
                <MaterialsSummary items={composition.items} />
              </TabsContent>
              <TabsContent value="fatura">
                <WorkOrderBilling
                  total={total}
                  receivables={receivables}
                  canFinancial={permissions.canFinancial}
                  paymentMethod={draft.payment_method}
                  paymentTerms={draft.payment_terms}
                />
              </TabsContent>
              <TabsContent value="rt">
                <TechnicalReservesPanel reserves={reserves} documentTotal={total} canLaunch={permissions.canFinancial} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DocumentProvider>
  )
}
