'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

function Toaster(props: ToasterProps) {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'group border-border bg-card text-card-foreground shadow-lg',
          description: 'text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
