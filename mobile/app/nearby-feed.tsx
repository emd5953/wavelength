import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GPSModule } from '../src/services/gps';
import { fetchNearbyFeed, FeedBroadcast } from '../src/services/api';
import { connectFeedSocket, sendLocationUpdate, disconnectFeedSocket } from '../src/services/feedSocket';
import { SpotifyAuthModule } from '../src/services/spotifyAuth';
import { startPolling, stopPolling } from '../src/services/spotifyPoller';
import { startBackgroundLocation } from '../src/services/backgroundLocation';
import { registerForPushNotifications } from '../src/services/pushNotifications';
import BroadcastCard from '../src/components/BroadcastCard';
import FeedMap from '../src/components/FeedMap';
import * as SecureStore from 'expo-secure-store';
import { RADIUS_KEY } from './profile';

const POLL_INTERVAL = 10_000;
type ViewMode = 'list' | 'map';

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
      setBroadcasts(data.broadcasts);
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
      onBroadcastNew: (broadcast) => {
        setBroadcasts((prev) => {
          if (prev.some((b) => b.id === broadcast.id)) return prev;
          return [broadcast, ...prev];
        });
      },
      onBroadcastRemoved: (broadcastId) => {
        setBroadcasts((prev) => prev.filter((b) => b.id !== broadcastId));
      },
    });
    loadFeed();
    startPolling();
    startBackgroundLocation().catch(() => {});
    registerForPushNotifications().catch(() => {});
    const interval = setInterval(loadFeed, POLL_INTERVAL);
    return () => {
      clearInterval(interval);
      stopPolling();
      disconnectFeedSocket();
    };
  }, [loadFeed]);

  const header = (
    <LinearGradient colors={['#DC2626', '#B91C1C', '#1a0a0a']} locations={[0, 0.5, 1]}>
      <View style={{ paddingTop: insets.top + 8 }} className="px-5 pb-5">
        {/* Top row */}
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-3xl font-extrabold text-white tracking-tight">Nearby</Text>
            <Text className="text-xs text-white/50 mt-1">
              {broadcasts.length} {broadcasts.length === 1 ? 'listener' : 'listeners'} around you
            </Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              className="w-11 h-11 rounded-2xl items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
              onPress={() => router.push('/connections')}
              accessibilityLabel="Connections"
              accessibilityRole="button"
            >
              <Text style={{ fontSize: 17 }}>🤝</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="w-11 h-11 rounded-2xl items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
              onPress={() => router.push('/profile')}
              accessibilityLabel="Profile"
              accessibilityRole="button"
            >
              <Text style={{ fontSize: 17 }}>👤</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* View toggle — frosted glass pill */}
        <View
          className="flex-row rounded-2xl p-1"
          style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
        >
          <TouchableOpacity
            className={`flex-1 py-2.5 rounded-xl items-center ${viewMode === 'list' ? '' : ''}`}
            style={viewMode === 'list' ? { backgroundColor: '#fff' } : undefined}
            onPress={() => setViewMode('list')}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'list' }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: viewMode === 'list' ? '#DC2626' : 'rgba(255,255,255,0.6)' }}>
              List
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2.5 rounded-xl items-center`}
            style={viewMode === 'map' ? { backgroundColor: '#fff' } : undefined}
            onPress={() => setViewMode('map')}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'map' }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: viewMode === 'map' ? '#DC2626' : 'rgba(255,255,255,0.6)' }}>
              Map
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );

  if (loading) {
    return (
      <LinearGradient colors={['#DC2626', '#991B1B', '#1a0a0a']} className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#fff" />
        <Text className="text-sm text-white/50 mt-4">Finding listeners nearby...</Text>
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <View className="flex-1" style={{ backgroundColor: '#1a0a0a' }}>
        {header}
        <View className="flex-1 justify-center items-center px-8">
          <Text style={{ fontSize: 48 }}>📡</Text>
          <Text className="text-base text-white/60 text-center mt-4">{error}</Text>
          <TouchableOpacity
            className="mt-5 px-6 py-3 rounded-2xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
            onPress={loadFeed}
            accessibilityRole="button"
          >
            <Text className="text-sm text-white font-bold">Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (broadcasts.length === 0) {
    return (
      <View className="flex-1" style={{ backgroundColor: '#1a0a0a' }}>
        {header}
        <View className="flex-1 justify-center items-center px-8">
          <Text style={{ fontSize: 48 }}>🔇</Text>
          <Text className="text-lg font-bold text-white text-center mt-4">No listeners nearby</Text>
          <Text className="text-sm text-white/50 text-center mt-2 leading-5">
            When someone near you plays music on Spotify, it'll show up here in real time.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: '#1a0a0a' }}>
      {header}
      {viewMode === 'map' ? (
        <FeedMap broadcasts={broadcasts} userLocation={userLocation} />
      ) : (
        <FlatList
          data={broadcasts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <BroadcastCard
              broadcast={item}
              viewerAnonId={userId.current}
              onOpenComments={(id) => router.push(`/comment-thread?broadcastId=${id}`)}
              onOpenDM={(anonId) => router.push(`/dm?recipientAnonId=${anonId}`)}
            />
          )}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: insets.bottom + 8 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
