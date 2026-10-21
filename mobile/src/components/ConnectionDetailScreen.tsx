import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Linking, Alert } from 'react-native';
import { getConnectionDetail, removeConnection } from '../services/api';
import type { ConnectionDetailData } from '../services/api';
import { Screen, SectionLabel, EmptyState, TextButton, Spinner, Avatar, COLORS } from './ui';
import { Note, Link, More } from './icons';
import { PressableScale } from './motion';

interface ConnectionDetailScreenProps {
  connectionId: string;
  userId: string;
  onBack: () => void;
  onRemoved: () => void;
  onMessage: () => void;
}

export default function ConnectionDetailScreen({
  connectionId,
  userId,
  onBack,
  onRemoved,
  onMessage,
}: ConnectionDetailScreenProps) {
  const [detail, setDetail] = useState<ConnectionDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConnectionDetail(connectionId);
      setDetail(data.connection);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [connectionId, userId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleRemove = () => {
    Alert.alert(
      'Remove connection?',
      'This removes the connection for both of you. Anything after this is anonymous again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              await removeConnection(connectionId);
              onRemoved();
            } catch {
              // silently fail
            } finally {
              setRemoving(false);
            }
          },
        },
      ],
    );
  };

  const handleOpenSpotify = () => {
    if (detail?.profile.profileLink) {
      Linking.openURL(detail.profile.profileLink);
    }
  };

  if (loading) return <Spinner />;

  if (!detail) {
    return (
      <Screen>
        <EmptyState title="connection not found." body="they may have removed it.">
          <TextButton label="← go back" onPress={onBack} className="mt-6" />
        </EmptyState>
      </Screen>
    );
  }

  const { profile } = detail;

  const list = (title: string, items: string[]) =>
    items.length > 0 && (
      <View className="mt-10">
        <SectionLabel title={title} className="mb-2" />
        {items.map((item, i) => (
          <View key={i} className={`flex-row py-3 ${i < items.length - 1 ? 'border-b border-rule' : ''}`}>
            <Text className="font-mono text-[13px] text-ink-dim w-8">{String(i + 1).padStart(2, '0')}</Text>
            <Text className="font-mono text-[14px] text-ink flex-1" numberOfLines={1}>{item}</Text>
          </View>
        ))}
      </View>
    );

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
        <View className="items-center pt-8">
          <Avatar uri={profile.profileImageUrl} name={profile.displayName} size={96} />
          <Text className="font-mono-light text-[30px] text-ink mt-6 text-center">
            {profile.displayName.toLowerCase()}
          </Text>
        </View>

        <View className="flex-row justify-center gap-6 mt-10">
          <PressableScale
            scaleTo={0.9}
            onPress={onMessage}
            accessibilityLabel="Message"
            style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }}
          >
            <Note size={30} color={COLORS.ink} />
          </PressableScale>
          <PressableScale
            scaleTo={0.9}
            onPress={handleOpenSpotify}
            accessibilityLabel="Open Spotify profile"
            style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: COLORS.rule, alignItems: 'center', justifyContent: 'center' }}
          >
            <Link size={28} color={COLORS.ink} />
          </PressableScale>
        </View>

        {list('TOP ARTISTS', profile.topArtists)}
        {list('TOP TRACKS', profile.topTracks)}

        <View className="items-center mt-14">
          <PressableScale scaleTo={0.88} onPress={handleRemove} accessibilityLabel="Remove connection">
            <More size={26} color={removing ? COLORS.rule : COLORS.inkDim} />
          </PressableScale>
        </View>
      </ScrollView>
    </Screen>
  );
}
