import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const badgeVariants = cva(
  'inline-flex items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-4 select-none whitespace-nowrap transition-colors',
  {
    variants: {
      variant: {
        default: 'glass text-secondary-foreground',
        primary: 'border-primary/25 gradient-brand-soft text-primary shadow-glow-sm',
        outline: 'border-border text-muted-foreground',
        success: 'border-success/25 bg-success/10 text-success',
        warning: 'border-warning/25 bg-warning/10 text-warning',
        destructive: 'border-destructive/25 bg-destructive/10 text-destructive',
        muted: 'border-transparent bg-secondary text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: 'success' | 'warning' | 'destructive' | 'primary' | false;
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            dot === 'success' && 'bg-success',
            dot === 'warning' && 'bg-warning',
            dot === 'destructive' && 'bg-destructive',
            dot === 'primary' && 'bg-primary'
          )}
        />
      )}
      {children}
    </span>
  );
}

export { badgeVariants };