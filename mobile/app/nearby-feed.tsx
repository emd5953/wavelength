import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { GPSModule } from '../src/services/gps';
import { fetchNearbyFeed, FeedBroadcast } from '../src/services/api';
import { connectFeedSocket, sendLocationUpdate, disconnectFeedSocket } from '../src/services/feedSocket';
import BroadcastCard from '../src/components/BroadcastCard';

const DEFAULT_RADIUS = 100;
const POLL_INTERVAL = 10_000;

export default function NearbyFeedScreen() {
  const [broadcasts, setBroadcasts] = useState<FeedBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = useRef('current-user');

  const loadFeed = useCallback(async () => {
    try {
      const pos = await GPSModule.getCurrentPosition();
      const data = await fetchNearbyFeed(pos.latitude, pos.longitude, DEFAULT_RADIUS, userId.current);
      setBroadcasts(data.broadcasts);
      setError(null);

      // Update server with current location for WebSocket geo-subscription
      sendLocationUpdate(userId.current, pos.latitude, pos.longitude, DEFAULT_RADIUS);
    } catch (err) {
      setError('Could not load nearby feed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Connect WebSocket for real-time updates
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
    const interval = setInterval(loadFeed, POLL_INTERVAL);

    return () => {
      clearInterval(interval);
      disconnectFeedSocket();
    };
  }, [loadFeed]);

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
      </View>
    );
  }

  return (
    <FlatList
      data={broadcasts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <BroadcastCard
          broadcast={item}
          viewerAnonId={userId.current}
          onOpenComments={(id) => {/* TODO: navigate to comment thread */}}
          onOpenDM={(anonId) => {/* TODO: navigate to DM screen */}}
        />
      )}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  list: {
    paddingVertical: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
  },
});
