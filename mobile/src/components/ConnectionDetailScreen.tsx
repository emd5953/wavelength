import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Linking, Alert } from 'react-native';
import { getConnectionDetail, removeConnection } from '../services/api';
import type { ConnectionDetailData } from '../services/api';
import { Screen, SectionLabel, EmptyState, PrimaryButton, OutlineButton, TextButton, Spinner, Avatar } from './ui';

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
          <Text className="font-mono text-[13px] text-ink-dim mt-6">you're connected with</Text>
          <Text className="font-mono-light text-[30px] text-ink mt-1 text-center">
            {profile.displayName.toLowerCase()}
          </Text>
        </View>

        <PrimaryButton label="message" onPress={onMessage} accessibilityLabel="Message" className="mt-8" />
        <OutlineButton
          label="open on spotify"
          onPress={handleOpenSpotify}
          accessibilityLabel="Open Spotify profile"
          className="mt-3"
        />

        {list('TOP ARTISTS', profile.topArtists)}
        {list('TOP TRACKS', profile.topTracks)}

        <TextButton
          label={removing ? 'removing…' : 'remove connection'}
          onPress={handleRemove}
          disabled={removing}
          accessibilityLabel="Remove connection"
          className="items-center mt-12 py-3"
        />
      </ScrollView>
    </Screen>
  );
}
