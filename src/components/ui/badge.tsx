import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/12 text-primary',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        success: 'border-transparent bg-success/14 text-success',
        warning: 'border-transparent bg-warning/18 text-warning',
        destructive: 'border-transparent bg-destructive/12 text-destructive',
        info: 'border-transparent bg-info/12 text-info',
        accent: 'border-transparent bg-accent/14 text-accent',
        muted: 'border-transparent bg-muted text-muted-foreground',
      },
      size: {
        default: 'px-2 py-0.5 text-xs',
        sm: 'px-1.5 py-0 text-[11px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Badge({
  className,
  variant,
  size,
  asChild,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props} />
}

export { Badge, badgeVariants }
