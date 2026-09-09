import React from 'react';
import {
  Activity,
  ShieldCheck,
  BrainCircuit,
  LayoutDashboard,
  Users,
  Zap,
} from 'lucide-react';
import { EnterpriseLoginVisual } from './EnterpriseLoginVisual';
import { EnterpriseSignupVisual } from './EnterpriseSignupVisual';

export type AuthMode = 'login' | 'register';

function BrandMark({ dark = false }: { dark?: boolean }) {
  void dark;
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff6b00] to-[#ff9500] shadow-[0_8px_24px_-8px_rgba(255,107,0,0.7)]">
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round">
          <path d="M15.3 8.4a5 5 0 1 0 0 7.2" />
        </svg>
      </div>
      <div className="leading-tight">
        <p className="text-[17px] font-bold tracking-[-0.02em] text-[#0b1220]">Enterprise</p>
        <p className="text-[17px] font-bold tracking-[-0.02em] text-[#0b1220]">Intelligence</p>
      </div>
    </div>
  );
}

const LOGIN_FEATURES = [
  { icon: Activity, title: 'Real-Time Analytics', desc: 'Get instant insights from your data.' },
  { icon: ShieldCheck, title: 'Secure & Reliable', desc: 'Your data, always protected.' },
  { icon: BrainCircuit, title: 'AI-Powered Insights', desc: 'Smarter decisions with AI.' },
];

const REGISTER_FEATURES = [
  { icon: LayoutDashboard, title: 'Access Powerful Dashboards', desc: 'Visualise your data in real-time.' },
  { icon: Users, title: 'Collaborate with Your Team', desc: 'Work together, achieve more.' },
  { icon: Zap, title: 'Get Started in Minutes', desc: 'Easy setup and onboarding.' },
];

export function AuthBrandPanel({ mode }: { mode: AuthMode }) {
  const isRegister = mode === 'register';

  return (
    <section className="relative hidden overflow-hidden md:flex md:w-[46%] md:flex-col lg:w-[55%]">
      {isRegister ? (
        <>
          {/* Very light blue background with soft blue shapes */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#e8f6ff] via-[#dff2ff] to-[#e6f7f6]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(14,165,233,0.18)_0%,transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(20,184,166,0.16)_0%,transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.08)_0%,transparent_55%)]" />
          <div
            className="absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(14,165,233,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.12) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
              maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 35%, transparent 75%)',
            }}
          />
          <div className="absolute left-[8%] top-[18%] h-40 w-40 rounded-full bg-[#38bdf8]/[0.14] blur-[70px]" />
          <div className="absolute bottom-[12%] right-[8%] h-44 w-44 rounded-full bg-[#2dd4bf]/[0.14] blur-[70px]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0ea5e9]/40 to-transparent" />
        </>
      ) : (
        <>
          {/* Soft orange and cream abstract gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#fff7ed] via-[#fffbeb] to-[#ffedd5]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,107,0,0.16)_0%,transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(251,146,60,0.14)_0%,transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(254,215,170,0.12)_0%,transparent_55%)]" />
          <div
            className="absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(234,88,12,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(234,88,12,0.1) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
              maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 35%, transparent 75%)',
            }}
          />
          <div className="absolute left-[8%] top-[18%] h-40 w-40 rounded-full bg-[#ff6b00]/[0.1] blur-[70px]" />
          <div className="absolute bottom-[12%] right-[8%] h-44 w-44 rounded-full bg-[#fdba74]/[0.16] blur-[70px]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ff6b00]/40 to-transparent" />
        </>
      )}

      <div className="relative z-10 flex h-full flex-col p-10">
        <BrandMark />

        <div className="mt-4 flex flex-1 flex-col items-center justify-center">
          <div className="flex w-full flex-1 items-center justify-center py-4">
            {isRegister ? (
              <div className="w-full max-w-[500px] px-2 md:px-4 lg:max-w-[540px]">
                <EnterpriseSignupVisual />
              </div>
            ) : (
              <EnterpriseLoginVisual />
            )}
          </div>

          {isRegister ? (
            <div className="mb-8 max-w-[500px] text-center">
              <h2 className="text-[clamp(1.4rem,2.2vw,2rem)] font-bold leading-snug tracking-[-0.02em] text-[#08264d]">
                Create Your Account
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-[#5b7a99]">
                Join Enterprise Intelligence and start exploring the power of data.
              </p>

              <div className="mt-6 grid w-full grid-cols-3 gap-3 text-left">
                {REGISTER_FEATURES.map((f, index) => (
                  <div
                    key={f.title}
                    className="rounded-xl border border-white/60 bg-white/70 p-3.5 shadow-[0_10px_24px_-12px_rgba(14,165,233,0.25)] backdrop-blur-sm transition-all hover:border-[#0ea5e9]/30 hover:bg-white/90"
                  >
                    <div
                      className={cnCircle(
                        index === 1
                          ? 'bg-gradient-to-br from-[#ff6b00] to-[#ff9500] shadow-[0_6px_16px_-6px_rgba(255,107,0,0.5)]'
                          : 'bg-gradient-to-br from-[#0ea5e9] to-[#38bdf8] shadow-[0_6px_16px_-6px_rgba(14,165,233,0.5)]',
                      )}
                    >
                      <f.icon className="h-4 w-4 text-white" />
                    </div>
                    <p className="mt-2.5 text-[12.5px] font-semibold leading-tight text-[#08264d]">{f.title}</p>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-[#64748b]">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-8 flex w-full max-w-[520px] flex-col items-center">
              <h2 className="text-[clamp(1.4rem,2.2vw,2rem)] text-center font-bold leading-snug tracking-[-0.02em] text-[#08264d]">
                Smarter Decisions,
                <br />
                Stronger Business.
              </h2>
              <p className="mt-2 text-center text-[14px] leading-relaxed text-[#5b7a99]">
                Powerful analytics and real-time insights to help you grow, optimize and lead.
              </p>

              <div className="mt-6 grid w-full grid-cols-3 gap-3">
                {LOGIN_FEATURES.map((f) => (
                  <div
                    key={f.title}
                    className="rounded-xl border border-white/70 bg-white/75 p-3.5 shadow-[0_10px_24px_-12px_rgba(255,107,0,0.22)] backdrop-blur-sm transition-all hover:border-[#ff6b00]/30 hover:bg-white/95"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff9500] shadow-[0_6px_16px_-6px_rgba(255,107,0,0.6)]">
                      <f.icon className="h-4 w-4 text-white" />
                    </div>
                    <p className="mt-2.5 text-[13px] font-semibold leading-tight text-[#08264d]">{f.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#64748b]">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function cnCircle(classes: string) {
  return `flex h-8 w-8 items-center justify-center rounded-full ${classes}`;
}

export function AuthLogo({ dark = false }: { dark?: boolean }) {
  void dark;
  return <div className="lg:hidden"><BrandMark /></div>;
}

export function BrandMarkLight() {
  return <BrandMark />;
}