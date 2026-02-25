import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { GPSModule } from '../src/services/gps';
import { fetchNearbyFeed, FeedBroadcast } from '../src/services/api';
import { connectFeedSocket, sendLocationUpdate, disconnectFeedSocket } from '../src/services/feedSocket';
import { SpotifyAuthModule } from '../src/services/spotifyAuth';
import { startPolling, stopPolling } from '../src/services/spotifyPoller';
import BroadcastCard from '../src/components/BroadcastCard';

const DEFAULT_RADIUS = 100;
const POLL_INTERVAL = 10_000;

export default function NearbyFeedScreen() {
  const router = useRouter();
  const [broadcasts, setBroadcasts] = useState<FeedBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      const data = await fetchNearbyFeed(pos.latitude, pos.longitude, DEFAULT_RADIUS);
      setBroadcasts(data.broadcasts);
      setError(null);
      sendLocationUpdate(userId.current, pos.latitude, pos.longitude, DEFAULT_RADIUS);

      // Update last known location on server
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
    const interval = setInterval(loadFeed, POLL_INTERVAL);

    return () => {
      clearInterval(interval);
      stopPolling();
      disconnectFeedSocket();
    };
  }, [loadFeed]);

  const navRow = (
    <View style={styles.navRow}>
      <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/connections')}>
        <Text style={styles.navBtnText}>Connections</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/connection-requests')}>
        <Text style={styles.navBtnText}>Requests</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.navBtn, { backgroundColor: '#ffdddd' }]} onPress={handleLogout}>
        <Text style={[styles.navBtnText, { color: '#d32f2f' }]}>Logout</Text>
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
    <View style={{ flex: 1 }}>
      {navRow}
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
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  list: { paddingVertical: 12 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  emptySubtext: { fontSize: 14, color: '#888', textAlign: 'center', marginTop: 8 },
  errorText: { fontSize: 16, color: '#d32f2f', textAlign: 'center' },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  navBtn: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  navBtnText: { fontSize: 13, color: '#333', fontWeight: 'normal' },
});
