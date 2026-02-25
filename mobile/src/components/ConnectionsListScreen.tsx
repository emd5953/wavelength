/**
 * Connections list screen — displays connected users with profile name and image.
 * Requirements: 7.1, 7.4
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { getConnections } from '../services/api';
import type { ConnectionListItem } from '../services/api';

interface ConnectionsListScreenProps {
  userId: string;
  onSelectConnection: (connectionId: string) => void;
}

export default function ConnectionsListScreen({
  userId,
  onSelectConnection,
}: ConnectionsListScreenProps) {
  const [connections, setConnections] = useState<ConnectionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConnections();
      setConnections(data.connections);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const renderItem = ({ item }: { item: ConnectionListItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onSelectConnection(item.id)}
      accessibilityLabel={`View profile of ${item.displayName}`}
      accessibilityRole="button"
    >
      <Image
        source={{ uri: item.profileImageUrl }}
        style={styles.avatar}
        accessibilityLabel={`${item.displayName} profile image`}
      />
      <View style={styles.cardInfo}>
        <Text style={styles.displayName}>{item.displayName}</Text>
        <Text style={styles.since}>
          Connected {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Connections</Text>
      <FlatList
        data={connections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.empty}>No connections yet</Text>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  header: { fontSize: 20, fontWeight: 'bold', padding: 16, color: '#fff' },
  list: { paddingHorizontal: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2a2a2a' },
  cardInfo: { marginLeft: 12, flex: 1 },
  displayName: { fontSize: 15, fontWeight: 'bold', color: '#fff' },
  since: { fontSize: 12, color: '#666', marginTop: 2 },
  empty: { textAlign: 'center', color: '#666', marginTop: 32, fontSize: 14 },
});
