import { useEffect } from 'react';
import { View, Image, Text } from 'react-native';
import Animated, {
  FadeInDown,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { FeedBroadcast } from '../services/api';
import { PressableScale, STAGGER } from './motion';
import { COLORS } from './ui';

const SIX_HOURS = 6 * 60 * 60 * 1000;

/** One equalizer bar: rises and falls on its own rhythm, forever. */
function Bar({ delay, peak, color }: { delay: number; peak: number; color: string }) {
  const h = useSharedValue(0.25);
  useEffect(() => {
    h.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(peak, { duration: 380, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.2, { duration: 420, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
  }, [delay, peak, h]);
  const style = useAnimatedStyle(() => ({ height: `${h.value * 100}%` }));
  return <Animated.View style={[{ width: 3, borderRadius: 1.5, backgroundColor: color }, style]} />;
}

/** Three moving bars: in the corner of a live cover, and as the "now" marker. */
export function Equalizer({ color = COLORS.ink, height = 16, style }: { color?: string; height?: number; style?: object }) {
  return (
    <View style={[{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 2.5 }, style]} pointerEvents="none">
      <Bar delay={0} peak={0.9} color={color} />
      <Bar delay={140} peak={0.65} color={color} />
      <Bar delay={260} peak={1} color={color} />
    </View>
  );
}

/** Live covers breathe; it's the one place still content is allowed to move. */
function useBreath(live: boolean) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = live
      ? withRepeat(withTiming(1.02, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true)
      : withTiming(1, { duration: 300 });
  }, [live, s]);
  return useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
}

/**
 * Earlier covers fade with age: 0.85 just after ending, down to 0.35 at the
 * edge of the 6h window. Recency is visible without "39m".
 */
function ageOpacity(play: FeedBroadcast): number {
  if (play.isLive) return 1;
  const age = Math.min(Math.max(Date.now() - (play.endedAt ?? play.startedAt), 0), SIX_HOURS);
  return 0.85 - (age / SIX_HOURS) * 0.5;
}

interface CoverTileProps {
  play: FeedBroadcast;
  index: number;
  size: number;
  onOpen: (play: FeedBroadcast) => void;
}

export default function CoverTile({ play, index, size, onOpen }: CoverTileProps) {
  const breath = useBreath(play.isLive);
  return (
    <Animated.View entering={FadeInDown.delay(index * STAGGER).springify().damping(16)} style={{ width: size }}>
      <PressableScale
        onPress={() => onOpen(play)}
        accessibilityLabel={`${play.trackTitle} by ${play.artistName}${play.isLive ? ', playing now' : ''}`}
      >
        <Animated.View style={[{ width: size, height: size, borderRadius: 10, overflow: 'hidden', backgroundColor: COLORS.night }, breath]}>
          <Image
            source={{ uri: play.albumArtUrl }}
            style={{ width: '100%', height: '100%', opacity: ageOpacity(play) }}
          />
          {play.isLive && <Equalizer style={{ position: 'absolute', right: 10, bottom: 10 }} />}
        </Animated.View>
        <Text className="font-mono-medium text-ink mt-2" style={{ fontSize: play.isLive ? 14 : 12 }} numberOfLines={1}>
          {play.trackTitle}
        </Text>
        <Text className="font-mono text-ink-dim mt-0.5" style={{ fontSize: play.isLive ? 12 : 11 }} numberOfLines={1}>
          {play.artistName}
        </Text>
      </PressableScale>
    </Animated.View>
  );
}
