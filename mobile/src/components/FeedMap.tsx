import { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import type { FeedBroadcast } from '../services/api';

interface FeedMapProps {
  broadcasts: FeedBroadcast[];
  userLocation: { latitude: number; longitude: number } | null;
}

export default function FeedMap({ broadcasts, userLocation }: FeedMapProps) {
  const region = userLocation
    ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }
    : {
        latitude: 40.7128,
        longitude: -74.006,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

  return (
    <MapView style={styles.map} initialRegion={region}>
      {broadcasts.map((b) => {
        if (!b.location) return null;
        return (
          <Marker
            key={b.id}
            coordinate={{
              latitude: b.location.latitude,
              longitude: b.location.longitude,
            }}
            pinColor="#1DB954"
          >
            <Callout>
              <View style={styles.callout}>
                {b.albumArtUrl ? (
                  <Image source={{ uri: b.albumArtUrl }} style={styles.albumArt} />
                ) : null}
                <View style={styles.calloutInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>{b.trackTitle}</Text>
                  <Text style={styles.artistName} numberOfLines={1}>{b.artistName}</Text>
                </View>
              </View>
            </Callout>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  callout: { flexDirection: 'row', alignItems: 'center', padding: 4, maxWidth: 200 },
  albumArt: { width: 40, height: 40, borderRadius: 4 },
  calloutInfo: { marginLeft: 8, flex: 1 },
  trackTitle: { fontSize: 13, fontWeight: 'bold', color: '#111' },
  artistName: { fontSize: 12, color: '#666' },
});
