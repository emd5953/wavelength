import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
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
        getIncomingRequests(userId),
        getOutgoingRequests(userId),
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
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.anonLabel}>Anonymous listener</Text>
        <Text style={styles.expiry}>{formatTimeLeft(item.expiresAt)}</Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => handleAccept(item.id)}
          disabled={actionLoading === item.id}
          accessibilityLabel="Accept connection request"
          accessibilityRole="button"
        >
          {actionLoading === item.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.acceptText}>Accept</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.declineBtn}
          onPress={() => handleDecline(item.id)}
          disabled={actionLoading === item.id}
          accessibilityLabel="Decline connection request"
          accessibilityRole="button"
        >
          <Text style={styles.declineText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderOutgoingItem = ({ item }: { item: ConnectionRequestData }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.anonLabel}>Pending request</Text>
        <Text style={styles.expiry}>{formatTimeLeft(item.expiresAt)}</Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => handleCancel(item.id)}
          disabled={actionLoading === item.id}
          accessibilityLabel="Cancel connection request"
          accessibilityRole="button"
        >
          {actionLoading === item.id ? (
            <ActivityIndicator size="small" color="#d32f2f" />
          ) : (
            <Text style={styles.cancelText}>Cancel</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
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
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'incoming' && styles.activeTab]}
          onPress={() => setTab('incoming')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'incoming' }}
        >
          <Text style={[styles.tabText, tab === 'incoming' && styles.activeTabText]}>
            Incoming{incoming.length > 0 ? ` (${incoming.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'outgoing' && styles.activeTab]}
          onPress={() => setTab('outgoing')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'outgoing' }}
        >
          <Text style={[styles.tabText, tab === 'outgoing' && styles.activeTabText]}>
            Outgoing{outgoing.length > 0 ? ` (${outgoing.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'incoming' ? (
        <FlatList
          data={incoming}
          keyExtractor={(item) => item.id}
          renderItem={renderIncomingItem}
          ListEmptyComponent={<Text style={styles.empty}>No incoming requests</Text>}
          contentContainerStyle={styles.list}
        />
      ) : (
        <FlatList
          data={outgoing}
          keyExtractor={(item) => item.id}
          renderItem={renderOutgoingItem}
          ListEmptyComponent={<Text style={styles.empty}>No outgoing requests</Text>}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#1DB954',
  },
  tabText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#1DB954',
    fontWeight: '600',
  },
  list: {
    padding: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    marginVertical: 4,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
  },
  cardInfo: {
    flex: 1,
  },
  anonLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  expiry: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  acceptText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  declineBtn: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  declineText: {
    color: '#666',
    fontWeight: '500',
    fontSize: 13,
  },
  cancelBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d32f2f',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelText: {
    color: '#d32f2f',
    fontWeight: '500',
    fontSize: 13,
  },
  empty: {
    textAlign: 'center',
    color: '#999',
    marginTop: 32,
    fontSize: 14,
  },
});
