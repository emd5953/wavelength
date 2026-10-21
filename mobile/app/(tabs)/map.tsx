import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedHeader from '../../src/components/FeedHeader';
import FeedMap from '../../src/components/FeedMap';
import { useNearbyFeed } from '../../src/services/nearbyFeed';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { broadcasts, userLocation } = useNearbyFeed();
  const live = broadcasts.filter((b) => b.isLive);

  return (
    <View className="flex-1 bg-ground">
      <FeedHeader
        topInset={insets.top}
        title="map"
        artUrl={live[0]?.albumArtUrl || null}
        liveCount={live.length}
        earlierCount={broadcasts.length - live.length}
      />
      <FeedMap broadcasts={broadcasts} userLocation={userLocation} />
    </View>
  );
}
