import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native';
import { getConnections } from '../services/api';
import type { ConnectionListItem } from '../services/api';
import { Screen, Card, EmptyState, Spinner } from './ui';

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
      onPress={() => onSelectConnection(item.id)}
      accessibilityLabel={`View profile of ${item.displayName}`}
      accessibilityRole="button"
    >
      <Card className="flex-row items-center p-4 mx-4 my-1.5">
        <Image
          source={{ uri: item.profileImageUrl }}
          className="w-11 h-11 rounded-full bg-card"
          accessibilityLabel={`${item.displayName} profile image`}
        />
        <View className="ml-3.5 flex-1">
          <Text className="font-mono-medium text-[15px] text-ink" numberOfLines={1}>{item.displayName}</Text>
          <Text className="font-mono text-xs text-ink-dim mt-0.5">
            connected {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <Text className="font-mono text-ink-dim">→</Text>
      </Card>
    </TouchableOpacity>
  );

  if (loading) return <Spinner />;

  return (
    <Screen>
      <FlatList
        data={connections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState
            title="no one yet."
            body="when you and someone nearby both choose to connect, they'll show up here with their spotify profile."
          />
        }
        contentContainerStyle={{ paddingVertical: 8 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
