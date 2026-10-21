import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Waves, Ripple, Pair, Self, type IconProps } from './icons';
import { PressableScale, SPRING, haptic } from './motion';
import { COLORS } from './ui';

const ICONS: Record<string, { Icon: (p: IconProps) => React.ReactElement; label: string }> = {
  'nearby-feed': { Icon: Waves, label: 'Nearby' },
  map: { Icon: Ripple, label: 'Map' },
  connections: { Icon: Pair, label: 'People' },
  profile: { Icon: Self, label: 'You' },
};

/** Icons only. A live-colored dot springs to whichever tab is active. */
export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const slot = width / state.routes.length;
  const x = useSharedValue(0);

  useEffect(() => {
    if (slot) x.value = withSpring(slot * state.index + slot / 2 - 2, SPRING.settle);
  }, [state.index, slot, x]);

  const dot = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      style={{ paddingBottom: insets.bottom + 6, backgroundColor: COLORS.night, borderTopColor: COLORS.rule, borderTopWidth: 1 }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <View className="flex-row pt-3.5 pb-2">
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const entry = ICONS[route.name];
          if (!entry) return null;
          const { Icon, label } = entry;
          return (
            <View key={route.key} className="flex-1 items-center">
              <PressableScale
                scaleTo={0.86}
                accessibilityLabel={label}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                onPress={() => {
                  if (!focused) {
                    haptic.select();
                    navigation.navigate(route.name);
                  }
                }}
              >
                <Icon size={27} color={focused ? COLORS.ink : COLORS.inkDim} />
              </PressableScale>
            </View>
          );
        })}
      </View>
      {slot > 0 && (
        <Animated.View
          style={[{ position: 'absolute', top: 47, width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.live }, dot]}
        />
      )}
    </View>
  );
}
