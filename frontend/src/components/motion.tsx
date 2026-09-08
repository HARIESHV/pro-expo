import React, { createElement, CSSProperties, ElementType, HTMLAttributes, useEffect, useRef, useState } from 'react';
import { cn } from '../utils/cn';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

interface RevealProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  delay?: number;
  children?: React.ReactNode;
}

/**
 * Reveals its children once they scroll into view.
 * Falls back to always-visible for reduced-motion users.
 */
export function Reveal({ as = 'div', delay = 0, className, children, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const style = { '--reveal-delay': `${delay}ms` } as CSSProperties;

  return createElement(
    as,
    { ref, className: cn('reveal', visible && 'is-visible', className), style, ...rest },
    children
  );
}

interface CountUpProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

/**
 * Animates a number from 0 to `value` when it scrolls into view.
 * Renders the final value immediately for reduced-motion users.
 */
export function CountUp({ value, duration = 900, format, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setDisplay(value);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started.current) {
            started.current = true;
            io.disconnect();
            const start = performance.now();
            const tick = (now: number) => {
              const p = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - p, 3);
              setDisplay(value * eased);
              if (p < 1) requestAnimationFrame(tick);
              else setDisplay(value);
            };
            requestAnimationFrame(tick);
          }
        });
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className={cn('tabular', className)}>
      {format ? format(display) : Math.round(display).toLocaleString()}
    </span>
  );
}