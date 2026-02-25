import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
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

  const handleLogout = async () => {
    await SpotifyAuthModule.logout();
    router.replace('/');
  };

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
    <View style={styles.navRow}>
      <TouchableOpacity
        style={[styles.navBtn, viewMode === 'list' && styles.activeToggle]}
        onPress={() => setViewMode('list')}
      >
        <Text style={[styles.navBtnText, viewMode === 'list' && styles.activeToggleText]}>List</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.navBtn, viewMode === 'map' && styles.activeToggle]}
        onPress={() => setViewMode('map')}
      >
        <Text style={[styles.navBtnText, viewMode === 'map' && styles.activeToggleText]}>Map</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/connections')}>
        <Text style={styles.navBtnText}>Connections</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/profile')}>
        <Text style={styles.navBtnText}>👤</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        {navRow}
      </View>
    );
  }

  if (broadcasts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No listeners nearby</Text>
        <Text style={styles.emptySubtext}>
          When someone near you plays music, it will show up here.
        </Text>
        {navRow}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
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
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#121212' },
  list: { paddingVertical: 12 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  emptySubtext: { fontSize: 14, color: '#888', textAlign: 'center', marginTop: 8 },
  errorText: { fontSize: 16, color: '#ff6b6b', textAlign: 'center' },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#121212',
  },
  navBtn: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  navBtnText: { fontSize: 13, color: '#ccc', fontWeight: 'normal' },
  activeToggle: { backgroundColor: '#1DB954' },
  activeToggleText: { color: '#fff' },
});
