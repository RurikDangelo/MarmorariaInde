'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { ActionResult } from '@/lib/action-result'
import type { DocumentKind, DocumentRef } from '../types'

/**
 * Estado da tela unica (OS ou orcamento): rascunho do cabecalho, criacao do
 * documento na primeira acao (sem trocar de tela), Salvar (F2) e aviso de
 * alteracoes nao salvas.
 */
export function useDocumentEditor<Draft>({
  kind,
  existingId,
  initialDraft,
  basePath,
  validate,
  persist,
}: {
  kind: DocumentKind
  existingId: string | null
  initialDraft: Draft
  /** /os ou /orcamentos */
  basePath: string
  /** Mensagem de erro se o rascunho nao pode ser gravado (ex.: sem cliente). */
  validate: (draft: Draft) => string | null
  persist: (draft: Draft, id: string | null) => Promise<ActionResult<{ id: string; number: string }>>
}) {
  const router = useRouter()
  const [draft, setDraft] = React.useState(initialDraft)
  const [saved, setSaved] = React.useState(initialDraft)
  const [doc, setDoc] = React.useState<DocumentRef | null>(existingId ? { kind, id: existingId } : null)
  const [showErrors, setShowErrors] = React.useState(false)
  const [saving, startSaving] = React.useTransition()
  const docRef = React.useRef<DocumentRef | null>(doc)
  const creating = React.useRef<Promise<DocumentRef | null> | null>(null)
  const createdHere = React.useRef(false)
  const dirty = React.useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved])

  const change = React.useCallback((patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch })), [])

  async function persistHeader(source: Draft = draft): Promise<DocumentRef | null> {
    const problem = validate(source)
    if (problem) {
      setShowErrors(true)
      toast.error(problem)
      return null
    }
    const snapshot = source
    const result = await persist(snapshot, docRef.current?.id ?? null)
    if (!result.ok) {
      toast.error(result.error)
      return null
    }
    if (!docRef.current) {
      docRef.current = { kind, id: result.data.id }
      createdHere.current = true
      setDoc(docRef.current)
    }
    setSaved(snapshot)
    toast.success(result.message)
    return docRef.current
  }

  /** Grava o documento se ainda nao existe. Varias acoes ao mesmo tempo criam um so. */
  function ensureDocument(): Promise<DocumentRef | null> {
    if (docRef.current) return Promise.resolve(docRef.current)
    creating.current ??= persistHeader().finally(() => {
      creating.current = null
    })
    return creating.current
  }

  /** Recarrega a tela; se o documento acabou de nascer, passa a usar o endereco dele. */
  function refresh() {
    if (createdHere.current && !existingId && docRef.current) router.replace(`${basePath}/${docRef.current.id}`)
    else router.refresh()
  }

  function save() {
    startSaving(async () => {
      if (await persistHeader()) refresh()
    })
  }

  // F2 salva o cabecalho quando nenhum dialogo esta aberto (no dialogo do produto, F2 grava o produto)
  const saveRef = React.useRef(save)
  React.useEffect(() => {
    saveRef.current = save
  })
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'F2' && !document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        event.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  React.useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  return {
    draft,
    change,
    doc,
    dirty: dirty || !doc,
    showErrors,
    saving,
    save,
    ensureDocument,
    refresh,
    /** Salva se preciso e devolve o documento (para imprimir/emitir). */
    persistIfNeeded: async () => (dirty || !docRef.current ? persistHeader() : docRef.current),
    missingForCreate: () => {
      if (docRef.current) return null
      const problem = validate(draft)
      if (problem) setShowErrors(true)
      return problem
    },
    /** Aplica uma mudanca no cabecalho e ja grava (ex.: especie e forma de pagamento da fatura). */
    saveWith: async (patch: Partial<Draft>) => {
      const next = { ...draft, ...patch }
      setDraft(next)
      return persistHeader(next)
    },
  }
}
