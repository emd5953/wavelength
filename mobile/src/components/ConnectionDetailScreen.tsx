/**
 * Connection detail screen — full Spotify profile with link, top artists, top tracks, and remove action.
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { getConnectionDetail, removeConnection } from '../services/api';
import type { ConnectionDetailData } from '../services/api';

interface ConnectionDetailScreenProps {
  connectionId: string;
  userId: string;
  onBack: () => void;
  onRemoved: () => void;
}

export default function ConnectionDetailScreen({
  connectionId,
  userId,
  onBack,
  onRemoved,
}: ConnectionDetailScreenProps) {
  const [detail, setDetail] = useState<ConnectionDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConnectionDetail(connectionId);
      setDetail(data.connection);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [connectionId, userId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleRemove = () => {
    Alert.alert(
      'Remove Connection',
      'This will remove the connection for both users. Future interactions will be anonymous.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              await removeConnection(connectionId);
              onRemoved();
            } catch {
              // silently fail
            } finally {
              setRemoving(false);
            }
          },
        },
      ],
    );
  };

  const handleOpenSpotify = () => {
    if (detail?.profile.profileLink) {
      Linking.openURL(detail.profile.profileLink);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-surface">
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="flex-1 justify-center items-center bg-surface">
        <Text className="text-[15px] text-muted-dark mb-3">Connection not found</Text>
        <TouchableOpacity onPress={onBack} accessibilityRole="button">
          <Text className="text-sm text-spotify font-bold">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { profile } = detail;

  return (
    <ScrollView className="flex-1 bg-surface">
      <TouchableOpacity
        onPress={onBack}
        className="p-4"
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text className="text-sm text-spotify font-bold">← Back</Text>
      </TouchableOpacity>

      <View className="items-center py-5">
        <Image
          source={{ uri: profile.profileImageUrl }}
          className="w-24 h-24 rounded-full bg-surface-elevated"
          accessibilityLabel={`${profile.displayName} profile image`}
        />
        <Text className="text-xl font-bold text-white mt-3">{profile.displayName}</Text>
        <TouchableOpacity
          onPress={handleOpenSpotify}
          className="mt-3 bg-spotify px-5 py-2.5 rounded-[20px]"
          accessibilityRole="link"
          accessibilityLabel="Open Spotify profile"
        >
          <Text className="text-white font-bold text-sm">Open on Spotify</Text>
        </TouchableOpacity>
      </View>

      {profile.topArtists.length > 0 && (
        <View className="px-5 mt-5">
          <Text className="text-base font-bold text-white mb-2">Top Artists</Text>
          {profile.topArtists.map((artist, i) => (
            <Text key={i} className="text-sm text-muted-light py-1">{artist}</Text>
          ))}
        </View>
      )}

      {profile.topTracks.length > 0 && (
        <View className="px-5 mt-5">
          <Text className="text-base font-bold text-white mb-2">Top Tracks</Text>
          {profile.topTracks.map((track, i) => (
            <Text key={i} className="text-sm text-muted-light py-1">{track}</Text>
          ))}
        </View>
      )}

      <TouchableOpacity
        className="m-5 p-3.5 border border-danger rounded-[10px] items-center"
        onPress={handleRemove}
        disabled={removing}
        accessibilityRole="button"
        accessibilityLabel="Remove connection"
      >
        {removing ? (
          <ActivityIndicator size="small" color="#d32f2f" />
        ) : (
          <Text className="text-danger font-bold text-sm">Remove Connection</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
