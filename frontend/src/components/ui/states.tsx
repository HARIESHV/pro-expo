import React, { ReactNode } from 'react';
import { Loader2, Search } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Spinner } from './misc';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-[220px] flex-col items-center justify-center gap-2 text-center', className)}>
      {icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="max-w-[320px] text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function SearchEmptyState({ query }: { query: string }) {
  return (
    <EmptyState
      icon={<Search className="h-4 w-4" />}
      title={query ? `No results for “${query}”` : 'Search the workspace'}
      description={
        query
          ? 'Try different keywords, or include a document filename.'
          : 'Ask anything across your documents, chat history, and knowledge graph.'
      }
    />
  );
}

export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 min-h-[220px]', className)}>
      <Spinner className="h-5 w-5 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} />;
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex h-[60vh] min-h-[320px] flex-col items-center justify-center gap-3">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl" />
        <Loader2 className="relative h-6 w-6 animate-spin text-primary" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}