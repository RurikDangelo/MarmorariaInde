'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ActionResult } from '@/lib/action-result'

interface ConfirmDeleteDialogProps {
  trigger: React.ReactNode
  title: string
  description: string
  /** O que some junto, uma linha por item. */
  removes: string[]
  /** O usuario digita isto para liberar o botao (numero da OS/orcamento). */
  confirmText: string
  confirmLabel?: string
  onConfirm: (reason: string) => Promise<ActionResult>
  onDeleted?: () => void
}

/** Exclusão que não volta atrás: lista o que vai junto e pede o número digitado. */
export function ConfirmDeleteDialog({
  trigger,
  title,
  description,
  removes,
  confirmText,
  confirmLabel = 'Excluir',
  onConfirm,
  onDeleted,
}: ConfirmDeleteDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [typed, setTyped] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [pending, setPending] = React.useState(false)
  const matches = typed.trim().toLowerCase() === confirmText.trim().toLowerCase()

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setTyped('')
      setReason('')
    }
  }

  async function handleConfirm() {
    if (!matches || pending) return
    setPending(true)
    try {
      const result = await onConfirm(reason.trim())
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message ?? 'Excluído.')
      handleOpenChange(false)
      onDeleted?.()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex gap-2 rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="flex flex-col gap-1">
              <span className="font-medium text-destructive">Isto não tem como desfazer.</span>
              <ul className="flex list-inside list-disc flex-col gap-0.5 text-muted-foreground">
                {removes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delete-reason">Motivo (opcional, fica na auditoria)</Label>
            <Textarea
              id="delete-reason"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: lançamento duplicado"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delete-confirm" required>
              Digite <span className="font-semibold text-foreground">{confirmText}</span> para confirmar
            </Label>
            <Input
              id="delete-confirm"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              aria-invalid={typed.length > 0 && !matches}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Voltar
          </Button>
          <Button type="button" variant="destructive" disabled={!matches} loading={pending} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
