/**
 * Shared nearby-feed state for the tabs. The nearby list and the map read the
 * same plays, so one provider owns the polling, the socket, presence, and
 * background location — mounted once for the whole tab group, not per tab.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { GPSModule } from './gps';
import { fetchNearbyFeed, type FeedBroadcast } from './api';
import { connectFeedSocket, sendLocationUpdate, disconnectFeedSocket } from './feedSocket';
import { SpotifyAuthModule } from './spotifyAuth';
import { startPresence, stopPresence } from './presence';
import { startBackgroundLocation } from './backgroundLocation';
import { registerForPushNotifications } from './pushNotifications';

export const RADIUS_KEY = 'discovery_radius';

const POLL_INTERVAL = 10_000;

/** Live plays first, then most recently started. Mirrors the server's order. */
function sortFeed(items: FeedBroadcast[]): FeedBroadcast[] {
  return [...items].sort((a, b) => Number(b.isLive) - Number(a.isLive) || b.startedAt - a.startedAt);
}

interface NearbyFeed {
  broadcasts: FeedBroadcast[];
  loading: boolean;
  error: string | null;
  userLocation: { latitude: number; longitude: number } | null;
  reload: () => void;
}

const NearbyFeedContext = createContext<NearbyFeed | null>(null);

// The play screen sits outside the tab group (and its provider), so the feed
// hands the tapped play over here instead of through URL params, which mangle
// titles like "Pink + White".
const openedPlays = new Map<string, FeedBroadcast>();

export function rememberPlay(play: FeedBroadcast): void {
  openedPlays.set(play.id, play);
}

export function getRememberedPlay(id: string): FeedBroadcast | undefined {
  return openedPlays.get(id);
}

export function NearbyFeedProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [broadcasts, setBroadcasts] = useState<FeedBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  return (
    <NearbyFeedContext.Provider value={{ broadcasts, loading, error, userLocation, reload: loadFeed }}>
      {children}
    </NearbyFeedContext.Provider>
  );
}

export function useNearbyFeed(): NearbyFeed {
  const feed = useContext(NearbyFeedContext);
  if (!feed) throw new Error('useNearbyFeed must be used inside NearbyFeedProvider');
  return feed;
}
