import { View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Waves } from './icons';
import { COLORS } from './ui';

const MAX_DOTS = 5;

/**
 * The Wavelength mark on the left; one live dot per listener playing right
 * now on the right (a ring stands in for "more"). No words.
 */
export default function MarkHeader({ topInset, liveCount, right }: { topInset: number; liveCount?: number; right?: React.ReactNode }) {
  const dots = Math.min(liveCount ?? 0, MAX_DOTS);
  return (
    <View style={{ paddingTop: topInset + 10 }} className="px-5 pb-3 flex-row items-center justify-between">
      <Waves size={34} strokeWidth={1.7} />
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
