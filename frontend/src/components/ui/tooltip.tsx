import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../../utils/cn';

export const TooltipProvider = TooltipPrimitive.Provider;

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 5, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-[60] rounded-md border border-border bg-elevated px-2 py-1 text-[11px] font-medium text-secondary-foreground shadow-pop',
        'animate-zoom-in data-[state=closed]:animate-zoom-in',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = 'TooltipContent';