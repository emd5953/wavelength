import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { ReactionCount } from '../services/api';
import { addReaction, getReactionCounts } from '../services/api';
import { REACTION_ICONS } from './icons';
import { PressableScale, SPRING, haptic } from './motion';
import { COLORS } from './ui';

// Server types are unchanged; the icons are ours. Order is the visual rhythm.
const ORDER = ['fire', 'heart', 'headphones', 'clap', 'surprised'] as const;
const NAMES: Record<(typeof ORDER)[number], string> = {
  fire: 'fire',
  heart: 'love',
  headphones: 'same',
  clap: 'yes',
  surprised: 'new to me',
};

const PARTICLES = 6;

/** Six sky specks fly out from the icon and fade. Re-fires whenever `shot` changes. */
function Burst({ shot }: { shot: number }) {
  const t = useSharedValue(1);
  useEffect(() => {
    if (shot === 0) return;
    t.value = 0;
    t.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
  }, [shot, t]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: PARTICLES }, (_, i) => (
        <Particle key={i} angle={(i / PARTICLES) * Math.PI * 2 - Math.PI / 2} t={t} />
      ))}
    </View>
  );
}

function Particle({ angle, t }: { angle: number; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 1 ? 1 - t.value : 0,
    transform: [
      { translateX: Math.cos(angle) * 22 * t.value },
      { translateY: Math.sin(angle) * 22 * t.value },
      { scale: 1 - t.value * 0.5 },
    ],
  }));
  return <Animated.View style={[{ position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.live }, style]} />;
}

function ReactionButton({
  type,
  count,
  mine,
  onReact,
}: {
  type: (typeof ORDER)[number];
  count: number;
  mine: boolean;
  onReact: () => void;
}) {
  const Icon = REACTION_ICONS[type];
  const [shot, setShot] = useState(0);
  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <PressableScale
      scaleTo={0.85}
      accessibilityLabel={`React: ${NAMES[type]}${count ? `, ${count}` : ''}`}
      onPress={() => {
        haptic.pop();
        setShot((s) => s + 1);
        pop.value = withSequence(withSpring(1.25, SPRING.pop), withSpring(1, SPRING.pop));
        onReact();
      }}
    >
      <View className="items-center" style={{ width: 52 }}>
        <View style={{ width: 52, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Burst shot={shot} />
          <Animated.View style={popStyle}>
            <Icon size={30} color={mine ? COLORS.live : COLORS.inkMuted} filled={mine} />
          </Animated.View>
        </View>
        <Text className="font-mono text-[11px] text-ink-dim h-4">{count > 0 ? count : ''}</Text>
      </View>
    </PressableScale>
  );
}

/** The five reactions as our icons. Tapping one fills it, bursts, and ticks a haptic. */
export default function Reactions({ broadcastId }: { broadcastId: string }) {
  const [counts, setCounts] = useState<ReactionCount>({});
  // The server only returns totals, so "mine" is what you've tapped on this visit
  const [mine, setMine] = useState<Set<string>>(new Set());

  useEffect(() => {
    getReactionCounts(broadcastId)
      .then((res) => setCounts(res.counts))
      .catch(() => {});
  }, [broadcastId]);

  const react = async (type: string) => {
    setMine((prev) => new Set(prev).add(type));
    try {
      const result = await addReaction(broadcastId, type);
      setCounts(result.counts);
    } catch {
      // silently fail
    }
  };

  return (
    <View className="flex-row justify-between">
      {ORDER.map((type) => (
        <ReactionButton key={type} type={type} count={counts[type] ?? 0} mine={mine.has(type)} onReact={() => react(type)} />
      ))}
    </View>
  );
}
