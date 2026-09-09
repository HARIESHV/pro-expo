import React from 'react';

export function EnterpriseLoginVisual() {
  return (
    <div className="relative h-full w-full" aria-hidden="true">
      <svg
        viewBox="0 0 640 520"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 h-auto w-full max-w-[580px]"
      >
        <defs>
          <filter id="l-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="l-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="l-shadow" x="-20%" y="-10%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="12" floodColor="#c2410c" floodOpacity="0.14" />
          </filter>
          <filter id="l-card-shadow" x="-15%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="8" stdDeviation="16" floodColor="#c2410c" floodOpacity="0.16" />
          </filter>

          <linearGradient id="l-orange-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff6b00" />
            <stop offset="100%" stopColor="#ff9500" />
          </linearGradient>
          <linearGradient id="l-amber-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
          <linearGradient id="l-rose-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#fb7185" />
          </linearGradient>
          <linearGradient id="l-line-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ff6b00" stopOpacity="0" />
            <stop offset="50%" stopColor="#ff6b00" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ff6b00" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="l-line-grad-v" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0" />
            <stop offset="50%" stopColor="#f97316" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="l-card-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.9)" />
          </linearGradient>
          <linearGradient id="l-screen-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fffaf5" />
            <stop offset="100%" stopColor="#ffedd5" />
          </linearGradient>
          <linearGradient id="l-chart-orange" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ff6b00" />
            <stop offset="100%" stopColor="#ffb347" />
          </linearGradient>
          <linearGradient id="l-chart-amber" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <linearGradient id="l-chart-rose" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#fb7185" />
          </linearGradient>

          <clipPath id="l-screen-clip">
            <rect x="175" y="145" width="290" height="195" rx="6" />
          </clipPath>
        </defs>

        {/* === NETWORK CONNECTION LINES === */}
        <g opacity="0.3">
          <line x1="320" y1="105" x2="160" y2="215" stroke="url(#l-line-grad)" strokeWidth="1" />
          <line x1="320" y1="105" x2="480" y2="200" stroke="url(#l-line-grad)" strokeWidth="1" />
          <line x1="320" y1="105" x2="540" y2="140" stroke="url(#l-line-grad)" strokeWidth="1" />
          <line x1="320" y1="105" x2="112" y2="150" stroke="url(#l-line-grad-v)" strokeWidth="1" />
          <line x1="320" y1="105" x2="235" y2="405" stroke="url(#l-line-grad-v)" strokeWidth="1" />
          <line x1="320" y1="105" x2="465" y2="400" stroke="url(#l-line-grad)" strokeWidth="1" />
          <line x1="160" y1="215" x2="92" y2="335" stroke="url(#l-line-grad-v)" strokeWidth="0.8" />
          <line x1="480" y1="200" x2="555" y2="315" stroke="url(#l-line-grad)" strokeWidth="0.8" />
        </g>

        {/* === LAPTOP / DASHBOARD (center) === */}
        <g filter="url(#l-card-shadow)">
          <rect x="172" y="142" width="296" height="201" rx="12" fill="white" stroke="rgba(255,107,0,0.15)" strokeWidth="1.2" />
          <rect x="178" y="148" width="284" height="189" rx="8" fill="url(#l-screen-grad)" />
          {/* Screen header */}
          <rect x="178" y="148" width="284" height="28" rx="8" fill="rgba(255,107,0,0.07)" />
          <rect x="178" y="168" width="284" height="8" fill="rgba(255,107,0,0.05)" />
          {/* Header dots */}
          <circle cx="194" cy="162" r="3.5" fill="#ef4444" opacity="0.8" />
          <circle cx="206" cy="162" r="3.5" fill="#f59e0b" opacity="0.8" />
          <circle cx="218" cy="162" r="3.5" fill="#22c55e" opacity="0.8" />
          {/* Header title */}
          <rect x="300" y="159" width="72" height="5" rx="2.5" fill="rgba(255,107,0,0.22)" />

          {/* Bar chart */}
          <rect x="195" y="230" width="16" height="88" rx="3" fill="url(#l-chart-orange)" opacity="0.85">
            <animate attributeName="height" values="72;88;72" dur="3s" repeatCount="indefinite" />
            <animate attributeName="y" values="246;230;246" dur="3s" repeatCount="indefinite" />
          </rect>
          <rect x="217" y="248" width="16" height="70" rx="3" fill="url(#l-chart-amber)" opacity="0.8">
            <animate attributeName="height" values="82;70;82" dur="3.5s" repeatCount="indefinite" />
            <animate attributeName="y" values="236;248;236" dur="3.5s" repeatCount="indefinite" />
          </rect>
          <rect x="239" y="222" width="16" height="96" rx="3" fill="url(#l-chart-orange)" opacity="0.9">
            <animate attributeName="height" values="96;78;96" dur="2.8s" repeatCount="indefinite" />
            <animate attributeName="y" values="222;240;222" dur="2.8s" repeatCount="indefinite" />
          </rect>
          <rect x="261" y="252" width="16" height="66" rx="3" fill="url(#l-chart-rose)" opacity="0.75">
            <animate attributeName="height" values="66;84;66" dur="3.2s" repeatCount="indefinite" />
            <animate attributeName="y" values="252;234;252" dur="3.2s" repeatCount="indefinite" />
          </rect>
          <rect x="283" y="236" width="16" height="82" rx="3" fill="url(#l-chart-orange)" opacity="0.85">
            <animate attributeName="height" values="82;66;82" dur="3.8s" repeatCount="indefinite" />
            <animate attributeName="y" values="236;252;236" dur="3.8s" repeatCount="indefinite" />
          </rect>

          {/* Line chart */}
          <polyline
            points="318,268 338,252 358,260 378,238 398,248 418,230 438,234 452,220"
            fill="none"
            stroke="#ff6b00"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
            filter="url(#l-glow)"
          />
          <path
            d="M318,268 L338,252 L358,260 L378,238 L398,248 L418,230 L438,234 L452,220 L452,300 L318,300 Z"
            fill="url(#l-orange-grad)"
            opacity="0.08"
          />

          {/* Mini stat cards in dashboard */}
          <rect x="316" y="188" width="72" height="34" rx="6" fill="rgba(255,107,0,0.09)" stroke="rgba(255,107,0,0.16)" strokeWidth="0.8" />
          <rect x="322" y="194" width="36" height="4" rx="2" fill="rgba(255,107,0,0.35)" />
          <rect x="322" y="202" width="24" height="7" rx="2" fill="rgba(255,107,0,0.22)" />

          <rect x="396" y="188" width="64" height="34" rx="6" fill="rgba(244,63,94,0.08)" stroke="rgba(244,63,94,0.16)" strokeWidth="0.8" />
          <rect x="402" y="194" width="28" height="4" rx="2" fill="rgba(244,63,94,0.35)" />
          <rect x="402" y="202" width="20" height="7" rx="2" fill="rgba(244,63,94,0.22)" />
        </g>

        {/* Laptop base */}
        <path
          d="M180,343 L192,343 Q196,343 196,347 L444,347 Q448,347 448,343 L460,343 L468,358 Q470,362 466,362 L174,362 Q170,362 172,358 Z"
          fill="#fff7ed"
          stroke="rgba(255,107,0,0.18)"
          strokeWidth="1"
        />
        <ellipse cx="320" cy="348" rx="48" ry="2.5" fill="rgba(255,107,0,0.25)" />

        {/* === AI / DATA NODE (top center) === */}
        <g filter="url(#l-glow-strong)">
          <circle cx="320" cy="78" r="30" fill="none" stroke="url(#l-orange-grad)" strokeWidth="1.5" opacity="0.35" />
          <circle cx="320" cy="78" r="22" fill="rgba(255,107,0,0.1)" stroke="url(#l-orange-grad)" strokeWidth="2" />
          <circle cx="320" cy="78" r="12" fill="url(#l-orange-grad)" opacity="0.9" />
          {/* AI text */}
          <text x="320" y="82" fill="white" fontSize="10" fontWeight="800" fontFamily="Inter, system-ui, sans-serif" textAnchor="middle">AI</text>
        </g>

        {/* Orbital dots */}
        <circle cx="320" cy="40" r="2.5" fill="#ff6b00" opacity="0.7">
          <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="358" cy="58" r="2" fill="#fb923c" opacity="0.6">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="282" cy="58" r="2" fill="#f43f5e" opacity="0.6">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" />
        </circle>

        {/* === FLOATING CARDS === */}

        {/* Card: AI Score (top-left) */}
        <g filter="url(#l-shadow)">
          <rect x="34" y="108" width="134" height="82" rx="14" fill="url(#l-card-grad)" stroke="rgba(255,107,0,0.12)" strokeWidth="1" />
          <line x1="34" y1="128" x2="168" y2="128" stroke="rgba(255,107,0,0.07)" strokeWidth="1" />
          <rect x="48" y="122" width="36" height="7" rx="3.5" fill="rgba(255,107,0,0.18)" />
          <text x="48" y="155" fill="#0f172a" fontSize="22" fontWeight="700" fontFamily="Inter, system-ui, sans-serif">94.7</text>
          <text x="112" y="155" fill="#16a34a" fontSize="11" fontWeight="600" fontFamily="Inter, system-ui, sans-serif">+12%</text>
          <rect x="48" y="170" width="96" height="4" rx="2" fill="rgba(255,107,0,0.08)" />
          <rect x="48" y="170" width="74" height="4" rx="2" fill="url(#l-orange-grad)" opacity="0.5" />
        </g>

        {/* Card: Documents (top-right) */}
        <g filter="url(#l-shadow)">
          <rect x="478" y="96" width="140" height="82" rx="14" fill="url(#l-card-grad)" stroke="rgba(244,63,94,0.12)" strokeWidth="1" />
          <line x1="478" y1="116" x2="618" y2="116" stroke="rgba(244,63,94,0.07)" strokeWidth="1" />
          <rect x="492" y="110" width="36" height="7" rx="3.5" fill="rgba(244,63,94,0.16)" />
          <text x="492" y="143" fill="#0f172a" fontSize="20" fontWeight="700" fontFamily="Inter, system-ui, sans-serif">1,284</text>
          <text x="548" y="143" fill="rgba(15,23,42,0.4)" fontSize="11" fontWeight="500" fontFamily="Inter, system-ui, sans-serif">Docs</text>
          <rect x="492" y="160" width="108" height="4" rx="2" fill="rgba(244,63,94,0.08)" />
          <rect x="492" y="160" width="82" height="4" rx="2" fill="url(#l-chart-rose)" opacity="0.5" />
        </g>

        {/* Card: Insights (bottom-left) */}
        <g filter="url(#l-shadow)">
          <rect x="24" y="338" width="136" height="82" rx="14" fill="url(#l-card-grad)" stroke="rgba(249,115,22,0.12)" strokeWidth="1" />
          <line x1="24" y1="358" x2="160" y2="358" stroke="rgba(249,115,22,0.07)" strokeWidth="1" />
          <rect x="38" y="352" width="40" height="7" rx="3.5" fill="rgba(249,115,22,0.16)" />
          <text x="38" y="385" fill="#0f172a" fontSize="22" fontWeight="700" fontFamily="Inter, system-ui, sans-serif">1,024</text>
          <text x="38" y="405" fill="rgba(15,23,42,0.4)" fontSize="10" fontWeight="500" fontFamily="Inter, system-ui, sans-serif">Insights</text>
        </g>

        {/* Card: Revenue (bottom-right) */}
        <g filter="url(#l-shadow)">
          <rect x="486" y="342" width="136" height="82" rx="14" fill="url(#l-card-grad)" stroke="rgba(255,107,0,0.12)" strokeWidth="1" />
          <line x1="486" y1="362" x2="622" y2="362" stroke="rgba(255,107,0,0.07)" strokeWidth="1" />
          <rect x="500" y="356" width="34" height="7" rx="3.5" fill="rgba(255,107,0,0.16)" />
          <text x="500" y="389" fill="#0f172a" fontSize="22" fontWeight="700" fontFamily="Inter, system-ui, sans-serif">$2.4M</text>
          <text x="500" y="409" fill="rgba(15,23,42,0.4)" fontSize="10" fontWeight="500" fontFamily="Inter, system-ui, sans-serif">Revenue</text>
        </g>

        {/* === DATABASE ICON (bottom center) === */}
        <g filter="url(#l-shadow)">
          <rect x="272" y="414" width="96" height="68" rx="10" fill="url(#l-card-grad)" stroke="rgba(255,107,0,0.12)" strokeWidth="1" />
          <ellipse cx="320" cy="436" rx="22" ry="8" fill="rgba(255,107,0,0.1)" stroke="rgba(255,107,0,0.3)" strokeWidth="1" />
          <rect x="298" y="436" width="44" height="26" fill="rgba(255,107,0,0.05)" />
          <line x1="298" y1="436" x2="298" y2="462" stroke="rgba(255,107,0,0.3)" strokeWidth="1" />
          <line x1="342" y1="436" x2="342" y2="462" stroke="rgba(255,107,0,0.3)" strokeWidth="1" />
          <ellipse cx="320" cy="462" rx="22" ry="8" fill="rgba(255,107,0,0.08)" stroke="rgba(255,107,0,0.3)" strokeWidth="1" />
          <ellipse cx="320" cy="449" rx="22" ry="8" fill="rgba(255,107,0,0.1)" stroke="rgba(255,107,0,0.2)" strokeWidth="0.8" />
          <circle cx="360" cy="452" r="3" fill="#22c55e" filter="url(#l-glow)" />
        </g>

        {/* === FLOATING MINI CHIPS === */}
        <rect x="40" y="220" width="54" height="22" rx="11" fill="rgba(255,107,0,0.1)" stroke="rgba(255,107,0,0.2)" strokeWidth="0.8" />
        <text x="67" y="235" fill="rgba(255,107,0,0.75)" fontSize="9" fontWeight="600" fontFamily="Inter, system-ui, sans-serif" textAnchor="middle">NLP</text>

        <rect x="546" y="240" width="48" height="22" rx="11" fill="rgba(249,115,22,0.1)" stroke="rgba(249,115,22,0.2)" strokeWidth="0.8" />
        <text x="570" y="255" fill="rgba(249,115,22,0.75)" fontSize="9" fontWeight="600" fontFamily="Inter, system-ui, sans-serif" textAnchor="middle">ML</text>

        <rect x="80" y="290" width="48" height="22" rx="11" fill="rgba(244,63,94,0.08)" stroke="rgba(244,63,94,0.2)" strokeWidth="0.8" />
        <text x="104" y="305" fill="rgba(244,63,94,0.7)" fontSize="9" fontWeight="600" fontFamily="Inter, system-ui, sans-serif" textAnchor="middle">RAG</text>

        <rect x="512" y="300" width="50" height="22" rx="11" fill="rgba(255,107,0,0.1)" stroke="rgba(255,107,0,0.2)" strokeWidth="0.8" />
        <text x="537" y="315" fill="rgba(255,107,0,0.7)" fontSize="9" fontWeight="600" fontFamily="Inter, system-ui, sans-serif" textAnchor="middle">LLM</text>

        {/* Tiny floating nodes */}
        <circle cx="56" cy="172" r="3.5" fill="#ff6b00" opacity="0.45">
          <animate attributeName="r" values="3.5;4.5;3.5" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="584" cy="182" r="3" fill="#fb923c" opacity="0.45">
          <animate attributeName="r" values="3;4;3" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="156" cy="430" r="2.5" fill="#f43f5e" opacity="0.4">
          <animate attributeName="r" values="2.5;3.5;2.5" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx="486" cy="438" r="2.5" fill="#f59e0b" opacity="0.4">
          <animate attributeName="r" values="2.5;3.5;2.5" dur="3.5s" repeatCount="indefinite" />
        </circle>

        {/* Sparkle particles */}
        <circle cx="212" cy="118" r="1.5" fill="#ff6b00" opacity="0.35">
          <animate attributeName="opacity" values="0.35;0.85;0.35" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="432" cy="128" r="1.5" fill="#fb923c" opacity="0.35">
          <animate attributeName="opacity" values="0.35;0.8;0.35" dur="2.8s" repeatCount="indefinite" />
        </circle>
        <circle cx="382" cy="444" r="1.5" fill="#f43f5e" opacity="0.3">
          <animate attributeName="opacity" values="0.3;0.7;0.3" dur="3.2s" repeatCount="indefinite" />
        </circle>
        <circle cx="252" cy="458" r="1.5" fill="#ff6b00" opacity="0.35">
          <animate attributeName="opacity" values="0.35;0.8;0.35" dur="2.4s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}