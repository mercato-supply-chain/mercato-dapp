import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      colors: {
        brand: {
          dark:  'hsl(var(--brand-dark))',
          mid:   'hsl(var(--brand-mid))',
          light: 'hsl(var(--brand-light))',
          pale:  'hsl(var(--brand-pale))',
          ultra: 'hsl(var(--brand-ultra))',
        },
        landing: {
          hero: 'hsl(var(--landing-hero))',
          'hero-accent': 'hsl(var(--landing-hero-accent))',
          cta: 'hsl(var(--landing-cta))',
          'cta-fg': 'hsl(var(--landing-cta-fg))',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'mercato-bar-fill': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        /** Deal cycle arrows: opacity “glow” + nudge along flow (compositor-friendly) */
        'mercato-flow-nudge-right': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)', opacity: '0.42' },
          '50%': { transform: 'translate3d(5px, 0, 0)', opacity: '1' },
        },
        'mercato-flow-nudge-down': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)', opacity: '0.42' },
          '50%': { transform: 'translate3d(0, 5px, 0)', opacity: '1' },
        },
        'mercato-flow-nudge-left': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)', opacity: '0.42' },
          '50%': { transform: 'translate3d(-5px, 0, 0)', opacity: '1' },
        },
        'mercato-flow-nudge-up': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)', opacity: '0.42' },
          '50%': { transform: 'translate3d(0, -5px, 0)', opacity: '1' },
        },
        /** Deal cycle step badges: one pulse per loop, staggered 1 → 2 → 3 → 4 (matches arrow phase) */
        'mercato-cycle-step-pulse-1': {
          '0%': { transform: 'scale3d(1, 1, 1)' },
          '6%': { transform: 'scale3d(1.14, 1.14, 1)' },
          '12%, 100%': { transform: 'scale3d(1, 1, 1)' },
        },
        'mercato-cycle-step-pulse-2': {
          '0%, 25%': { transform: 'scale3d(1, 1, 1)' },
          '31%': { transform: 'scale3d(1.14, 1.14, 1)' },
          '37%, 100%': { transform: 'scale3d(1, 1, 1)' },
        },
        'mercato-cycle-step-pulse-3': {
          '0%, 50%': { transform: 'scale3d(1, 1, 1)' },
          '56%': { transform: 'scale3d(1.14, 1.14, 1)' },
          '62%, 100%': { transform: 'scale3d(1, 1, 1)' },
        },
        'mercato-cycle-step-pulse-4': {
          '0%, 75%': { transform: 'scale3d(1, 1, 1)' },
          '81%': { transform: 'scale3d(1.14, 1.14, 1)' },
          '87%, 100%': { transform: 'scale3d(1, 1, 1)' },
        },
        /** Hero dot-grid parallax drift */
        'mercato-grid-drift': {
          '0%, 100%': { backgroundPosition: '0 0' },
          '50%': { backgroundPosition: '16px 16px' },
        },
        /** Stat number flip-in */
        'mercato-flip-in': {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to:   { transform: 'translateY(0)',   opacity: '1' },
        },
        /** Float variations for satellite cards */
        'mercato-float-a': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(0, -8px, 0)' },
        },
        'mercato-float-b': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(0, 6px, 0)' },
        },
        'mercato-float-c': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(0, -5px, 0)' },
        },
        /** Shimmer sweep for progress bars and highlights */
        'mercato-shimmer': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(200%)' },
        },
        /** Slow ping for status indicators */
        'mercato-ping-slow': {
          '75%, 100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        /** Progress bar fill */
        'mercato-progress-fill': {
          from: { width: '0%' },
        },
        /** Staggered reveal for activity feed items */
        'mercato-slide-up-fade': {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        /** Capital flow pulse along connection lines */
        'mercato-capital-flow': {
          '0%, 100%': { opacity: '0.3', transform: 'scaleX(0.95)' },
          '50%': { opacity: '1', transform: 'scaleX(1)' },
        },
        /** SVG stroke draw */
        'mercato-line-draw': {
          from: { strokeDashoffset: '300' },
          to: { strokeDashoffset: '0' },
        },
        /** Orbit rotation */
        'mercato-orbit-1': {
          from: { transform: 'rotate(0deg) translateX(120px) rotate(0deg)' },
          to: { transform: 'rotate(360deg) translateX(120px) rotate(-360deg)' },
        },
        'mercato-orbit-2': {
          from: { transform: 'rotate(180deg) translateX(140px) rotate(-180deg)' },
          to: { transform: 'rotate(540deg) translateX(140px) rotate(-540deg)' },
        },
        /** Deal cycle whole cards: same phase as step badges, gentler scale */
        'mercato-cycle-card-pulse-1': {
          '0%': { transform: 'scale3d(1, 1, 1)' },
          '6%': { transform: 'scale3d(1.022, 1.022, 1)' },
          '12%, 100%': { transform: 'scale3d(1, 1, 1)' },
        },
        'mercato-cycle-card-pulse-2': {
          '0%, 25%': { transform: 'scale3d(1, 1, 1)' },
          '31%': { transform: 'scale3d(1.022, 1.022, 1)' },
          '37%, 100%': { transform: 'scale3d(1, 1, 1)' },
        },
        'mercato-cycle-card-pulse-3': {
          '0%, 50%': { transform: 'scale3d(1, 1, 1)' },
          '56%': { transform: 'scale3d(1.022, 1.022, 1)' },
          '62%, 100%': { transform: 'scale3d(1, 1, 1)' },
        },
        'mercato-cycle-card-pulse-4': {
          '0%, 75%': { transform: 'scale3d(1, 1, 1)' },
          '81%': { transform: 'scale3d(1.022, 1.022, 1)' },
          '87%, 100%': { transform: 'scale3d(1, 1, 1)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'mercato-bar-fill':
          'mercato-bar-fill 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'mercato-flow-right':
          'mercato-flow-nudge-right 4s ease-in-out infinite',
        'mercato-flow-down':
          'mercato-flow-nudge-down 4s ease-in-out infinite',
        'mercato-flow-left':
          'mercato-flow-nudge-left 4s ease-in-out infinite',
        'mercato-flow-up':
          'mercato-flow-nudge-up 4s ease-in-out infinite',
        'mercato-cycle-step-1':
          'mercato-cycle-step-pulse-1 4s ease-in-out infinite',
        'mercato-cycle-step-2':
          'mercato-cycle-step-pulse-2 4s ease-in-out infinite',
        'mercato-cycle-step-3':
          'mercato-cycle-step-pulse-3 4s ease-in-out infinite',
        'mercato-cycle-step-4':
          'mercato-cycle-step-pulse-4 4s ease-in-out infinite',
        'mercato-cycle-card-1':
          'mercato-cycle-card-pulse-1 4s ease-in-out infinite',
        'mercato-cycle-card-2':
          'mercato-cycle-card-pulse-2 4s ease-in-out infinite',
        'mercato-cycle-card-3':
          'mercato-cycle-card-pulse-3 4s ease-in-out infinite',
        'mercato-cycle-card-4':
          'mercato-cycle-card-pulse-4 4s ease-in-out infinite',
        'mercato-float-a': 'mercato-float-a 6s ease-in-out infinite',
        'mercato-float-b': 'mercato-float-b 7s ease-in-out infinite',
        'mercato-float-c': 'mercato-float-c 5.5s ease-in-out infinite',
        'mercato-shimmer': 'mercato-shimmer 2.4s linear infinite',
        'mercato-ping-slow': 'mercato-ping-slow 2.2s cubic-bezier(0,0,0.2,1) infinite',
        'mercato-ping-slower': 'mercato-ping-slow 3.4s cubic-bezier(0,0,0.2,1) infinite',
        'mercato-progress-fill': 'mercato-progress-fill 1.4s cubic-bezier(0.22,1,0.36,1) forwards',
        'mercato-slide-up-fade': 'mercato-slide-up-fade 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'mercato-ticker': 'mercato-ticker 0.18s steps(1) both',
        'mercato-orbit-1': 'mercato-orbit-1 18s linear infinite',
        'mercato-orbit-2': 'mercato-orbit-2 22s linear infinite',
        'mercato-capital-flow': 'mercato-capital-flow 2.8s ease-in-out infinite',
        'mercato-line-draw': 'mercato-line-draw 1.2s cubic-bezier(0.22,1,0.36,1) forwards',
        'mercato-grid-drift': 'mercato-grid-drift 20s ease-in-out infinite',
        'mercato-flip-in': 'mercato-flip-in 0.4s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
export default config
