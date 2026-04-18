import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
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
  const [broadcasts, setBroadcasts] = useState<FeedBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const userId = useRef<string>('');

  useEffect(() => {
    SpotifyAuthModule.getStoredTokens().then((tokens) => {
      if (tokens) {
        userId.current = 'anonymous';
      }
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

  const navRow = (
    <View className="flex-row justify-center gap-2 py-2.5 px-3 bg-surface">
      <TouchableOpacity
        className={`px-3.5 py-2 rounded-lg ${viewMode === 'list' ? 'bg-spotify' : 'bg-surface-elevated'}`}
        onPress={() => setViewMode('list')}
      >
        <Text className={`text-[13px] ${viewMode === 'list' ? 'text-white' : 'text-neutral-400'}`}>
          List
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        className={`px-3.5 py-2 rounded-lg ${viewMode === 'map' ? 'bg-spotify' : 'bg-surface-elevated'}`}
        onPress={() => setViewMode('map')}
      >
        <Text className={`text-[13px] ${viewMode === 'map' ? 'text-white' : 'text-neutral-400'}`}>
          Map
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        className="bg-surface-elevated px-3.5 py-2 rounded-lg"
        onPress={() => router.push('/connections')}
      >
        <Text className="text-[13px] text-neutral-400">Connections</Text>
      </TouchableOpacity>
      <TouchableOpacity
        className="bg-surface-elevated px-3.5 py-2 rounded-lg"
        onPress={() => router.push('/profile')}
      >
        <Text className="text-[13px] text-neutral-400">👤</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-surface">
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-8 bg-surface">
        <Text className="text-base text-danger-light text-center">{error}</Text>
        {navRow}
      </View>
    );
  }

  if (broadcasts.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-8 bg-surface">
        <Text className="text-lg font-bold text-white text-center">No listeners nearby</Text>
        <Text className="text-sm text-muted text-center mt-2">
          When someone near you plays music, it will show up here.
        </Text>
        {navRow}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {navRow}
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
          contentContainerStyle={{ paddingVertical: 12 }}
        />
      )}
    </View>
  );
}
