/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          2: 'hsl(var(--surface-2))',
        },
        elevated: 'hsl(var(--elevated))',
        sidebar: {
          bg: 'hsl(var(--sidebar-bg))',
          border: 'hsl(var(--sidebar-border))',
          icon: 'hsl(var(--sidebar-icon-color))',
          'icon-hover': 'hsl(var(--sidebar-icon-hover))',
          'icon-active': 'hsl(var(--sidebar-icon-active))',
          text: 'hsl(var(--sidebar-text))',
          'text-hover': 'hsl(var(--sidebar-text-hover))',
          'text-strong': 'hsl(var(--sidebar-text-strong))',
          'active-bg': 'hsl(var(--sidebar-active-bg))',
          'hover-bg': 'hsl(var(--sidebar-hover-bg))',
          muted: 'hsl(var(--sidebar-muted))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        brand: {
          50: '#f3f1ff',
          100: '#e9e6ff',
          200: '#d5ceff',
          300: '#b5a8ff',
          400: '#8f79ff',
          500: '#6d4bff',
          600: '#5b26f2',
          700: '#4d18d8',
          800: '#4015b2',
          900: '#341292',
          950: '#1d0863',
        },
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '28px',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'SF Mono',
          'Menlo',
          'Consolas',
          'Liberation Mono',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.9375rem' }],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
        glow: 'var(--shadow-glow)',
        'glow-sm': 'var(--shadow-glow-sm)',
        focus: '0 0 0 3px hsl(var(--ring) / 0.25)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'zoom-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(24px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        'aurora-a': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)', opacity: '0.75' },
          '50%': { transform: 'translate(6%, 10%) scale(1.15)', opacity: '1' },
        },
        'aurora-b': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1.05)', opacity: '0.7' },
          '50%': { transform: 'translate(-7%, -8%) scale(0.95)', opacity: '0.95' },
        },
        'aurora-c': {
          '0%, 100%': { transform: 'translate(0, 0) scale(0.95)', opacity: '0.55' },
          '50%': { transform: 'translate(4%, -9%) scale(1.1)', opacity: '0.85' },
        },
        'float-y': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '0.9' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.18s ease-out',
        'fade-in-up': 'fade-in-up 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
        'zoom-in': 'zoom-in 0.18s ease-out',
        'slide-in-right': 'slide-in-right 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 1.4s linear infinite',
        'aurora-a': 'aurora-a 14s ease-in-out infinite',
        'aurora-b': 'aurora-b 18s ease-in-out infinite',
        'aurora-c': 'aurora-c 22s ease-in-out infinite',
        'float-y': 'float-y 5s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};