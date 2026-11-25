import type { ReactNode } from 'react';
import {
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useInspectorTheme } from '@/constants/inspector-theme';

interface AppScreenProps {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

export function AppScreen({ children, contentStyle }: AppScreenProps) {
  const colors = useInspectorTheme();

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.screenContent, contentStyle]}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

interface ScreenHeadingProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  accessory?: ReactNode;
}

export function ScreenHeading({
  eyebrow,
  title,
  subtitle,
  accessory,
}: ScreenHeadingProps) {
  const colors = useInspectorTheme();

  return (
    <View style={styles.heading}>
      <View style={styles.headingCopy}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>{eyebrow}</Text>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>
      </View>
      {accessory}
    </View>
  );
}

interface SurfaceProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Surface({ children, style }: SurfaceProps) {
  const colors = useInspectorTheme();
  return (
    <View
      style={[
        styles.surface,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}>
      {children}
    </View>
  );
}

interface UiButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean;
  compact?: boolean;
}

export function UiButton({
  label,
  onPress,
  variant = 'secondary',
  disabled = false,
  compact = false,
}: UiButtonProps) {
  const colors = useInspectorTheme();
  const backgroundColor =
    variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.elevated
          : 'transparent';
  const textColor =
    variant === 'primary'
      ? colors.background
      : variant === 'danger'
        ? '#FFFFFF'
        : variant === 'quiet'
          ? colors.accent
          : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor, opacity: disabled ? 0.45 : pressed ? 0.78 : 1 },
        variant === 'secondary' && { borderColor: colors.border, borderWidth: 1 },
      ]}>
      <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
  hint?: string;
  style?: StyleProp<TextStyle>;
}

export function Field({ label, hint, style, ...inputProps }: FieldProps) {
  const colors = useInspectorTheme();

  return (
    <View style={styles.field}>
      <View style={styles.fieldHeading}>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
        {hint ? <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text> : null}
      </View>
      <TextInput
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        style={[
          styles.input,
          {
            backgroundColor: colors.elevated,
            borderColor: colors.border,
            color: colors.text,
          },
          style,
        ]}
        {...inputProps}
      />
    </View>
  );
}

interface BadgeProps {
  label: string;
  color?: string;
}

export function Badge({ label, color }: BadgeProps) {
  const colors = useInspectorTheme();
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: color ? `${color}22` : colors.accentSurface },
      ]}>
      <Text style={[styles.badgeText, { color: color ?? colors.accent }]}>{label}</Text>
    </View>
  );
}

interface EmptyStateProps {
  title: string;
  body: string;
}

export function EmptyState({ title, body }: EmptyStateProps) {
  const colors = useInspectorTheme();
  return (
    <Surface style={styles.emptyState}>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.muted }]}>{body}</Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  screenContent: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 84 : 16,
    paddingBottom: 36,
    gap: 18,
  },
  heading: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headingCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  surface: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  button: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonCompact: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 11,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  field: {
    gap: 7,
  },
  fieldHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    fontSize: 11,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 99,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  emptyState: {
    alignItems: 'flex-start',
    paddingVertical: 22,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
  },
});
