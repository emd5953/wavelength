import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import {
  getIncomingRequests,
  getOutgoingRequests,
  acceptConnectionRequest,
  declineConnectionRequest,
  cancelConnectionRequest,
} from '../services/api';
import type { ConnectionRequestData } from '../services/api';

type Tab = 'incoming' | 'outgoing';

interface ConnectionRequestScreenProps {
  userId: string;
}

function formatTimeLeft(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'Expired';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export default function ConnectionRequestScreen({ userId }: ConnectionRequestScreenProps) {
  const [tab, setTab] = useState<Tab>('incoming');
  const [incoming, setIncoming] = useState<ConnectionRequestData[]>([]);
  const [outgoing, setOutgoing] = useState<ConnectionRequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, out] = await Promise.all([
        getIncomingRequests(),
        getOutgoingRequests(),
      ]);
      setIncoming(inc.requests.filter((r) => r.status === 'pending'));
      setOutgoing(out.requests.filter((r) => r.status === 'pending'));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleAccept = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await acceptConnectionRequest(requestId);
      setIncoming((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      // silently fail
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await declineConnectionRequest(requestId);
      setIncoming((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      // silently fail
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await cancelConnectionRequest(requestId);
      setOutgoing((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      // silently fail
    } finally {
      setActionLoading(null);
    }
  };

  const renderIncomingItem = ({ item }: { item: ConnectionRequestData }) => (
    <View className="flex-row items-center justify-between p-3.5 my-1 bg-surface-card rounded-[10px]">
      <View className="flex-1">
        <Text className="text-[15px] text-neutral-300">Anonymous listener</Text>
        <Text className="text-xs text-muted-dark mt-1">{formatTimeLeft(item.expiresAt)}</Text>
      </View>
      <View className="flex-row gap-2">
        <TouchableOpacity
          className="bg-spotify px-4 py-2 rounded-lg min-w-[70px] items-center"
          onPress={() => handleAccept(item.id)}
          disabled={actionLoading === item.id}
          accessibilityLabel="Accept connection request"
          accessibilityRole="button"
        >
          {actionLoading === item.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white font-bold text-[13px]">Accept</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-surface-elevated px-4 py-2 rounded-lg"
          onPress={() => handleDecline(item.id)}
          disabled={actionLoading === item.id}
          accessibilityLabel="Decline connection request"
          accessibilityRole="button"
        >
          <Text className="text-muted-light text-[13px]">Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderOutgoingItem = ({ item }: { item: ConnectionRequestData }) => (
    <View className="flex-row items-center justify-between p-3.5 my-1 bg-surface-card rounded-[10px]">
      <View className="flex-1">
        <Text className="text-[15px] text-neutral-300">Pending request</Text>
        <Text className="text-xs text-muted-dark mt-1">{formatTimeLeft(item.expiresAt)}</Text>
      </View>
      <View className="flex-row gap-2">
        <TouchableOpacity
          className="border border-danger px-4 py-2 rounded-lg"
          onPress={() => handleCancel(item.id)}
          disabled={actionLoading === item.id}
          accessibilityLabel="Cancel connection request"
          accessibilityRole="button"
        >
          {actionLoading === item.id ? (
            <ActivityIndicator size="small" color="#d32f2f" />
          ) : (
            <Text className="text-danger text-[13px]">Cancel</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
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
      <View className="flex-row border-b border-surface-elevated">
        <TouchableOpacity
          className={`flex-1 py-3.5 items-center ${tab === 'incoming' ? 'border-b-2 border-spotify' : ''}`}
          onPress={() => setTab('incoming')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'incoming' }}
        >
          <Text className={`text-sm ${tab === 'incoming' ? 'text-spotify font-bold' : 'text-muted-dark'}`}>
            Incoming{incoming.length > 0 ? ` (${incoming.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-3.5 items-center ${tab === 'outgoing' ? 'border-b-2 border-spotify' : ''}`}
          onPress={() => setTab('outgoing')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'outgoing' }}
        >
          <Text className={`text-sm ${tab === 'outgoing' ? 'text-spotify font-bold' : 'text-muted-dark'}`}>
            Outgoing{outgoing.length > 0 ? ` (${outgoing.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'incoming' ? (
        <FlatList
          data={incoming}
          keyExtractor={(item) => item.id}
          renderItem={renderIncomingItem}
          ListEmptyComponent={
            <Text className="text-center text-muted-dark mt-8 text-sm">No incoming requests</Text>
          }
          contentContainerStyle={{ padding: 12 }}
        />
      ) : (
        <FlatList
          data={outgoing}
          keyExtractor={(item) => item.id}
          renderItem={renderOutgoingItem}
          ListEmptyComponent={
            <Text className="text-center text-muted-dark mt-8 text-sm">No outgoing requests</Text>
          }
          contentContainerStyle={{ padding: 12 }}
        />
      )}
    </View>
  );
}
