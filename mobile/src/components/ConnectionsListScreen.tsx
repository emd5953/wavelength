import { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getConnections, getIncomingRequests } from '../services/api';
import type { ConnectionListItem } from '../services/api';
import { Screen, Card, EmptyState, Spinner } from './ui';

interface ConnectionsListScreenProps {
  userId: string;
  onSelectConnection: (connectionId: string) => void;
  onOpenRequests: () => void;
}

export default function ConnectionsListScreen({
  userId,
  onSelectConnection,
  onOpenRequests,
}: ConnectionsListScreenProps) {
  const [connections, setConnections] = useState<ConnectionListItem[]>([]);
  const [incomingCount, setIncomingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Refetch on every focus, so accepting or declining a request updates both
  // the list and the count. The spinner only shows on the first load.
  useFocusEffect(
    useCallback(() => {
      Promise.all([getConnections(), getIncomingRequests()])
        .then(([conns, incoming]) => {
          setConnections(conns.connections);
          setIncomingCount(incoming.requests.filter((r) => r.status === 'pending').length);
        })
        .catch(() => {
          // silently fail
        })
        .finally(() => setLoading(false));
    }, [userId]),
  );

  const requestsRow = (
    <TouchableOpacity onPress={onOpenRequests} accessibilityRole="button" accessibilityLabel="Connection requests">
      <Card className="flex-row items-center px-4 py-3.5 mx-4 mt-2 mb-3">
        <Text className="font-mono-medium text-[15px] text-ink flex-1">requests</Text>
        {incomingCount > 0 && <View className="w-1.5 h-1.5 rounded-full bg-live mr-2" />}
        <Text className="font-mono text-[13px] text-ink-dim mr-3">
          {incomingCount > 0 ? `${incomingCount} waiting` : 'none waiting'}
        </Text>
        <Text className="font-mono text-ink-dim">→</Text>
      </Card>
    </TouchableOpacity>
  );

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
        ListHeaderComponent={requestsRow}
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
