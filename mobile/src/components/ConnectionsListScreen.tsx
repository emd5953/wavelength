import { useState, useCallback } from 'react';
import { View, Text, FlatList, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { getConnections, getIncomingRequests } from '../services/api';
import type { ConnectionListItem } from '../services/api';
import { Avatar, Spinner, COLORS } from './ui';
import MarkHeader from './MarkHeader';
import EmptyArt from './EmptyArt';
import { Pair } from './icons';
import { PressableScale, STAGGER } from './motion';

interface ConnectionsListScreenProps {
  userId: string;
  onSelectConnection: (connectionId: string) => void;
  onOpenRequests: () => void;
}

const COLUMNS = 3;
const EDGE = 20;
const GAP = 18;

/** People as faces: a grid of avatars. Requests are a badge, not a line of text. */
export default function ConnectionsListScreen({ userId, onSelectConnection, onOpenRequests }: ConnectionsListScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [connections, setConnections] = useState<ConnectionListItem[]>([]);
  const [incomingCount, setIncomingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const cell = (width - EDGE * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  // Refetch on every focus, so accepting or declining a request updates both
  // the grid and the badge. The spinner only shows on the first load.
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

  const requests = (
    <PressableScale
      scaleTo={0.88}
      onPress={onOpenRequests}
      accessibilityLabel={incomingCount ? `${incomingCount} connection requests waiting` : 'Connection requests'}
    >
      <View>
        <Pair size={28} color={incomingCount ? COLORS.ink : COLORS.inkDim} />
        {incomingCount > 0 && (
          <Animated.View
            entering={ZoomIn.springify()}
            style={{
              position: 'absolute',
              top: -4,
              right: -6,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              paddingHorizontal: 4,
              backgroundColor: COLORS.live,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text className="font-mono-medium text-[10px]" style={{ color: COLORS.night }}>{incomingCount}</Text>
          </Animated.View>
        )}
      </View>
    </PressableScale>
  );

  if (loading) return <Spinner />;

  return (
    <View className="flex-1 bg-ground">
      <MarkHeader topInset={insets.top} right={requests} />
      <FlatList
        data={connections}
        keyExtractor={(item) => item.id}
        numColumns={COLUMNS}
        columnWrapperStyle={{ gap: GAP, paddingHorizontal: EDGE }}
        contentContainerStyle={{ gap: 22, paddingTop: 16, paddingBottom: 24 }}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * STAGGER).springify().damping(16)} style={{ width: cell }}>
            <PressableScale onPress={() => onSelectConnection(item.id)} accessibilityLabel={`View profile of ${item.displayName}`}>
              <View className="items-center">
                <Avatar uri={item.profileImageUrl} name={item.displayName} size={cell * 0.78} />
                <Text className="font-mono text-[12px] text-ink-muted mt-2" numberOfLines={1}>
                  {item.displayName.toLowerCase()}
                </Text>
              </View>
            </PressableScale>
          </Animated.View>
        )}
        ListEmptyComponent={<EmptyArt caption="no one yet" />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
