import { View, Text } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Waves, Pin } from './icons';
import { COLORS } from './ui';

const MAX_DOTS = 5;

/**
 * The Wavelength mark on the left; one live dot per listener playing right
 * now on the right (a ring stands in for "more"). No words.
 */
export default function MarkHeader({
  topInset,
  liveCount,
  place,
  title,
  right,
}: {
  topInset: number;
  liveCount?: number;
  /** Where you are, shown beside the mark with a pin. */
  place?: string | null;
  /** Which page this is, shown beside the mark when there's no place. */
  title?: string;
  right?: React.ReactNode;
}) {
  const dots = Math.min(liveCount ?? 0, MAX_DOTS);
  return (
    <View style={{ paddingTop: topInset + 10 }} className="px-5 pb-3 flex-row items-center justify-between">
      <View className="flex-row items-center flex-1 mr-4">
        <Waves size={34} strokeWidth={1.7} />
        {place ? (
          <Animated.View
            entering={FadeIn.duration(400)}
            className="flex-row items-center ml-4 flex-shrink"
            accessibilityLabel={`Near ${place}`}
          >
            <Pin size={15} color={COLORS.inkMuted} />
            <Text className="font-mono text-[13px] text-ink-muted ml-1.5" numberOfLines={1}>
              {place}
            </Text>
          </Animated.View>
        ) : title ? (
          <Text className="font-mono text-[15px] text-ink-muted ml-4" accessibilityRole="header">
            {title}
          </Text>
        ) : null}
      </View>
      {right ?? (
        <View
          className="flex-row items-center gap-1.5"
          accessibilityLabel={`${liveCount ?? 0} playing now`}
        >
          {Array.from({ length: dots }, (_, i) => (
            <Animated.View
              key={i}
              entering={ZoomIn.delay(i * 60).springify()}
              style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.live }}
            />
          ))}
          {(liveCount ?? 0) > MAX_DOTS && (
            <View style={{ width: 7, height: 7, borderRadius: 3.5, borderWidth: 1.5, borderColor: COLORS.live }} />
          )}
        </View>
      )}
    </View>
  );
}
