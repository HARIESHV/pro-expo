import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { showClose?: boolean }
>(({ className, children, showClose = true, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-in" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
        'rounded-3xl border border-border bg-card p-5 shadow-pop',
        'data-[state=open]:animate-zoom-in data-[state=closed]:animate-zoom-in',
        'max-h-[85vh] overflow-y-auto',
        className
      )}
      {...props}
    >
      {children}
      {showClose && (
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
          <X className="w-4 h-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('space-y-1 mb-4', className)} {...props} />
);
export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center justify-end gap-2 mt-5', className)} {...props} />
);
export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-sm font-semibold text-foreground', className)}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';
export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-xs text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';

export function Drawer({ open, onOpenChange, side = 'left', children, className }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  side?: 'left' | 'right';
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            'fixed top-0 bottom-0 z-50 w-[272px] bg-card border-border shadow-pop outline-none',
            side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
            'data-[state=open]:animate-slide-in-right',
            className
          )}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}