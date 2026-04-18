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
      className="flex-row items-center p-3 my-1 bg-surface-card rounded-[10px]"
      onPress={() => onSelectConnection(item.id)}
      accessibilityLabel={`View profile of ${item.displayName}`}
      accessibilityRole="button"
    >
      <Image
        source={{ uri: item.profileImageUrl }}
        className="w-12 h-12 rounded-full bg-surface-elevated"
        accessibilityLabel={`${item.displayName} profile image`}
      />
      <View className="ml-3 flex-1">
        <Text className="text-[15px] font-bold text-white">{item.displayName}</Text>
        <Text className="text-xs text-muted-dark mt-0.5">
          Connected {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-surface">
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <Text className="text-xl font-bold p-4 text-white">Connections</Text>
      <FlatList
        data={connections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text className="text-center text-muted-dark mt-8 text-sm">No connections yet</Text>
        }
        contentContainerStyle={{ paddingHorizontal: 12 }}
      />
    </View>
  );
}
