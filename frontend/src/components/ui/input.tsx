import React, { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

const baseInput =
  'w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-input disabled:opacity-50 disabled:cursor-not-allowed';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(baseInput, 'h-8', className)} {...props} />
  )
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(baseInput, 'py-2 min-h-[64px] leading-relaxed resize-y', className)} {...props} />
  )
);
Textarea.displayName = 'Textarea';

export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <Input ref={ref} className={cn('pl-8', className)} {...props} />
  )
);
SearchInput.displayName = 'SearchInput';