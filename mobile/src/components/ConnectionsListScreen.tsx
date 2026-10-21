import { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getConnections, getIncomingRequests } from '../services/api';
import type { ConnectionListItem } from '../services/api';
import { Screen, Avatar, EmptyState, Spinner } from './ui';

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

  // One quiet line, not a card: lit when someone is waiting, dim otherwise
  // (still reachable, for requests you've sent)
  const waiting = incomingCount > 0;
  const requestsRow = (
    <TouchableOpacity
      className="flex-row items-center px-6 pt-1 pb-5"
      onPress={onOpenRequests}
      accessibilityRole="button"
      accessibilityLabel={waiting ? `${incomingCount} connection requests waiting` : 'Connection requests'}
    >
      {waiting && <View className="w-1.5 h-1.5 rounded-full bg-live mr-2.5" />}
      <Text className={`font-mono text-[14px] flex-1 ${waiting ? 'text-ink' : 'text-ink-dim'}`}>
        {waiting ? `${incomingCount} ${incomingCount === 1 ? 'request' : 'requests'} waiting` : 'requests'}
      </Text>
      <Text className="font-mono text-[14px] text-ink-dim">→</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: ConnectionListItem }) => (
    <TouchableOpacity
      className="flex-row items-center px-6 py-3.5"
      onPress={() => onSelectConnection(item.id)}
      accessibilityLabel={`View profile of ${item.displayName}`}
      accessibilityRole="button"
    >
      <Avatar uri={item.profileImageUrl} name={item.displayName} size={44} />
      <View className="ml-4 flex-1">
        <Text className="font-mono-medium text-[15px] text-ink" numberOfLines={1}>{item.displayName}</Text>
        <Text className="font-mono text-[13px] text-ink-dim mt-1">
          since {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) return <Spinner />;

  return (
    <Screen>
      <FlatList
        data={connections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View className="h-px bg-rule ml-[84px] mr-6" />}
        ListHeaderComponent={requestsRow}
        ListEmptyComponent={
          <EmptyState
            title="no one yet."
            body="when you and someone nearby both choose to connect, they'll show up here with their spotify profile."
          />
        }
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
