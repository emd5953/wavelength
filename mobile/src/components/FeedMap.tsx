import { View, Text, Image } from 'react-native';
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
    <MapView className="flex-1" initialRegion={region}>
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
              <View className="flex-row items-center p-1 max-w-[200px]">
                {b.albumArtUrl ? (
                  <Image source={{ uri: b.albumArtUrl }} className="w-10 h-10 rounded" />
                ) : null}
                <View className="ml-2 flex-1">
                  <Text className="text-[13px] font-bold text-gray-900" numberOfLines={1}>
                    {b.trackTitle}
                  </Text>
                  <Text className="text-xs text-muted-dark" numberOfLines={1}>
                    {b.artistName}
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
