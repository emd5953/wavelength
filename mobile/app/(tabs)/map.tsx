import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MarkHeader from '../../src/components/MarkHeader';
import FeedMap from '../../src/components/FeedMap';
import { useRouter } from 'expo-router';
import { useNearbyFeed, rememberPlay } from '../../src/services/nearbyFeed';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { broadcasts, userLocation } = useNearbyFeed();
  const live = broadcasts.filter((b) => b.isLive);

  return (
    <View className="flex-1 bg-ground">
      <MarkHeader topInset={insets.top} liveCount={live.length} />
      <FeedMap
        broadcasts={broadcasts}
        userLocation={userLocation}
        onOpenPlay={(play) => {
          rememberPlay(play);
          router.push(`/play?broadcastId=${play.id}`);
        }}
      />
    </View>
  );
}
