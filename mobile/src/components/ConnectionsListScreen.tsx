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
      className="flex-row items-center p-4 mx-4 my-1.5 rounded-2xl"
      style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
      onPress={() => onSelectConnection(item.id)}
      accessibilityLabel={`View profile of ${item.displayName}`}
      accessibilityRole="button"
    >
      <Image
        source={{ uri: item.profileImageUrl }}
        className="w-12 h-12 rounded-full"
        style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 2, borderColor: '#DC2626' }}
        accessibilityLabel={`${item.displayName} profile image`}
      />
      <View className="ml-3.5 flex-1">
        <Text className="text-base font-bold text-white">{item.displayName}</Text>
        <Text className="text-xs text-white/35 mt-0.5">
          Connected {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <Text className="text-white/30 text-lg">›</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center" style={{ backgroundColor: '#1a0a0a' }}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: '#1a0a0a' }}>
      <FlatList
        data={connections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <View className="items-center mt-16">
            <Text style={{ fontSize: 32 }}>🤝</Text>
            <Text className="text-white/35 mt-3 text-sm">No connections yet</Text>
            <Text className="text-white/25 text-xs mt-1 text-center px-8">
              Send connection requests through DMs to reveal Spotify profiles
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingVertical: 8 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
