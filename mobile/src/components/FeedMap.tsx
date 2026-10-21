import { View, Text, Image } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import type { FeedBroadcast } from '../services/api';
import { COLORS } from './ui';

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
    <MapView style={{ flex: 1 }} initialRegion={region} userInterfaceStyle="dark">
      {broadcasts.map((b) => {
        if (!b.location) return null;
        return (
          <Marker
            key={b.id}
            coordinate={{
              latitude: b.location.latitude,
              longitude: b.location.longitude,
            }}
            pinColor={b.isLive ? COLORS.live : COLORS.primary}
          >
            <Callout>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 4, maxWidth: 200 }}>
                {b.albumArtUrl ? (
                  <Image source={{ uri: b.albumArtUrl }} style={{ width: 40, height: 40, borderRadius: 4 }} />
                ) : null}
                <View style={{ marginLeft: 8, flex: 1 }}>
                  {/* Callouts render on the system's white bubble, so dark text here */}
                  <Text style={{ fontSize: 13, fontFamily: 'PaperMono-Medium', color: COLORS.ground }} numberOfLines={1}>
                    {b.trackTitle}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'PaperMono-Regular', color: COLORS.primary }} numberOfLines={1}>
                    {b.artistName}{b.isLive ? ' · playing now' : ''}
                  </Text>
                </View>
              </View>
            </Callout>
          </Marker>
        );
      })}
    </MapView>
  );
}
