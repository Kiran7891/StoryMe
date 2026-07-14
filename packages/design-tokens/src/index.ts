/**
 * StoryMe brand design tokens — the single source of truth for color, type, spacing,
 * radius, and shadow. Consumed by the web Tailwind theme and the mobile NativeWind
 * theme so both platforms render one visual system.
 */

export const colors = {
  // Brand — playful comic-ink + sunset accent
  brand: {
    50: '#FFF1F0',
    100: '#FFE0DC',
    200: '#FFC0B8',
    300: '#FF9585',
    400: '#FF6B52',
    500: '#F5451F', // primary
    600: '#D4330F',
    700: '#A9270C',
    800: '#7E1E0B',
    900: '#5A1709',
  },
  ink: {
    50: '#F6F7F9',
    100: '#E9ECF1',
    200: '#CBD2DE',
    300: '#9AA6BC',
    400: '#6B7A96',
    500: '#4A5875',
    600: '#374357',
    700: '#232D42',
    800: '#161C2B',
    900: '#0B0F18', // comic ink
  },
  accent: {
    yellow: '#FFC93C',
    teal: '#2CC7B0',
    violet: '#7C5CFC',
  },
  semantic: {
    success: '#1FA971',
    warning: '#E8A317',
    danger: '#E23A45',
    info: '#2B7FFF',
  },
} as const;

export const typography = {
  fontFamily: {
    display: 'Bangers, "Comic Neue", system-ui, sans-serif', // comic title feel
    sans: 'Inter, system-ui, -apple-system, sans-serif',
    mono: 'JetBrains Mono, ui-monospace, monospace',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },
  fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  lineHeight: { tight: 1.15, normal: 1.5, relaxed: 1.7 },
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const shadow = {
  sm: '0 1px 2px rgba(11,15,24,0.08)',
  md: '0 4px 12px rgba(11,15,24,0.12)',
  lg: '0 12px 32px rgba(11,15,24,0.18)',
  // Comic panel border shadow
  panel: '4px 4px 0 rgba(11,15,24,1)',
} as const;

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export const tokens = { colors, typography, spacing, radius, shadow, breakpoints } as const;
export type Tokens = typeof tokens;
