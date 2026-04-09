import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
    'inline-flex items-center justify-center whitespace-nowrap rounded-[var(--app-radius-pill)] text-sm font-medium transition-[background-color,color,border-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-link)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)] disabled:pointer-events-none disabled:opacity-50 active:translate-y-px',
    {
        variants: {
            variant: {
                default: 'border border-transparent bg-[var(--app-button)] text-[var(--app-button-text)] shadow-[var(--app-ring)] hover:brightness-[0.98]',
                secondary: 'border border-[var(--app-border)] bg-[var(--app-subtle-bg)] text-[var(--app-fg)] hover:bg-[var(--app-panel-muted-bg)]',
                outline: 'border border-[var(--app-border)] bg-[var(--app-panel-bg)] text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]',
                destructive: 'border border-transparent bg-[var(--app-badge-error-text)] text-white hover:opacity-90',
                inverted: 'border border-[var(--app-border)] bg-[var(--app-fg)] text-[var(--app-bg)] hover:opacity-90'
            },
            size: {
                default: 'h-10 px-4',
                sm: 'h-8 px-3 text-xs',
                lg: 'h-11 px-6'
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'default'
        }
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button'
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = 'Button'

