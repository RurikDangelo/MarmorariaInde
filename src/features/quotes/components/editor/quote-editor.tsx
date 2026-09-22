'use client'

import * as React from 'react'
import { Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CompositionSection } from '@/features/composition/components/composition-section'
import { DocumentProvider, useLiveCatalog } from '@/features/composition/components/document-context'
import { DocumentTotals } from '@/features/composition/components/document-totals'
import { EditorActionBar } from '@/features/composition/components/editor-action-bar'
import { InstallmentsEditor } from '@/features/composition/components/installments-editor'
import { MaterialsSummary } from '@/features/composition/components/materials-summary'
import { TechnicalReservesPanel } from '@/features/composition/components/technical-reserves-panel'
import { useDocumentEditor } from '@/features/composition/components/use-document-editor'
import { sumInstallments } from '@/features/composition/installments'
import { saveQuoteHeader, saveQuoteInstallments } from '@/features/quotes/actions'
import type { Catalog, Composition } from '@/features/composition/types'
import type { EditorPermissions } from '@/features/work-orders/components/editor/work-order-editor'
import type { PersonOption } from '@/features/work-orders/components/editor/work-order-header'
import type { Quote, QuoteAttachment, QuoteInstallment, TechnicalReserve } from '@/types/database'
import { QuoteApproveDialog } from './quote-approve-dialog'
import { QuoteFiles } from './quote-files'
import { QuoteHeader } from './quote-header'
import { headerFromQuote, quoteHeaderToInput } from './quote-header-draft'

/** O orcamento inteiro numa tela so (mesma montagem da OS). Aprovado, vira OS com tudo. */
export function QuoteEditor({
  quote,
  composition,
  catalog: initialCatalog,
  users,
  currentUserId,
  defaultWastePct,
  validityDays,
  permissions,
  canApprove,
  installments,
  reserves,
  attachments,
}: {
  quote: Quote | null
  composition: Composition
  catalog: Catalog
  users: PersonOption[]
  currentUserId: string
  defaultWastePct: number
  validityDays: number
  permissions: EditorPermissions
  canApprove: boolean
  installments: QuoteInstallment[]
  reserves: TechnicalReserve[]
  attachments: QuoteAttachment[]
}) {
  const live = useLiveCatalog(initialCatalog)
  const editor = useDocumentEditor({
    kind: 'quote',
    existingId: quote?.id ?? null,
    initialDraft: headerFromQuote(quote, { sellerId: currentUserId, validityDays }),
    basePath: '/orcamentos',
    validate: (draft) => (draft.customer ? null : 'Escolha o cliente do orçamento.'),
    persist: (draft, id) => saveQuoteHeader(quoteHeaderToInput(draft, id)),
  })
  const { draft, change } = editor
  const [printing, startPrinting] = React.useTransition()
  const productsTotal = Number(quote?.subtotal ?? 0)
  const total = Math.round((productsTotal + draft.freight + draft.surcharge - draft.discount) * 100) / 100
  const closed = quote?.status === 'APROVADO' || quote?.status === 'CANCELADO' || quote?.status === 'RECUSADO'

  function print() {
    const popup = window.open('', '_blank')
    startPrinting(async () => {
      const doc = await editor.persistIfNeeded()
      if (!doc) {
        popup?.close()
        return
      }
      const url = `/orcamentos/${doc.id}/imprimir`
      if (popup) popup.location.href = url
      else window.open(url, '_blank')
      if (!quote) editor.refresh()
    })
  }

  return (
    <DocumentProvider
      value={{
        kind: 'quote',
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
        <EditorActionBar isNew={!editor.doc} dirty={editor.dirty} saving={editor.saving} canEdit={permissions.canEdit} onSave={editor.save}>
          <Button type="button" variant="secondary" size="sm" onClick={print} loading={printing}>
            <Printer />
            Imprimir
          </Button>
          {canApprove && editor.doc && !closed && (
            <QuoteApproveDialog
              defaultDeadline={draft.delivery_date}
              installmentsCount={installments.length}
              installmentsTotal={sumInstallments(installments.map((row) => ({ amount: Number(row.amount) })))}
              total={total}
              canFinancial={permissions.canFinancial}
              beforeApprove={editor.persistIfNeeded}
            />
          )}
        </EditorActionBar>

        <QuoteHeader
          draft={draft}
          onChange={change}
          users={users}
          number={quote?.number ?? null}
          canCreateCustomer={permissions.canCreateCustomer}
          showErrors={editor.showErrors}
        />

        <CompositionSection items={composition.items} />

        <DocumentTotals
          productsTotal={productsTotal}
          values={{ freight: draft.freight, surcharge: draft.surcharge, discount: draft.discount }}
          onChange={change}
          readOnly={!permissions.canEdit}
          totalLabel="Total do Orçamento"
          dirty={editor.dirty && Boolean(editor.doc)}
        />

        <Card>
          <CardContent className="pt-5">
            <Tabs defaultValue="materiais">
              <TabsList>
                <TabsTrigger value="materiais">Total de Materiais</TabsTrigger>
                <TabsTrigger value="fatura">Fatura</TabsTrigger>
                <TabsTrigger value="rt">RT&apos;s</TabsTrigger>
                <TabsTrigger value="arquivos">Arquivos Anexos</TabsTrigger>
              </TabsList>
              <TabsContent value="materiais">
                <MaterialsSummary items={composition.items} />
              </TabsContent>
              <TabsContent value="fatura">
                <InstallmentsEditor
                  total={total}
                  initialRows={installments.map((row) => ({
                    due_date: row.due_date,
                    amount: Number(row.amount),
                    payment_method: row.payment_method,
                    notes: row.notes ?? '',
                  }))}
                  paymentMethod={draft.payment_method}
                  paymentTerms={draft.payment_terms}
                  readOnly={!permissions.canEdit}
                  saveLabel="Salvar fatura"
                  onSave={async (rows, payment) => {
                    // especie e forma de pagamento sao do cabecalho: grava junto
                    const doc = await editor.saveWith(payment)
                    if (!doc) return false
                    const result = await saveQuoteInstallments(doc.id, rows)
                    if (!result.ok) {
                      toast.error(result.error)
                      return false
                    }
                    toast.success(result.message)
                    editor.refresh()
                    return true
                  }}
                />
              </TabsContent>
              <TabsContent value="rt">
                <TechnicalReservesPanel reserves={reserves} documentTotal={total} canLaunch={false} />
              </TabsContent>
              <TabsContent value="arquivos">
                <QuoteFiles attachments={attachments} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DocumentProvider>
  )
}
