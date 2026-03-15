import { View, ViewStyle, StyleSheet } from 'react-native';
import { colors, radius } from '../lib/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
}

export function GlassCard({ children, style, elevated }: GlassCardProps) {
  return (
    <View style={[styles.base, elevated && styles.elevated, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
  },
  elevated: {
    backgroundColor: colors.elevated,
    borderColor: colors.borderHighlight,
  },
});
