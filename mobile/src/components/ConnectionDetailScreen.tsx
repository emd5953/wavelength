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
import { LinearGradient } from 'expo-linear-gradient';
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
      <View className="flex-1 justify-center items-center" style={{ backgroundColor: '#1a0a0a' }}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="flex-1 justify-center items-center px-8" style={{ backgroundColor: '#1a0a0a' }}>
        <Text style={{ fontSize: 32 }}>🔍</Text>
        <Text className="text-base text-white/35 mt-3 mb-4">Connection not found</Text>
        <TouchableOpacity
          onPress={onBack}
          className="px-6 py-3 rounded-2xl"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
          accessibilityRole="button"
        >
          <Text style={{ color: '#DC2626', fontSize: 14, fontWeight: '700' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { profile } = detail;

  return (
    <ScrollView className="flex-1" style={{ backgroundColor: '#1a0a0a' }}>
      <TouchableOpacity
        onPress={onBack}
        className="px-5 pt-4 pb-2"
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text className="text-sm text-white/60 font-semibold">← Back</Text>
      </TouchableOpacity>

      {/* Profile header */}
      <View className="items-center py-6">
        <Image
          source={{ uri: profile.profileImageUrl }}
          className="w-28 h-28 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 3, borderColor: '#DC2626' }}
          accessibilityLabel={`${profile.displayName} profile image`}
        />
        <Text className="text-2xl font-extrabold text-white mt-4">{profile.displayName}</Text>
        <TouchableOpacity
          onPress={handleOpenSpotify}
          className="mt-4 px-6 py-3 rounded-2xl"
          style={{
            backgroundColor: '#fff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
          }}
          accessibilityRole="link"
          accessibilityLabel="Open Spotify profile"
        >
          <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 14 }}>Open on Spotify</Text>
        </TouchableOpacity>
      </View>

      {/* Top Artists */}
      {profile.topArtists.length > 0 && (
        <View
          className="mx-5 mt-4 rounded-2xl p-5"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <Text className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">
            Top Artists
          </Text>
          {profile.topArtists.map((artist, i) => (
            <View
              key={i}
              className="flex-row items-center py-2.5"
              style={i < profile.topArtists.length - 1 ? { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' } : undefined}
            >
              <Text className="text-xs text-white/30 w-6">{i + 1}</Text>
              <Text className="text-sm text-white/80 flex-1">{artist}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Top Tracks */}
      {profile.topTracks.length > 0 && (
        <View
          className="mx-5 mt-4 rounded-2xl p-5"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <Text className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">
            Top Tracks
          </Text>
          {profile.topTracks.map((track, i) => (
            <View
              key={i}
              className="flex-row items-center py-2.5"
              style={i < profile.topTracks.length - 1 ? { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' } : undefined}
            >
              <Text className="text-xs text-white/30 w-6">{i + 1}</Text>
              <Text className="text-sm text-white/80 flex-1">{track}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Remove */}
      <TouchableOpacity
        className="mx-5 my-6 py-4 rounded-2xl items-center"
        style={{ borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' }}
        onPress={handleRemove}
        disabled={removing}
        accessibilityRole="button"
        accessibilityLabel="Remove connection"
      >
        {removing ? (
          <ActivityIndicator size="small" color="#ef4444" />
        ) : (
          <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 14 }}>Remove Connection</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
