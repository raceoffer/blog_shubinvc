import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Тёплая «бумажная» нейтральная палитра + один акцент.
        paper: 'rgb(var(--c-bg) / <alpha-value>)',
        ink: 'rgb(var(--c-text) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        accentink: 'rgb(var(--c-accent-ink) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
      },
      fontFamily: {
        serif: ['"EB Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      maxWidth: {
        prose: '68ch',
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': 'rgb(var(--c-text))',
            '--tw-prose-headings': 'rgb(var(--c-text))',
            '--tw-prose-lead': 'rgb(var(--c-muted))',
            '--tw-prose-links': 'rgb(var(--c-text))',
            '--tw-prose-bold': 'rgb(var(--c-text))',
            '--tw-prose-counters': 'rgb(var(--c-muted))',
            '--tw-prose-bullets': 'rgb(var(--c-muted))',
            '--tw-prose-hr': 'rgb(var(--c-line))',
            '--tw-prose-quotes': 'rgb(var(--c-text))',
            '--tw-prose-quote-borders': 'rgb(var(--c-accent-ink))',
            '--tw-prose-captions': 'rgb(var(--c-muted))',
            '--tw-prose-code': 'rgb(var(--c-text))',
            '--tw-prose-pre-code': '#e5e5e5',
            '--tw-prose-pre-bg': '#1c1c1e',
            '--tw-prose-th-borders': 'rgb(var(--c-line))',
            '--tw-prose-td-borders': 'rgb(var(--c-line))',
            maxWidth: '68ch',
            fontSize: '1.1875rem',
            lineHeight: '1.72',
            a: {
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              textDecorationColor: 'rgb(var(--c-muted))',
              textDecorationThickness: '1px',
              fontWeight: '400',
            },
            'a:hover': {
              textDecorationColor: 'rgb(var(--c-text))',
            },
            'h1, h2, h3, h4': {
              fontFamily: '"EB Garamond", Georgia, serif',
              fontWeight: '600',
              letterSpacing: '-0.01em',
            },
            h2: { fontSize: '1.65em', marginTop: '2.2em' },
            h3: { fontSize: '1.3em' },
            blockquote: {
              fontStyle: 'normal',
              fontWeight: '400',
              borderLeftWidth: '2px',
            },
            img: { borderRadius: '4px' },
          },
        },
      }),
    },
  },
  plugins: [typography],
};
