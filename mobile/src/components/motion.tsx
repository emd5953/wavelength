/**
 * Motion system (docs/specs/art-first.md): shared springs, a press-scale
 * wrapper, and haptics, so every interaction moves and feels the same.
 */

import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export const SPRING = {
  /** Finger down/up on anything tappable. */
  press: { damping: 18, stiffness: 320, mass: 0.6 },
  /** Things appearing: a reaction filling, a new cover arriving. */
  pop: { damping: 10, stiffness: 260, mass: 0.7 },
  /** Things moving into place: the tab dot, a screen settling. */
  settle: { damping: 20, stiffness: 180, mass: 0.9 },
} as const;

/** Delay between items entering in sequence, in ms. */
export const STAGGER = 30;

export const haptic = {
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  pop: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  select: () => Haptics.selectionAsync().catch(() => {}),
};

interface PressableScaleProps {
  onPress: () => void;
  onLongPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How far it shrinks under the finger. */
  scaleTo?: number;
  accessibilityLabel: string;
  accessibilityRole?: 'button' | 'tab' | 'link';
  accessibilityState?: { selected?: boolean };
}

/** Anything tappable: springs down under the finger and ticks a light haptic. */
export function PressableScale({
  onPress,
  onLongPress,
  children,
  style,
  scaleTo = 0.96,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPressIn={() => (scale.value = withSpring(scaleTo, SPRING.press))}
      onPressOut={() => (scale.value = withSpring(1, SPRING.press))}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      onLongPress={onLongPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}
