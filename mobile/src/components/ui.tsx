/**
 * Shared primitives for the sky + Paper Mono system (docs/design/222-reference.md).
 * Screens compose these instead of restating colors, borders, and type.
 */

import type { ReactNode } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, type ViewProps } from 'react-native';

// Raw values for props that don't take classNames (spinners, switches, sliders).
export const COLORS = {
  night: '#051F33',
  ground: '#082F49',
  groundLift: '#0C4A6E',
  primary: '#075985',
  ink: '#F0F9FF',
  inkMuted: 'rgba(224, 242, 254, 0.65)',
  inkDim: 'rgba(186, 230, 253, 0.45)',
  rule: 'rgba(240, 249, 255, 0.15)',
  live: '#38BDF8',
} as const;

/** Full-height page on the ground color. */
export function Screen({ className = '', ...props }: ViewProps & { className?: string }) {
  return <View className={`flex-1 bg-ground ${className}`} {...props} />;
}

/** Large light page title for tab screens, matching the feed header. */
export function PageTitle({ title, subtitle, topInset }: { title: string; subtitle?: string; topInset: number }) {
  return (
    <View style={{ paddingTop: topInset + 12 }} className="px-6 pb-4">
      <Text className="font-mono-light text-[32px] text-ink">{title}</Text>
      {subtitle ? <Text className="font-mono text-[13px] text-ink-dim mt-1">{subtitle}</Text> : null}
    </View>
  );
}

/** Translucent card: no shadow, hairline border. */
export function Card({ className = '', ...props }: ViewProps & { className?: string }) {
  return <View className={`rounded-[14px] bg-card border border-rule ${className}`} {...props} />;
}

/** Tracked uppercase label on a hairline that runs to the edge. */
export function SectionLabel({ title, className = '' }: { title: string; className?: string }) {
  return (
    <View className={`flex-row items-center ${className}`}>
      <Text className="font-mono-medium text-[11px] text-ink-dim" style={{ letterSpacing: 1.5 }}>
        {title}
      </Text>
      <View className="flex-1 h-px bg-rule ml-3" />
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  className?: string;
}

/** The one filled action on a screen. */
export function PrimaryButton({ label, onPress, disabled, loading, accessibilityLabel, className = '' }: ButtonProps) {
  return (
    <TouchableOpacity
      className={`py-4 rounded-full items-center bg-primary ${disabled ? 'opacity-50' : ''} ${className}`}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.ink} />
      ) : (
        <Text className="font-mono-medium text-[15px] text-ink" style={{ letterSpacing: 1 }}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

/** Secondary action: outlined, quiet. */
export function OutlineButton({ label, onPress, disabled, loading, accessibilityLabel, className = '' }: ButtonProps) {
  return (
    <TouchableOpacity
      className={`py-4 rounded-full items-center border border-rule ${className}`}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.inkMuted} />
      ) : (
        <Text className="font-mono text-[15px] text-ink-muted">{label}</Text>
      )}
    </TouchableOpacity>
  );
}

/** Plain text action, like 222's "no" or "details". */
export function TextButton({ label, onPress, disabled, accessibilityLabel, className = '' }: ButtonProps) {
  return (
    <TouchableOpacity
      className={className}
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text className={`font-mono text-[13px] ${disabled ? 'text-ink-dim' : 'text-ink-muted'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Lowercase title + body, no emoji. */
export function EmptyState({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <View className="px-10 mt-20">
      <Text className="font-mono-light text-xl text-ink">{title}</Text>
      {body ? <Text className="font-mono text-[13px] text-ink-muted mt-3 leading-6">{body}</Text> : null}
      {children}
    </View>
  );
}

export function Spinner() {
  return (
    <Screen className="justify-center items-center">
      <ActivityIndicator color={COLORS.inkDim} />
    </Screen>
  );
}
