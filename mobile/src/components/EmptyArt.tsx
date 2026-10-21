import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { COLORS } from './ui';

const APath = Animated.createAnimatedComponent(Path);
const ARect = Animated.createAnimatedComponent(Rect);
const ACircle = Animated.createAnimatedComponent(Circle);

/** Strokes draw themselves in, one after another. Lengths are generous upper bounds. */
function useDraw(delay: number, length: number) {
  const t = useSharedValue(length);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(0, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [delay, length, t]);
  return useAnimatedProps(() => ({ strokeDashoffset: t.value }));
}

const line = { stroke: COLORS.inkMuted, strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

/**
 * A listener with headphones, alone in a window — the empty room.
 * One line drawing in the spirit of the icon set, plus at most four words.
 */
export default function EmptyArt({ caption }: { caption: string }) {
  const window = useDraw(0, 400);
  const head = useDraw(350, 80);
  const body = useDraw(550, 160);
  const phones = useDraw(800, 90);
  const note = useDraw(1100, 60);

  return (
    <View className="items-center mt-24" accessibilityLabel={caption}>
      <Svg width={180} height={180} viewBox="0 0 120 120">
        <ARect x={22} y={14} width={76} height={92} rx={3} strokeDasharray={400} animatedProps={window} {...line} />
        <ACircle cx={58} cy={52} r={11} strokeDasharray={80} animatedProps={head} {...line} />
        <APath d="M36 106 C36 84 44 72 58 72 C72 72 80 84 80 106" strokeDasharray={160} animatedProps={body} {...line} />
        <APath d="M45 53 C45 41 51 36 58 36 C65 36 71 41 71 53 M44 51 V57 M72 51 V57" strokeDasharray={90} animatedProps={phones} {...line} />
        <APath d="M86 30 C88 27 91 26 93 27 V38 M93 38 C93 40 90 41 89 39 C88 37 91 36 93 38" strokeDasharray={60} animatedProps={note} {...line} />
      </Svg>
      <Text className="font-mono text-[13px] text-ink-dim mt-4">{caption}</Text>
    </View>
  );
}
