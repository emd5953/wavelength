import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, SectionList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GPSModule } from '../src/services/gps';
import { fetchNearbyFeed, FeedBroadcast } from '../src/services/api';
import { connectFeedSocket, sendLocationUpdate, disconnectFeedSocket } from '../src/services/feedSocket';
import { SpotifyAuthModule } from '../src/services/spotifyAuth';
import { startPresence, stopPresence } from '../src/services/presence';
import { startBackgroundLocation } from '../src/services/backgroundLocation';
import { registerForPushNotifications } from '../src/services/pushNotifications';
import BroadcastCard from '../src/components/BroadcastCard';
import FeedHeader, { ViewMode } from '../src/components/FeedHeader';
import { SectionLabel, COLORS } from '../src/components/ui';
import FeedMap from '../src/components/FeedMap';
import * as SecureStore from 'expo-secure-store';
import { RADIUS_KEY } from './profile';

const POLL_INTERVAL = 10_000;

/** Live plays first, then most recently started. Mirrors the server's order. */
function sortFeed(items: FeedBroadcast[]): FeedBroadcast[] {
  return [...items].sort((a, b) => Number(b.isLive) - Number(a.isLive) || b.startedAt - a.startedAt);
}

export default function NearbyFeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [broadcasts, setBroadcasts] = useState<FeedBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const userId = useRef<string>('');

  useEffect(() => {
    SpotifyAuthModule.getStoredTokens().then((tokens) => {
      if (tokens) userId.current = 'anonymous';
    });
  }, []);

  const loadFeed = useCallback(async () => {
    try {
      const permission = await GPSModule.requestPermission();
      if (permission !== 'granted') {
        router.replace('/location-required');
        return;
      }
      const pos = await GPSModule.getCurrentPosition();
      setUserLocation({ latitude: pos.latitude, longitude: pos.longitude });
      const savedRadius = await SecureStore.getItemAsync(RADIUS_KEY);
      const radius = savedRadius ? Number(savedRadius) : 100;
      const data = await fetchNearbyFeed(pos.latitude, pos.longitude, radius);
      setBroadcasts(sortFeed(data.broadcasts));
      setError(null);
      sendLocationUpdate(userId.current, pos.latitude, pos.longitude, radius);

      const token = await SpotifyAuthModule.getValidToken();
      if (token) {
        fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/account/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ latitude: pos.latitude, longitude: pos.longitude }),
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Feed load error:', err);
      setError('Could not load nearby feed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    connectFeedSocket({
      // A resumed play arrives again with the same id, so replace rather than skip
      onBroadcastNew: (broadcast) => {
        setBroadcasts((prev) => sortFeed([broadcast, ...prev.filter((b) => b.id !== broadcast.id)]));
      },
      onBroadcastEnded: (broadcastId) => {
        setBroadcasts((prev) =>
          sortFeed(prev.map((b) => (b.id === broadcastId ? { ...b, isLive: false, endedAt: Date.now() } : b))),
        );
      },
    });
    loadFeed();
    startPresence();
    startBackgroundLocation().catch(() => {});
    registerForPushNotifications().catch(() => {});
    const interval = setInterval(loadFeed, POLL_INTERVAL);
    return () => {
      clearInterval(interval);
      stopPresence();
      disconnectFeedSocket();
    };
  }, [loadFeed]);

  const live = broadcasts.filter((b) => b.isLive);
  const earlier = broadcasts.filter((b) => !b.isLive);

  const header = (
    <FeedHeader
      topInset={insets.top}
      artUrl={live[0]?.albumArtUrl || null}
      liveCount={live.length}
      earlierCount={earlier.length}
      viewMode={viewMode}
      onChangeViewMode={setViewMode}
      onOpenPeople={() => router.push('/connections')}
      onOpenProfile={() => router.push('/profile')}
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
          <TouchableOpacity className="mt-5" onPress={loadFeed} accessibilityRole="button" hitSlop={10}>
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
      {viewMode === 'map' ? (
        <FeedMap broadcasts={broadcasts} userLocation={userLocation} />
      ) : (
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
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
