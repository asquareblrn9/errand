import { colors } from './colors';

export const theme = {
  colors,
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 } as const,
  // Aligned with the web design system: cards 20, inputs/buttons 11, pills full.
  radius: { sm: 6, md: 11, lg: 20, xl: 24, full: 9999 } as const,
  fontSize: {
    xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36, '5xl': 48,
  } as const,
  fontFamily: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    heading: 'Sora_700Bold',
    headingSemi: 'Sora_600SemiBold',
    headingExtra: 'Sora_800ExtraBold',
    mono: 'JetBrainsMono_400Regular',
    monoBold: 'JetBrainsMono_600SemiBold',
  } as const,
  /** Shared card shadow matching the web card style. */
  cardShadow: {
    shadowColor: '#0A1628',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  } as const,
} as const;

export { colors };
