import React from 'react';
import { Network } from 'lucide-react';
import { cn } from '../utils/cn';

export function BrandIcon({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg gradient-brand shadow-glow-sm',
        className
      )}
      aria-hidden
    >
      <Network className="h-3.5 w-3.5 text-white" />
    </div>
  );
}

interface BrandLockupProps {
  /** Render the full two-line "Enterprise / Intelligence Platform" lockup (default). */
  variant?: 'full' | 'compact';
  className?: string;
}

/**
 * Primary brand lockup: "Enterprise Intelligence Platform".
 * `compact` renders the EIP monogram for narrow/collapsed contexts.
 */
export function BrandLockup({ variant = 'full', className }: BrandLockupProps) {
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <BrandIcon className="h-7 w-7 rounded-lg" />
      </div>
    );
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <BrandIcon className="h-7 w-7 rounded-lg" />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[13px] font-semibold tracking-tight text-sidebar-text-strong">
          Enterprise
        </span>
        <span className="truncate text-[13px] font-semibold tracking-tight text-sidebar-text-strong">
          Intelligence Platform
        </span>
      </div>
    </div>
  );
}

/** Short monogram for narrow mobile contexts, with accessible label. */
export function BindEIPMonogram({ className, label }: { className?: string; label?: string }) {
  return (
    <div
      className={cn('flex items-center justify-center', className)}
      role="img"
      aria-label={label ?? 'Enterprise Intelligence Platform'}
      title={label ?? 'Enterprise Intelligence Platform'}
    >
      <BrandIcon className="h-8 w-8 rounded-lg" />
    </div>
  );
}
