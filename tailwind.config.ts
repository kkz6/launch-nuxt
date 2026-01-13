import type { Config } from 'tailwindcss'

const config = {
  darkMode: ['class'],
  content: {
    files: ['./components/**/*.{vue,ts}', './layouts/**/*.vue', './pages/**/*.vue', './app.vue'],
  },
  prefix: '',
  safelist: ['md:grid-cols-5', 'md:grid-cols-6', 'md:grid-cols-7', 'md:grid-cols-8'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Manrope', 'sans-serif'],
        site: ['Manrope', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.5' }],
        sm: ['0.875rem', { lineHeight: '1.5715' }],
        base: ['1rem', { lineHeight: '1.5', letterSpacing: '-0.017em' }],
        lg: ['1.125rem', { lineHeight: '1.5', letterSpacing: '-0.017em' }],
        xl: ['1.25rem', { lineHeight: '1.5', letterSpacing: '-0.017em' }],
        '2xl': ['1.5rem', { lineHeight: '1.415', letterSpacing: '-0.037em' }],
        '3xl': ['1.875rem', { lineHeight: '1.3333', letterSpacing: '-0.037em' }],
        '4xl': ['2.25rem', { lineHeight: '1.2777', letterSpacing: '-0.037em' }],
        '5xl': ['3rem', { lineHeight: '1', letterSpacing: '-0.037em' }],
        '6xl': ['4rem', { lineHeight: '1', letterSpacing: '-0.037em' }],
        '7xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.037em' }],
      },
      maxWidth: {
        '2xl': '40rem',
        '8xl': '85rem',
      },
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
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
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
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'collapsible-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-collapsible-content-height)' },
        },
        'collapsible-up': {
          from: { height: 'var(--radix-collapsible-content-height)' },
          to: { height: '0' },
        },
        breath: {
          '0%, 100%': { transform: 'scale(0.95)' },
          '50%': { transform: 'scale(1.1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5%)' },
        },
        line: {
          '0%, 100%': { left: '0', opacity: '0' },
          '50%': { left: '100%', transform: 'translateX(-100%)' },
          '10%, 40%, 60%, 90%': { opacity: '0' },
          '25%, 75%': { opacity: '1' },
        },
        'infinite-scroll': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-100%)' },
        },
        breathe: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        shake: {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0)' },
          '25%': { transform: 'translate(-2px, 0) rotate(-1deg)' },
          '50%': { transform: 'translate(2px, 0) rotate(1deg)' },
          '75%': { transform: 'translate(-2px, 0) rotate(-1deg)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'collapsible-down': 'collapsible-down 0.2s ease-out',
        'collapsible-up': 'collapsible-up 0.2s ease-out',
        breath: 'breath 1.5s infinite',
        float: 'float 3s infinite',
        line: 'line 2s linear infinite',
        'infinite-scroll': 'infinite-scroll 10s linear infinite',
        breathe: 'breathe 3s ease-in-out infinite',
        shake: 'shake 0.3s ease-in-out',
      },
      height: {
        dynamic: 'calc(90vh - 250px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
} satisfies Config

export default config
