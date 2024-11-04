// uno.config.ts
import extractorSvelte from "@unocss/extractor-svelte"
import { defineConfig, presetUno, transformerDirectives } from "unocss"


// function generateColorVariables(hue: number, chroma: number = 0.15) {
//   // Generate primary scale
//   const primaryScale = Array.from({ length: 10 }, (_, i) => {
//     const lightness = 0.95 - (i * (0.45 / 9))
//     return {
//       [`--p${i}`]: `oklch(${lightness} ${chroma} var(--color-hue))`
//     }
//   })

//   // Generate neutral scale with reduced chroma
//   const neutralScale = Array.from({ length: 16 }, (_, i) => {
//     const lightness = 0.99 - (i * (0.89 / 15))
//     return {
//       [`--gray-${i}`]: `oklch(${lightness} ${0.005} var(--color-hue))`
//     }
//   })

//   return Object.assign({}, ...primaryScale, ...neutralScale)
// }

export default defineConfig({
  presets: [presetUno()],
  extractors: [extractorSvelte()],
  transformers: [transformerDirectives()],
  theme: {
    colors: {
      // Primary color scale
      primary: {
        DEFAULT: 'oklch(from var(--p5) l c h / <alpha-value>)',
        hover: 'oklch(from var(--p6) l c h / <alpha-value>)',
        active: 'oklch(from var(--p7) l c h / <alpha-value>)',
        subtle: 'oklch(from var(--p2) l c h / <alpha-value>)',
        muted: 'oklch(from var(--p1) l c h / <alpha-value>)',
        inverse: 'oklch(from var(--p0) l c h / <alpha-value>)',
        ...Array.from({ length: 10 }, (_, i) => ({
          [i]: `oklch(from var(--p${i}) l c h / <alpha-value>)`
        })).reduce((acc, val) => ({ ...acc, ...val }), {})
      },

      // Background colors using semantic names
      bg: {
        DEFAULT: 'oklch(from var(--bg-default) l c h / <alpha-value>)',
        subtle: 'oklch(from var(--bg-subtle) l c h / <alpha-value>)',
        surface: 'oklch(from var(--bg-surface) l c h / <alpha-value>)',
        sunken: 'oklch(from var(--bg-sunken) l c h / <alpha-value>)',
        hover: 'oklch(from var(--bg-subtle) l c h / <alpha-value>)',
        selected: 'oklch(from var(--bg-sunken) l c h / <alpha-value>)',
      },

      // Text colors using semantic names
      text: {
        DEFAULT: 'oklch(from var(--text-default) l c h / <alpha-value>)',
        muted: 'oklch(from var(--text-muted) l c h / <alpha-value>)',
        subtle: 'oklch(from var(--text-subtle) l c h / <alpha-value>)',
        inverse: 'oklch(from var(--bg-default) l c h / <alpha-value>)',
        link: 'oklch(from var(--p5) l c h / <alpha-value>)',
      },

      // Border colors using semantic names
      border: {
        DEFAULT: 'oklch(from var(--border-default) l c h / <alpha-value>)',
        subtle: 'oklch(from var(--border-subtle) l c h / <alpha-value>)',
        focus: 'oklch(from var(--p5) l c h / <alpha-value>)',
        interactive: 'oklch(from var(--border-default) l c h / <alpha-value>)'
      },

      // Status colors
      status: {
        success: 'oklch(0.7 0.15 145)',
        warning: 'oklch(0.7 0.15 75)',
        error: 'oklch(0.7 0.15 25)',
        info: 'oklch(0.7 0.15 240)'
      }
    }
  },
  shortcuts: {
    // Layout patterns
    'layout': 'grid max-w-4xl mx-auto px-4 py-12',
    'stack': 'flex flex-col gap-4',
    'cluster': 'flex flex-wrap gap-2',
    'grid-list': 'grid gap-4 grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]',

    // Common components
    'card': 'bg-bg-surface p-6 rounded-lg border border-border-subtle',
    'input': 'w-full px-3 py-2 bg-bg-sunken border border-border-default rounded-md transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',

    // Button variants
    'btn': 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50',
    'btn-primary': 'btn bg-primary text-primary-inverse hover:bg-primary-hover active:bg-primary-active',
    'btn-secondary': 'btn bg-bg-subtle text-text-default hover:bg-bg-hover active:bg-bg-sunken',
    'btn-outline': 'btn border border-border-default text-text-default hover:bg-bg-hover active:bg-bg-sunken',
    'btn-ghost': 'btn text-text-default hover:bg-bg-hover active:bg-bg-sunken',

    // Typography
    'prose': 'max-w-prose leading-7',
    'heading-1': 'text-4xl font-bold tracking-tight',
    'heading-2': 'text-3xl font-bold tracking-tight',
    'heading-3': 'text-2xl font-bold',
    'heading-4': 'text-xl font-bold',

    // Common utilities
    'interactive': 'transition-colors hover:bg-bg-hover active:bg-bg-sunken',
    'focusable': 'focus:outline-none focus:ring-2 focus:ring-primary/20',
    'scrollable': 'overflow-auto',
    'truncate': 'overflow-hidden text-ellipsis whitespace-nowrap'
  }
})