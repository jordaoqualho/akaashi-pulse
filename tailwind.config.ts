import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        wash: 'var(--wash)',
        sunken: 'var(--sunken)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        side: 'var(--side)',
        'side-hover': 'var(--side-hover)',
        'side-active': 'var(--side-active)',
        'side-line': 'var(--side-line)',
        'side-text': 'var(--side-text)',
        'side-faint': 'var(--side-faint)',
        'brand-red': 'var(--red)',
        'red-bg': 'var(--red-bg)',
        'red-line': 'var(--red-line)',
        amber: 'var(--amber-text)',
        'amber-bg': 'var(--amber-bg)',
        'amber-line': 'var(--amber-line)',
        green: 'var(--green-text)',
        'green-bg': 'var(--green-bg)',
        'green-line': 'var(--green-line)',
        blue: 'var(--blue-text)',
        'blue-bg': 'var(--blue-bg)',
        'blue-line': 'var(--blue-line)',
        bg: {
          DEFAULT: 'rgb(var(--bg-base) / <alpha-value>)',
          surface: 'rgb(var(--bg-surface) / <alpha-value>)',
          'surface-hi': 'rgb(var(--bg-surface-hi) / <alpha-value>)',

          elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          hi: 'rgb(var(--border-hi) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--text-tertiary) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          hover: 'rgb(var(--brand-hover) / <alpha-value>)',

          strong: 'rgb(var(--brand-strong) / <alpha-value>)',
        },
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        chart: {
          input: 'rgb(var(--chart-input) / <alpha-value>)',
          output: 'rgb(var(--chart-output) / <alpha-value>)',
          'cache-read': 'rgb(var(--chart-cache-read) / <alpha-value>)',
          'cache-create': 'rgb(var(--chart-cache-create) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      borderRadius: {
        card: '12px',
        button: '8px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        popover: 'var(--shadow-popover)',
      },
      transitionTimingFunction: {
        'out-soft': 'var(--ease-out-soft)',
      },
      gridTemplateColumns: {

        24: 'repeat(24, minmax(0, 1fr))',
      },
    },
  },
  plugins: [],
};

export default config;
