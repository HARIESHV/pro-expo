import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

const ICONS: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-success" />,
  error: <XCircle className="h-4 w-4 text-destructive" />,
  info: <Info className="h-4 w-4 text-primary" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const timer = timers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId++;
      setItems((list) => [...list.slice(-3), { id, kind, message }]);
      timers.current[id] = setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast: (message, kind = 'info') => push(message, kind),
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
      info: (message) => push(message, 'info'),
    }),
    [push]
  );

  useEffect(() => {
    const current = timers.current;
    return () => Object.values(current).forEach(clearTimeout);
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[70] flex w-full max-w-[360px] -translate-x-1/2 flex-col items-center gap-2 px-4">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border border-border bg-elevated px-3 py-2.5 shadow-pop animate-slide-in-right',
              item.kind === 'error' && 'border-destructive/30'
            )}
          >
            <div className="mt-0.5 shrink-0">{ICONS[item.kind]}</div>
            <p className="flex-1 text-[13px] leading-snug text-secondary-foreground">{item.message}</p>
            <button
              className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}