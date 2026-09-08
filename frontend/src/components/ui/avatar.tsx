import React, { useMemo } from 'react';
import { cn } from '../../utils/cn';

const BG_STYLES = [
  'bg-primary/80',
  'bg-success/70',
  'bg-warning/70',
  'bg-secondary-foreground/60',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const initials = useMemo(
    () =>
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'U',
    [name]
  );

  const bg = useMemo(() => BG_STYLES[hashString(name) % BG_STYLES.length], [name]);

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none',
        size === 'sm' && 'h-5 w-5 text-[9px]',
        size === 'md' && 'h-7 w-7 text-[11px]',
        size === 'lg' && 'h-8 w-8 text-xs',
        bg,
        className
      )}
      title={name}
    >
      {initials}
    </span>
  );
}