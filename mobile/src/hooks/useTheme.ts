import { useColorScheme } from 'react-native';
import { colors } from '../theme/colors';

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  return {
    isDark,
    bg: isDark ? colors.dark.bg : colors.neutral[50],
    cardBg: isDark ? colors.dark.card : colors.white,
    border: isDark ? colors.dark.border : colors.neutral[100],
    text: isDark ? colors.white : colors.neutral[600],
    textSecondary: isDark ? colors.neutral[400] : colors.neutral[400],
    primary: colors.primary[500],
  };
}
