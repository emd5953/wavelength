import { View, Text, SectionList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import BroadcastCard from '../../src/components/BroadcastCard';
import FeedHeader from '../../src/components/FeedHeader';
import { SectionLabel, COLORS } from '../../src/components/ui';
import { useNearbyFeed } from '../../src/services/nearbyFeed';

export default function NearbyFeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { broadcasts, loading, error, reload } = useNearbyFeed();

  const live = broadcasts.filter((b) => b.isLive);
  const earlier = broadcasts.filter((b) => !b.isLive);

  const header = (
    <FeedHeader
      topInset={insets.top}
      title="nearby"
      artUrl={live[0]?.albumArtUrl || null}
      liveCount={live.length}
      earlierCount={earlier.length}
    />
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-ground">
        <ActivityIndicator color={COLORS.inkDim} />
        <Text className="font-mono text-[13px] text-ink-dim mt-4">listening around you…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-ground">
        {header}
        <View className="flex-1 justify-center items-center px-10">
          <Text className="font-mono text-[15px] text-ink-muted text-center leading-6">
            couldn't load what's playing nearby.
          </Text>
          <TouchableOpacity className="mt-5" onPress={reload} accessibilityRole="button" hitSlop={10}>
            <Text className="font-mono-medium text-[13px] text-ink">try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (broadcasts.length === 0) {
    return (
      <View className="flex-1 bg-ground">
        {header}
        <View className="flex-1 justify-center px-10">
          <Text className="font-mono-light text-xl text-ink">nothing played nearby yet.</Text>
          <Text className="font-mono text-[13px] text-ink-muted mt-3 leading-6">
            songs played around you in the last 6 hours show up here. what's playing right now goes on top.
          </Text>
        </View>
      </View>
    );
  }

  const sections = [
    { title: 'PLAYING NOW', data: live },
    { title: 'EARLIER', data: earlier },
  ].filter((section) => section.data.length > 0);

  return (
    <View className="flex-1 bg-ground">
      {header}
      <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <SectionLabel title={section.title} className="px-6 pt-5 pb-2 bg-ground" />
          )}
          renderItem={({ item }) => (
            <BroadcastCard
              broadcast={item}
              onOpenComments={(id) => router.push(`/comment-thread?broadcastId=${id}`)}
              onOpenDM={(anonId) => router.push(`/dm?recipientAnonId=${anonId}`)}
            />
          )}
          contentContainerStyle={{ paddingBottom: 16 }}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
        />
    </View>
  );
}
