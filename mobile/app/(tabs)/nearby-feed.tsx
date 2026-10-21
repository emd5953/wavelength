import { View, FlatList, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import CoverTile from '../../src/components/CoverTile';
import MarkHeader from '../../src/components/MarkHeader';
import EmptyArt from '../../src/components/EmptyArt';
import { PressableScale } from '../../src/components/motion';
import { COLORS } from '../../src/components/ui';
import { useNearbyFeed, rememberPlay } from '../../src/services/nearbyFeed';
import type { FeedBroadcast } from '../../src/services/api';

const GUTTER = 12;
const EDGE = 16;

/** Nearby as a record crate: covers only. Live ones move; older ones fade. */
export default function NearbyFeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { broadcasts, loading, error, reload } = useNearbyFeed();
  const tile = (width - EDGE * 2 - GUTTER) / 2;
  const liveCount = broadcasts.filter((b) => b.isLive).length;

  const openPlay = (b: FeedBroadcast) => {
    rememberPlay(b);
    router.push(`/play?broadcastId=${b.id}`);
  };

  const header = <MarkHeader topInset={insets.top} liveCount={liveCount} />;

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

  if (error) {
    return (
      <View className="flex-1 bg-ground">
        {header}
        <PressableScale onPress={reload} accessibilityLabel="Try again">
          <EmptyArt caption="tap to retry" />
        </PressableScale>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ground">
      {header}
      <FlatList
        data={broadcasts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: GUTTER, paddingHorizontal: EDGE }}
        contentContainerStyle={{ gap: GUTTER, paddingTop: 6, paddingBottom: 24 }}
        renderItem={({ item, index }) => <CoverTile play={item} index={index} size={tile} onOpen={openPlay} />}
        ListEmptyComponent={<EmptyArt caption="nothing nearby yet" />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
