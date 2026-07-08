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
    } catch {} finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await declineConnectionRequest(requestId);
      setIncoming((prev) => prev.filter((r) => r.id !== requestId));
    } catch {} finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await cancelConnectionRequest(requestId);
      setOutgoing((prev) => prev.filter((r) => r.id !== requestId));
    } catch {} finally {
      setActionLoading(null);
    }
  };

  const renderIncomingItem = ({ item }: { item: ConnectionRequestData }) => (
    <View
      className="mx-4 my-1.5 p-4 rounded-2xl"
      style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-base text-white/80 font-medium">Anonymous listener</Text>
          <View className="flex-row items-center mt-1 gap-1">
            <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#DC2626' }} />
            <Text className="text-xs text-white/35">{formatTimeLeft(item.expiresAt)}</Text>
          </View>
        </View>
      </View>
      <View className="flex-row gap-2 mt-3">
        <TouchableOpacity
          className="flex-1 py-3 rounded-xl items-center"
          style={{ backgroundColor: '#DC2626' }}
          onPress={() => handleAccept(item.id)}
          disabled={actionLoading === item.id}
          accessibilityLabel="Accept connection request"
          accessibilityRole="button"
        >
          {actionLoading === item.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white font-bold text-sm">Accept</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 py-3 rounded-xl items-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
          onPress={() => handleDecline(item.id)}
          disabled={actionLoading === item.id}
          accessibilityLabel="Decline connection request"
          accessibilityRole="button"
        >
          <Text className="text-white/60 text-sm font-medium">Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderOutgoingItem = ({ item }: { item: ConnectionRequestData }) => (
    <View
      className="mx-4 my-1.5 p-4 rounded-2xl"
      style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-base text-white/80 font-medium">Pending request</Text>
          <View className="flex-row items-center mt-1 gap-1">
            <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#DC2626' }} />
            <Text className="text-xs text-white/35">{formatTimeLeft(item.expiresAt)}</Text>
          </View>
        </View>
        <TouchableOpacity
          className="px-4 py-2.5 rounded-xl"
          style={{ borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' }}
          onPress={() => handleCancel(item.id)}
          disabled={actionLoading === item.id}
          accessibilityLabel="Cancel connection request"
          accessibilityRole="button"
        >
          {actionLoading === item.id ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>Cancel</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
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
      {/* Tab bar — frosted glass */}
      <View
        className="flex-row mx-4 mt-3 rounded-2xl p-1"
        style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <TouchableOpacity
          className="flex-1 py-2.5 rounded-xl items-center"
          style={tab === 'incoming' ? { backgroundColor: '#DC2626' } : undefined}
          onPress={() => setTab('incoming')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'incoming' }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: tab === 'incoming' ? '#fff' : 'rgba(255,255,255,0.4)' }}>
            Incoming{incoming.length > 0 ? ` (${incoming.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 py-2.5 rounded-xl items-center"
          style={tab === 'outgoing' ? { backgroundColor: '#DC2626' } : undefined}
          onPress={() => setTab('outgoing')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'outgoing' }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: tab === 'outgoing' ? '#fff' : 'rgba(255,255,255,0.4)' }}>
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
            <View className="items-center mt-16">
              <Text style={{ fontSize: 32 }}>📥</Text>
              <Text className="text-white/35 mt-3 text-sm">No incoming requests</Text>
            </View>
          }
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      ) : (
        <FlatList
          data={outgoing}
          keyExtractor={(item) => item.id}
          renderItem={renderOutgoingItem}
          ListEmptyComponent={
            <View className="items-center mt-16">
              <Text style={{ fontSize: 32 }}>📤</Text>
              <Text className="text-white/35 mt-3 text-sm">No outgoing requests</Text>
            </View>
          }
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      )}
    </View>
  );
}
