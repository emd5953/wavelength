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
  StyleSheet,
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
      const data = await getConnectionDetail(connectionId, userId);
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
              await removeConnection(connectionId, userId);
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Connection not found</Text>
        <TouchableOpacity onPress={onBack} accessibilityRole="button">
          <Text style={styles.backLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { profile } = detail;

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.profileHeader}>
        <Image
          source={{ uri: profile.profileImageUrl }}
          style={styles.avatar}
          accessibilityLabel={`${profile.displayName} profile image`}
        />
        <Text style={styles.displayName}>{profile.displayName}</Text>
        <TouchableOpacity onPress={handleOpenSpotify} style={styles.spotifyBtn} accessibilityRole="link" accessibilityLabel="Open Spotify profile">
          <Text style={styles.spotifyBtnText}>Open on Spotify</Text>
        </TouchableOpacity>
      </View>

      {profile.topArtists.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Artists</Text>
          {profile.topArtists.map((artist, i) => (
            <Text key={i} style={styles.listItem}>{artist}</Text>
          ))}
        </View>
      )}

      {profile.topTracks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Tracks</Text>
          {profile.topTracks.map((track, i) => (
            <Text key={i} style={styles.listItem}>{track}</Text>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.removeBtn}
        onPress={handleRemove}
        disabled={removing}
        accessibilityRole="button"
        accessibilityLabel="Remove connection"
      >
        {removing ? (
          <ActivityIndicator size="small" color="#d32f2f" />
        ) : (
          <Text style={styles.removeText}>Remove Connection</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 15, color: '#999', marginBottom: 12 },
  backLink: { fontSize: 14, color: '#1DB954', fontWeight: '600' },
  backBtn: { padding: 16 },
  backText: { fontSize: 14, color: '#1DB954', fontWeight: '600' },
  profileHeader: { alignItems: 'center', paddingVertical: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#eee' },
  displayName: { fontSize: 20, fontWeight: '700', color: '#333', marginTop: 12 },
  spotifyBtn: {
    marginTop: 12,
    backgroundColor: '#1DB954',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  spotifyBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 8 },
  listItem: { fontSize: 14, color: '#555', paddingVertical: 4 },
  removeBtn: {
    margin: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#d32f2f',
    borderRadius: 10,
    alignItems: 'center',
  },
  removeText: { color: '#d32f2f', fontWeight: '600', fontSize: 14 },
});
