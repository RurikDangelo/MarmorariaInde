'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export function FormSection({
  title,
  description,
  children,
  className,
  columns = 2,
}: {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  columns?: 1 | 2 | 3 | 4
}) {
  return (
    <section className={cn('space-y-3', className)}>
      {(title || description) && (
        <div>
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      <div
        className={cn(
          'grid gap-4',
          columns === 1 && 'grid-cols-1',
          columns === 2 && 'grid-cols-1 sm:grid-cols-2',
          columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
          columns === 4 && 'grid-cols-2 lg:grid-cols-4',
        )}
      >
        {children}
      </div>
    </section>
  )
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
  span,
}: {
  label?: string
  htmlFor?: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: React.ReactNode
  span?: 'full' | 'half'
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', span === 'full' && 'sm:col-span-full', className)}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function FormActions({
  children,
  className,
  sticky = false,
}: {
  children: React.ReactNode
  className?: string
  sticky?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end',
        sticky && 'sticky bottom-0 -mx-4 bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SubmitButton({
  children = 'Salvar',
  pending,
  ...props
}: React.ComponentProps<typeof Button> & { pending?: boolean }) {
  return (
    <Button type="submit" loading={pending} {...props}>
      {children}
    </Button>
  )
}
