import { colors } from './colors';

export const theme = {
  colors,
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 } as const,
  radius: { sm: 6, md: 12, lg: 16, xl: 24, full: 9999 } as const,
  fontSize: {
    xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36, '5xl': 48,
  } as const,
  fontFamily: { regular: 'Inter', medium: 'Inter-Medium', semibold: 'Inter-SemiBold', bold: 'Inter-Bold', mono: 'JetBrainsMono' },
} as const;

export { colors };
