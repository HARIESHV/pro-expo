import React from 'react';

export function EnterpriseSignupVisual() {
  return (
    <div className="relative h-full w-full" aria-hidden="true">
      <svg
        viewBox="0 0 640 520"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 h-auto w-full max-w-[580px]"
      >
        <defs>
          <filter id="s-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="s-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="s-shadow" x="-20%" y="-10%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="12" floodColor="#0369a1" floodOpacity="0.12" />
          </filter>
          <filter id="s-card-shadow" x="-15%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="8" stdDeviation="16" floodColor="#0369a1" floodOpacity="0.15" />
          </filter>

          <linearGradient id="s-blue-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <linearGradient id="s-teal-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>
          <linearGradient id="s-indigo-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
          <linearGradient id="s-cyan-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <linearGradient id="s-line-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0" />
            <stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="s-line-grad-v" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0" />
            <stop offset="50%" stopColor="#14b8a6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="s-card-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.85)" />
          </linearGradient>
          <linearGradient id="s-screen-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f0f9ff" />
            <stop offset="100%" stopColor="#e0f2fe" />
          </linearGradient>
          <linearGradient id="s-chart-blue" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <linearGradient id="s-chart-teal" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>
          <linearGradient id="s-chart-indigo" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>

          <clipPath id="s-screen-clip">
            <rect x="175" y="145" width="290" height="195" rx="6" />
          </clipPath>
        </defs>

        {/* === NETWORK CONNECTION LINES === */}
        <g opacity="0.25">
          <line x1="320" y1="105" x2="160" y2="210" stroke="url(#s-line-grad)" strokeWidth="1" />
          <line x1="320" y1="105" x2="480" y2="195" stroke="url(#s-line-grad)" strokeWidth="1" />
          <line x1="320" y1="105" x2="540" y2="135" stroke="url(#s-line-grad)" strokeWidth="1" />
          <line x1="320" y1="105" x2="110" y2="145" stroke="url(#s-line-grad-v)" strokeWidth="1" />
          <line x1="320" y1="105" x2="240" y2="400" stroke="url(#s-line-grad-v)" strokeWidth="1" />
          <line x1="320" y1="105" x2="460" y2="395" stroke="url(#s-line-grad)" strokeWidth="1" />
          <line x1="160" y1="210" x2="90" y2="330" stroke="url(#s-line-grad-v)" strokeWidth="0.8" />
          <line x1="480" y1="195" x2="555" y2="310" stroke="url(#s-line-grad)" strokeWidth="0.8" />
        </g>

        {/* === DASHBOARD SCREEN (center) === */}
        <g filter="url(#s-card-shadow)">
          <rect x="172" y="142" width="296" height="201" rx="12" fill="white" stroke="rgba(14,165,233,0.15)" strokeWidth="1.2" />
          <rect x="178" y="148" width="284" height="189" rx="8" fill="url(#s-screen-grad)" />
          {/* Screen header */}
          <rect x="178" y="148" width="284" height="28" rx="8" fill="rgba(14,165,233,0.06)" />
          <rect x="178" y="168" width="284" height="8" fill="rgba(14,165,233,0.04)" />
          {/* Header dots */}
          <circle cx="194" cy="162" r="3.5" fill="#ef4444" opacity="0.8" />
          <circle cx="206" cy="162" r="3.5" fill="#f59e0b" opacity="0.8" />
          <circle cx="218" cy="162" r="3.5" fill="#22c55e" opacity="0.8" />
          {/* Header title */}
          <rect x="300" y="159" width="72" height="5" rx="2.5" fill="rgba(14,165,233,0.2)" />

          {/* Bar chart */}
          <rect x="195" y="230" width="16" height="88" rx="3" fill="url(#s-chart-blue)" opacity="0.85">
            <animate attributeName="height" values="72;88;72" dur="3s" repeatCount="indefinite" />
            <animate attributeName="y" values="246;230;246" dur="3s" repeatCount="indefinite" />
          </rect>
          <rect x="217" y="248" width="16" height="70" rx="3" fill="url(#s-chart-teal)" opacity="0.8">
            <animate attributeName="height" values="82;70;82" dur="3.5s" repeatCount="indefinite" />
            <animate attributeName="y" values="236;248;236" dur="3.5s" repeatCount="indefinite" />
          </rect>
          <rect x="239" y="222" width="16" height="96" rx="3" fill="url(#s-chart-blue)" opacity="0.9">
            <animate attributeName="height" values="96;78;96" dur="2.8s" repeatCount="indefinite" />
            <animate attributeName="y" values="222;240;222" dur="2.8s" repeatCount="indefinite" />
          </rect>
          <rect x="261" y="252" width="16" height="66" rx="3" fill="url(#s-chart-indigo)" opacity="0.75">
            <animate attributeName="height" values="66;84;66" dur="3.2s" repeatCount="indefinite" />
            <animate attributeName="y" values="252;234;252" dur="3.2s" repeatCount="indefinite" />
          </rect>
          <rect x="283" y="236" width="16" height="82" rx="3" fill="url(#s-chart-blue)" opacity="0.85">
            <animate attributeName="height" values="82;66;82" dur="3.8s" repeatCount="indefinite" />
            <animate attributeName="y" values="236;252;236" dur="3.8s" repeatCount="indefinite" />
          </rect>

          {/* Line chart */}
          <polyline
            points="318,268 338,252 358,260 378,238 398,248 418,230 438,234 452,220"
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
            filter="url(#s-glow)"
          />
          <path
            d="M318,268 L338,252 L358,260 L378,238 L398,248 L418,230 L438,234 L452,220 L452,300 L318,300 Z"
            fill="url(#s-blue-grad)"
            opacity="0.08"
          />

          {/* Mini stat cards in dashboard */}
          <rect x="318" y="188" width="72" height="34" rx="6" fill="rgba(14,165,233,0.08)" stroke="rgba(14,165,233,0.15)" strokeWidth="0.8" />
          <rect x="324" y="194" width="36" height="4" rx="2" fill="rgba(14,165,233,0.35)" />
          <rect x="324" y="202" width="24" height="7" rx="2" fill="rgba(14,165,233,0.2)" />

          <rect x="398" y="188" width="64" height="34" rx="6" fill="rgba(20,184,166,0.08)" stroke="rgba(20,184,166,0.15)" strokeWidth="0.8" />
          <rect x="404" y="194" width="28" height="4" rx="2" fill="rgba(20,184,166,0.35)" />
          <rect x="404" y="202" width="20" height="7" rx="2" fill="rgba(20,184,166,0.2)" />
        </g>

        {/* === CLOUD ELEMENT (top center) === */}
        <g filter="url(#s-shadow)" opacity="0.9">
          <ellipse cx="320" cy="78" rx="48" ry="20" fill="white" stroke="rgba(14,165,233,0.2)" strokeWidth="1" />
          <ellipse cx="296" cy="74" rx="30" ry="16" fill="white" stroke="rgba(14,165,233,0.15)" strokeWidth="0.8" />
          <ellipse cx="344" cy="74" rx="28" ry="14" fill="white" stroke="rgba(14,165,233,0.15)" strokeWidth="0.8" />
          <ellipse cx="320" cy="72" rx="36" ry="18" fill="white" stroke="rgba(14,165,233,0.18)" strokeWidth="1" />
          {/* Cloud icon */}
          <path d="M310,72 Q310,64 318,64 Q320,58 326,58 Q334,58 336,64 Q342,64 342,70 Q342,76 336,76 L312,76 Q308,76 308,72 Z" fill="url(#s-blue-grad)" opacity="0.25" />
          {/* Upload arrow */}
          <path d="M325,66 L325,74 M321,69 L325,65 L329,69" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
        </g>

        {/* === FLOATING CARDS === */}

        {/* Card: Revenue (top-left) */}
        <g filter="url(#s-shadow)">
          <rect x="36" y="108" width="135" height="82" rx="14" fill="url(#s-card-grad)" stroke="rgba(14,165,233,0.12)" strokeWidth="1" />
          <line x1="36" y1="128" x2="171" y2="128" stroke="rgba(14,165,233,0.06)" strokeWidth="1" />
          <rect x="50" y="122" width="36" height="7" rx="3.5" fill="rgba(14,165,233,0.2)" />
          <text x="50" y="155" fill="#0f172a" fontSize="22" fontWeight="700" fontFamily="Inter, system-ui, sans-serif">$2.4M</text>
          <text x="115" y="155" fill="#14b8a6" fontSize="11" fontWeight="600" fontFamily="Inter, system-ui, sans-serif">+18%</text>
          <rect x="50" y="170" width="96" height="4" rx="2" fill="rgba(14,165,233,0.08)" />
          <rect x="50" y="170" width="74" height="4" rx="2" fill="url(#s-blue-grad)" opacity="0.5" />
        </g>

        {/* Card: Reports (top-right) */}
        <g filter="url(#s-shadow)">
          <rect x="478" y="98" width="140" height="82" rx="14" fill="url(#s-card-grad)" stroke="rgba(20,184,166,0.12)" strokeWidth="1" />
          <line x1="478" y1="118" x2="618" y2="118" stroke="rgba(20,184,166,0.06)" strokeWidth="1" />
          <rect x="492" y="112" width="32" height="7" rx="3.5" fill="rgba(20,184,166,0.2)" />
          <text x="492" y="145" fill="#0f172a" fontSize="20" fontWeight="700" fontFamily="Inter, system-ui, sans-serif">1,847</text>
          <text x="550" y="145" fill="rgba(15,23,42,0.4)" fontSize="11" fontWeight="500" fontFamily="Inter, system-ui, sans-serif">Reports</text>
          <rect x="492" y="160" width="108" height="4" rx="2" fill="rgba(20,184,166,0.08)" />
          <rect x="492" y="160" width="82" height="4" rx="2" fill="url(#s-teal-grad)" opacity="0.5" />
        </g>

        {/* Card: Dashboard Insights (bottom-left) */}
        <g filter="url(#s-shadow)">
          <rect x="24" y="338" width="136" height="82" rx="14" fill="url(#s-card-grad)" stroke="rgba(99,102,241,0.12)" strokeWidth="1" />
          <line x1="24" y1="358" x2="160" y2="358" stroke="rgba(99,102,241,0.06)" strokeWidth="1" />
          <rect x="38" y="352" width="40" height="7" rx="3.5" fill="rgba(99,102,241,0.18)" />
          <text x="38" y="385" fill="#0f172a" fontSize="22" fontWeight="700" fontFamily="Inter, system-ui, sans-serif">3,421</text>
          <text x="38" y="405" fill="rgba(15,23,42,0.4)" fontSize="10" fontWeight="500" fontFamily="Inter, system-ui, sans-serif">Dashboard Views</text>
        </g>

        {/* Card: Analytics Score (bottom-right) */}
        <g filter="url(#s-shadow)">
          <rect x="486" y="342" width="136" height="82" rx="14" fill="url(#s-card-grad)" stroke="rgba(6,182,212,0.12)" strokeWidth="1" />
          <line x1="486" y1="362" x2="622" y2="362" stroke="rgba(6,182,212,0.06)" strokeWidth="1" />
          <rect x="500" y="356" width="34" height="7" rx="3.5" fill="rgba(6,182,212,0.18)" />
          <text x="500" y="389" fill="#0f172a" fontSize="22" fontWeight="700" fontFamily="Inter, system-ui, sans-serif">97.3%</text>
          <text x="500" y="409" fill="rgba(15,23,42,0.4)" fontSize="10" fontWeight="500" fontFamily="Inter, system-ui, sans-serif">Analytics Score</text>
        </g>

        {/* === DATABASE ICON (bottom center) === */}
        <g filter="url(#s-shadow)">
          <rect x="272" y="410" width="96" height="68" rx="10" fill="url(#s-card-grad)" stroke="rgba(14,165,233,0.12)" strokeWidth="1" />
          <ellipse cx="320" cy="432" rx="22" ry="8" fill="rgba(14,165,233,0.1)" stroke="rgba(14,165,233,0.3)" strokeWidth="1" />
          <rect x="298" y="432" width="44" height="26" fill="rgba(14,165,233,0.05)" />
          <line x1="298" y1="432" x2="298" y2="458" stroke="rgba(14,165,233,0.3)" strokeWidth="1" />
          <line x1="342" y1="432" x2="342" y2="458" stroke="rgba(14,165,233,0.3)" strokeWidth="1" />
          <ellipse cx="320" cy="458" rx="22" ry="8" fill="rgba(14,165,233,0.08)" stroke="rgba(14,165,233,0.3)" strokeWidth="1" />
          <ellipse cx="320" cy="445" rx="22" ry="8" fill="rgba(14,165,233,0.1)" stroke="rgba(14,165,233,0.2)" strokeWidth="0.8" />
          <circle cx="360" cy="448" r="3" fill="#22c55e" filter="url(#s-glow)" />
        </g>

        {/* === CENTRAL AI/ANALYTICS NODE (above screen) === */}
        <g filter="url(#s-glow-strong)">
          <circle cx="320" cy="105" r="32" fill="none" stroke="url(#s-blue-grad)" strokeWidth="1.5" opacity="0.35" />
          <circle cx="320" cy="105" r="24" fill="rgba(14,165,233,0.1)" stroke="url(#s-blue-grad)" strokeWidth="2" />
          <circle cx="320" cy="105" r="14" fill="url(#s-blue-grad)" opacity="0.85" />
          {/* Chart icon inside */}
          <rect x="313" y="100" width="3" height="8" rx="1" fill="white" opacity="0.9" />
          <rect x="318" y="97" width="3" height="11" rx="1" fill="white" opacity="0.9" />
          <rect x="323" y="101" width="3" height="7" rx="1" fill="white" opacity="0.9" />
        </g>

        {/* Orbital dots */}
        <circle cx="320" cy="66" r="2.5" fill="#0ea5e9" opacity="0.6">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="356" cy="82" r="2" fill="#14b8a6" opacity="0.5">
          <animate attributeName="opacity" values="0.5;0.9;0.5" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="284" cy="82" r="2" fill="#6366f1" opacity="0.5">
          <animate attributeName="opacity" values="0.5;0.9;0.5" dur="3s" repeatCount="indefinite" />
        </circle>

        {/* === FLOATING MINI CHIPS === */}
        <rect x="44" y="218" width="52" height="22" rx="11" fill="rgba(14,165,233,0.1)" stroke="rgba(14,165,233,0.2)" strokeWidth="0.8" />
        <text x="70" y="233" fill="rgba(14,165,233,0.7)" fontSize="9" fontWeight="600" fontFamily="Inter, system-ui, sans-serif" textAnchor="middle">DASH</text>

        <rect x="546" y="238" width="48" height="22" rx="11" fill="rgba(20,184,166,0.1)" stroke="rgba(20,184,166,0.2)" strokeWidth="0.8" />
        <text x="570" y="253" fill="rgba(20,184,166,0.7)" fontSize="9" fontWeight="600" fontFamily="Inter, system-ui, sans-serif" textAnchor="middle">KPI</text>

        <rect x="82" y="288" width="48" height="22" rx="11" fill="rgba(99,102,241,0.08)" stroke="rgba(99,102,241,0.2)" strokeWidth="0.8" />
        <text x="106" y="303" fill="rgba(99,102,241,0.7)" fontSize="9" fontWeight="600" fontFamily="Inter, system-ui, sans-serif" textAnchor="middle">RPT</text>

        <rect x="512" y="296" width="52" height="22" rx="11" fill="rgba(6,182,212,0.1)" stroke="rgba(6,182,212,0.2)" strokeWidth="0.8" />
        <text x="538" y="311" fill="rgba(6,182,212,0.7)" fontSize="9" fontWeight="600" fontFamily="Inter, system-ui, sans-serif" textAnchor="middle">DATA</text>

        {/* Tiny floating nodes */}
        <circle cx="56" cy="170" r="3.5" fill="#0ea5e9" opacity="0.4">
          <animate attributeName="r" values="3.5;4.5;3.5" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="584" cy="180" r="3" fill="#14b8a6" opacity="0.4">
          <animate attributeName="r" values="3;4;3" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="155" cy="425" r="2.5" fill="#6366f1" opacity="0.35">
          <animate attributeName="r" values="2.5;3.5;2.5" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx="488" cy="435" r="2.5" fill="#06b6d4" opacity="0.35">
          <animate attributeName="r" values="2.5;3.5;2.5" dur="3.5s" repeatCount="indefinite" />
        </circle>

        {/* Sparkle particles */}
        <circle cx="210" cy="118" r="1.5" fill="#0ea5e9" opacity="0.3">
          <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="430" cy="128" r="1.5" fill="#14b8a6" opacity="0.3">
          <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2.8s" repeatCount="indefinite" />
        </circle>
        <circle cx="380" cy="440" r="1.5" fill="#6366f1" opacity="0.25">
          <animate attributeName="opacity" values="0.25;0.6;0.25" dur="3.2s" repeatCount="indefinite" />
        </circle>
        <circle cx="250" cy="455" r="1.5" fill="#0ea5e9" opacity="0.3">
          <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2.4s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}
