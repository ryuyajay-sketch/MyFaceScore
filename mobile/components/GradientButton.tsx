import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radius } from '../lib/theme';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function GradientButton({ title, onPress, disabled, style, textStyle }: GradientButtonProps) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [{ opacity: pressed ? 0.85 : disabled ? 0.4 : 1 }, style]}>
      <LinearGradient
        colors={[colors.indigo[600], colors.purple[600]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <Text style={[styles.text, textStyle]}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  text: {
    color: colors.white,
    fontFamily: fonts.semiBold,
    fontSize: 16,
  },
});
