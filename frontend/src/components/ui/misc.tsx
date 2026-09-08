import React, { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export function Kbd({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border bg-surface px-1 text-[11px] font-medium text-muted-foreground',
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className ?? 'w-4 h-4')}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}