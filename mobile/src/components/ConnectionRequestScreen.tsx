import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import {
  getIncomingRequests,
  getOutgoingRequests,
  acceptConnectionRequest,
  declineConnectionRequest,
  cancelConnectionRequest,
} from '../services/api';
import type { ConnectionRequestData } from '../services/api';
import { Screen, Card, EmptyState, PrimaryButton, TextButton, Spinner } from './ui';

type Tab = 'incoming' | 'outgoing';

interface ConnectionRequestScreenProps {
  userId: string;
}

function formatTimeLeft(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'expired';
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
    <Card className="mx-4 my-1.5 p-4">
      <Text className="font-mono-medium text-[15px] text-ink">a listener wants to connect</Text>
      <Text className="font-mono text-xs text-ink-dim mt-1">{formatTimeLeft(item.expiresAt)}</Text>
      <View className="flex-row items-center gap-6 mt-4">
        <TextButton
          label="no"
          onPress={() => handleDecline(item.id)}
          disabled={actionLoading === item.id}
          accessibilityLabel="Decline connection request"
          className="w-12 items-center"
        />
        <PrimaryButton
          label="yes"
          onPress={() => handleAccept(item.id)}
          loading={actionLoading === item.id}
          accessibilityLabel="Accept connection request"
          className="flex-1 py-3"
        />
      </View>
    </Card>
  );

  const renderOutgoingItem = ({ item }: { item: ConnectionRequestData }) => (
    <Card className="mx-4 my-1.5 p-4 flex-row items-center">
      <View className="flex-1">
        <Text className="font-mono-medium text-[15px] text-ink">waiting on a listener</Text>
        <Text className="font-mono text-xs text-ink-dim mt-1">{formatTimeLeft(item.expiresAt)}</Text>
      </View>
      <TextButton
        label={actionLoading === item.id ? 'cancelling…' : 'cancel'}
        onPress={() => handleCancel(item.id)}
        disabled={actionLoading === item.id}
        accessibilityLabel="Cancel connection request"
      />
    </Card>
  );

  if (loading) return <Spinner />;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'incoming', label: 'incoming', count: incoming.length },
    { key: 'outgoing', label: 'sent', count: outgoing.length },
  ];

  return (
    <Screen>
      <View className="flex-row gap-1 mx-4 mt-3 mb-1">
        {tabs.map(({ key, label, count }) => {
          const selected = tab === key;
          return (
            <TouchableOpacity
              key={key}
              className={`px-4 py-1.5 rounded-full ${selected ? 'bg-card border border-rule' : ''}`}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text className={`font-mono text-[13px] ${selected ? 'text-ink' : 'text-ink-dim'}`}>
                {label}{count > 0 ? ` ${count}` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'incoming' ? (
        <FlatList
          data={incoming}
          keyExtractor={(item) => item.id}
          renderItem={renderIncomingItem}
          ListEmptyComponent={<EmptyState title="no requests." body="when a listener asks to connect, it shows up here for 24 hours." />}
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      ) : (
        <FlatList
          data={outgoing}
          keyExtractor={(item) => item.id}
          renderItem={renderOutgoingItem}
          ListEmptyComponent={<EmptyState title="nothing sent." body="ask to connect from a message thread." />}
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      )}
    </Screen>
  );
}
