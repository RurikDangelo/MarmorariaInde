'use client'

import * as React from 'react'
import { useActionForm } from '@/lib/hooks/use-action-form'
import { MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { addWorkOrderNote } from '@/features/work-orders/actions'

export function NoteForm({ workOrderId }: { workOrderId: string }) {
  const [, formAction, pending] = useActionForm(addWorkOrderNote, { onSuccess: () => formRef.current?.reset() })
  const formRef = React.useRef<HTMLFormElement>(null)

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 rounded-lg border p-3">
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <input type="hidden" name="title" value="Observação" />
      <Textarea
        name="description"
        rows={2}
        required
        placeholder="Registrar uma observação na timeline desta OS…"
        className="resize-none"
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={pending}>
          <MessageSquarePlus />
          Registrar
        </Button>
      </div>
    </form>
  )
}
