import type { Config } from 'tailwindcss';
import { colors, radius } from '@storyme/design-tokens';

// Web Tailwind theme derived from the shared design tokens so web + mobile match.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        ink: colors.ink,
        accent: colors.accent,
        success: colors.semantic.success,
        danger: colors.semantic.danger,
      },
      borderRadius: {
        sm: `${radius.sm}px`,
        md: `${radius.md}px`,
        lg: `${radius.lg}px`,
        xl: `${radius.xl}px`,
      },
      fontFamily: {
        display: ['Bangers', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
