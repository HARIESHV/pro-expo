import React from 'react';
import { cn } from '../utils/cn';

type Tone = 'hero' | 'app' | 'auth' | 'subsection';

const BLOB_PRESETS: Record<Tone, { className: string; positions: Array<{ cls: string; anim: string }> }> = {
  // Strong aurora for the landing hero
  hero: {
    className: '',
    positions: [
      { cls: '-top-[20%] -left-[8%] h-[46vw] w-[46vw] min-h-[420px] min-w-[420px]', anim: 'animate-aurora-a' },
      { cls: 'top-[12%] -right-[14%] h-[42vw] w-[42vw] min-h-[400px] min-w-[400px]', anim: 'animate-aurora-b' },
      { cls: '-bottom-[30%] left-1/2 -translate-x-1/2 h-[52vw] w-[70vw] min-h-[380px]', anim: 'animate-aurora-c' },
    ],
  },
  // Calmer wash behind the workspace
  app: {
    className: '',
    positions: [
      { cls: '-top-[30%] left-[5%] h-[38vw] w-[38vw] min-h-[340px] min-w-[340px]', anim: 'animate-aurora-a' },
      { cls: 'top-[35%] -right-[18%] h-[34vw] w-[34vw] min-h-[300px] min-w-[300px]', anim: 'animate-aurora-b' },
      { cls: '-bottom-[40%] left-[-15%] h-[40vw] w-[40vw] min-h-[320px]', anim: 'animate-aurora-c' },
    ],
  },
  // Medium wash for auth
  auth: {
    className: '',
    positions: [
      { cls: '-top-[25%] left-[10%] h-[42vw] w-[42vw] min-h-[380px] min-w-[380px]', anim: 'animate-aurora-a' },
      { cls: '-bottom-[25%] -right-[10%] h-[42vw] w-[42vw] min-h-[380px]', anim: 'animate-aurora-b' },
    ],
  },
  // Faint wash for alternating content sections
  subsection: {
    className: '',
    positions: [
      { cls: 'top-[-40%] left-1/2 -translate-x-1/2 h-[50vw] w-[60vw] min-h-[360px]', anim: 'animate-aurora-a' },
    ],
  },
};

/**
 * Fixed, non-interactive layered ambient background: aurora color fields,
 * a fading grid, and a quietening vignette. Renders at z-index 0 so page
 * content paints above it. Works in both light and dark themes.
 */
export function AmbientBackground({ tone = 'app', className }: { tone?: Tone; className?: string }) {
  const preset = BLOB_PRESETS[tone];
  return (
    <div aria-hidden className={cn('pointer-events-none fixed inset-0 z-0 overflow-hidden', className)}>
      {/* Aurora color fields */}
      {preset.positions.map((p, i) => (
        <div key={i} className={cn('absolute rounded-full', p.cls, p.anim)}>
          <div
            className="h-full w-full"
            style={{
              background: `radial-gradient(circle at center, hsl(var(--glow-a) / 0.32) 0%, hsl(var(--glow-b) / 0.18) 40%, transparent 70%)`,
              filter: i === 1 ? 'hue-rotate(20deg)' : undefined,
            }}
          />
        </div>
      ))}

      {/* Fading grid */}
      <div
        className="ambient-grid absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,#000_0%,transparent_75%)]"
      />

      {/* Vignette to keep text readable */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, hsl(231 50% 4% / 0.28) 0%, transparent 22%), radial-gradient(ellipse 90% 60% at 50% 110%, hsl(231 50% 4% / 0.25), transparent 60%)',
        }}
      />
    </div>
  );
}