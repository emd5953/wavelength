import { useEffect, useRef, useState } from 'react';
import { View, Image, Animated, Easing } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import type { FeedBroadcast } from '../services/api';
import { COLORS } from './ui';

interface FeedMapProps {
  broadcasts: FeedBroadcast[];
  userLocation: { latitude: number; longitude: number } | null;
  onOpenPlay: (play: FeedBroadcast) => void;
}

/** A soft sky ring that breathes out from live pins. */
function Pulse() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: COLORS.live,
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
      }}
    />
  );
}

/** Album art in a circle: live pins are larger with a sky ring, earlier pins smaller and dimmed. */
function ArtPin({ play }: { play: FeedBroadcast }) {
  const size = play.isLive ? 44 : 32;
  return (
    <View style={{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center' }}>
      {play.isLive && <Pulse />}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: play.isLive ? COLORS.live : COLORS.rule,
          backgroundColor: COLORS.ground,
          overflow: 'hidden',
          opacity: play.isLive ? 1 : 0.7,
        }}
      >
        {play.albumArtUrl ? (
          <Image source={{ uri: play.albumArtUrl }} style={{ width: '100%', height: '100%' }} />
        ) : null}
      </View>
    </View>
  );
}

/**
 * Re-render native marker snapshots only briefly after mount, so the art can
 * load in; leaving tracksViewChanges on forever is a known performance sink.
 */
function useSettledMarkers(key: string): boolean {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    setTracking(true);
    const timer = setTimeout(() => setTracking(false), 1500);
    return () => clearTimeout(timer);
  }, [key]);
  return tracking;
}

// Apple Maps can't be restyled, so a translucent ground-colored layer over
// the tiles (under the pins) pulls its dark purple into the sky palette.
// MapKit won't draw a globe-sized polygon, so it covers ~50km around the center.
function tintAround(center: { latitude: number; longitude: number }) {
  const d = 0.5;
  return [
    { latitude: center.latitude + d, longitude: center.longitude - d },
    { latitude: center.latitude + d, longitude: center.longitude + d },
    { latitude: center.latitude - d, longitude: center.longitude + d },
    { latitude: center.latitude - d, longitude: center.longitude - d },
  ];
}

export default function FeedMap({ broadcasts, userLocation, onOpenPlay }: FeedMapProps) {
  const region = userLocation
    ? { ...userLocation, latitudeDelta: 0.005, longitudeDelta: 0.005 }
    : { latitude: 40.7128, longitude: -74.006, latitudeDelta: 0.01, longitudeDelta: 0.01 };

  // Earlier plays first so live pins draw on top
  const ordered = [...broadcasts].sort((a, b) => Number(a.isLive) - Number(b.isLive));
  const tracking = useSettledMarkers(ordered.map((b) => `${b.id}:${b.isLive}`).join(','));

  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={region}
      userInterfaceStyle="dark"
      mapType="mutedStandard"
      showsPointsOfInterest={false}
      showsBuildings={false}
      showsCompass={false}
      showsTraffic={false}
      showsUserLocation
      pitchEnabled={false}
    >
      <Polygon coordinates={tintAround(region)} fillColor="rgba(8, 47, 73, 0.55)" strokeWidth={0} tappable={false} />
      {ordered.map((b) =>
        b.location ? (
          <Marker
            key={b.id}
            coordinate={{ latitude: b.location.latitude, longitude: b.location.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={tracking}
            onPress={() => onOpenPlay(b)}
            accessibilityLabel={`${b.trackTitle} by ${b.artistName}`}
          >
            <ArtPin play={b} />
          </Marker>
        ) : null,
      )}
    </MapView>
  );
}
