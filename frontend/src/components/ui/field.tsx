import React, { forwardRef, LabelHTMLAttributes, SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('block text-xs font-medium text-secondary-foreground mb-1.5', className)}
      {...props}
    />
  );
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'w-full h-8 rounded-lg border border-input bg-card pl-3 pr-8 text-sm text-foreground appearance-none transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-muted-foreground" />
    </div>
  )
);
Select.displayName = 'Select';

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-0', className)}>
      {label && <Label>{label}</Label>}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}