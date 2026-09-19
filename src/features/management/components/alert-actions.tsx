'use client'

import * as React from 'react'
import { RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { dismissAlert, recalculateAlerts } from '@/features/management/actions'

export function AlertActions({ alertId }: { alertId: string }) {
  const [pending, startTransition] = React.useTransition()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Dispensar alerta"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await dismissAlert(alertId)
          if (result.error) toast.error(result.error)
          else toast.success(result.success ?? 'Alerta dispensado.')
        })
      }
    >
      <X />
    </Button>
  )
}

export function RefreshAlertsButton() {
  const [pending, startTransition] = React.useTransition()

  return (
    <Button
      variant="outline"
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await recalculateAlerts()
          if (result.error) toast.error(result.error)
          else toast.success(result.success ?? 'Alertas atualizados.')
        })
      }
    >
      <RefreshCw />
      Recalcular
    </Button>
  )
}
