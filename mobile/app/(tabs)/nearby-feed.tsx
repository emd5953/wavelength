import { View, ScrollView, ActivityIndicator, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import CoverTile, { Equalizer } from '../../src/components/CoverTile';
import MarkHeader from '../../src/components/MarkHeader';
import EmptyArt from '../../src/components/EmptyArt';
import { Clock } from '../../src/components/icons';
import { PressableScale } from '../../src/components/motion';
import { COLORS } from '../../src/components/ui';
import { useNearbyFeed, rememberPlay } from '../../src/services/nearbyFeed';
import type { FeedBroadcast } from '../../src/services/api';

const EDGE = 16;
const GUTTER = 12;

/** A section marker: one icon, one dim word. */
function Marker({ icon, word }: { icon: React.ReactNode; word: string }) {
  return (
    <View className="flex-row items-center gap-2 mb-3" style={{ paddingHorizontal: EDGE }} accessibilityRole="header">
      {icon}
      <Text className="font-mono text-[12px] text-ink-dim">{word}</Text>
    </View>
  );
}

/**
 * Nearby as a record crate. Now: large covers, two across, moving.
 * Earlier: smaller covers, three across, fading with age.
 */
export default function NearbyFeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { broadcasts, loading, error, reload } = useNearbyFeed();
  const live = broadcasts.filter((b) => b.isLive);
  const earlier = broadcasts.filter((b) => !b.isLive);
  const big = (width - EDGE * 2 - GUTTER) / 2;
  const small = (width - EDGE * 2 - GUTTER * 2) / 3;

  const openPlay = (b: FeedBroadcast) => {
    rememberPlay(b);
    router.push(`/play?broadcastId=${b.id}`);
  };

  const header = <MarkHeader topInset={insets.top} liveCount={live.length} />;

  if (loading) {
    return (
      <View className="flex-1 bg-ground">
        {header}
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color={COLORS.inkDim} />
        </View>
      </View>
    );
  }

  if (error || broadcasts.length === 0) {
    return (
      <View className="flex-1 bg-ground">
        {header}
        {error ? (
          <PressableScale onPress={reload} accessibilityLabel="Try again">
            <EmptyArt caption="tap to retry" />
          </PressableScale>
        ) : (
          <EmptyArt caption="nothing nearby yet" />
        )}
      </View>
    );
  }

  const grid = (plays: FeedBroadcast[], size: number, offset: number) => (
    <View className="flex-row flex-wrap" style={{ paddingHorizontal: EDGE, columnGap: GUTTER, rowGap: 18 }}>
      {plays.map((p, i) => (
        <CoverTile key={p.id} play={p} index={offset + i} size={size} onOpen={openPlay} />
      ))}
    </View>
  );

  return (
    <View className="flex-1 bg-ground">
      {header}
      <ScrollView contentContainerStyle={{ paddingTop: 6, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        {live.length > 0 && (
          <View className="mb-8">
            <Marker icon={<Equalizer color={COLORS.live} height={13} />} word="now" />
            {grid(live, big, 0)}
          </View>
        )}
        {earlier.length > 0 && (
          <View>
            <Marker icon={<Clock size={15} color={COLORS.inkDim} />} word="earlier" />
            {grid(earlier, small, live.length)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
