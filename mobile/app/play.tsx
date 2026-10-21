import { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getMyAnonId } from '../src/services/presence';
import { getRememberedPlay } from '../src/services/nearbyFeed';
import CommentThread from '../src/components/CommentThread';
import Reactions from '../src/components/Reactions';
import { formatTimeSince } from '../src/components/BroadcastRow';
import { SectionLabel, OutlineButton } from '../src/components/ui';


/** One play: big art, reactions, message the listener, and the comment thread. */
export default function PlayScreen() {
  const router = useRouter();
  const { broadcastId } = useLocalSearchParams<{ broadcastId: string }>();
  const play = broadcastId ? getRememberedPlay(broadcastId) : undefined;
  const [viewerAnonId, setViewerAnonId] = useState('');

  useEffect(() => {
    getMyAnonId().then((id) => {
      if (id) setViewerAnonId(id);
    });
  }, []);

  if (!broadcastId || !viewerAnonId) return null;

  // Opened without going through the feed (e.g. a deep link): comments only
  if (!play) return <CommentThread broadcastId={broadcastId} viewerAnonId={viewerAnonId} />;

  const live = play.isLive;
  const when = live
    ? 'playing now'
    : `played ${formatTimeSince(Date.now() - (play.endedAt ?? play.startedAt))} ago`;
  const match = play.tasteScore ? ` · ${play.tasteScore}% match` : '';

  const details = (
    <View className="px-6 pt-2 pb-4">
      {play.albumArtUrl ? (
        <Image source={{ uri: play.albumArtUrl }} className="w-full aspect-square rounded-[14px] bg-card" />
      ) : null}
      <Text className="font-mono-light text-[26px] text-ink mt-6" numberOfLines={2}>{play.trackTitle}</Text>
      <Text className="font-mono text-[15px] text-ink-muted mt-1" numberOfLines={1}>{play.artistName}</Text>
      <View className="flex-row items-center mt-2">
        {live && <View className="w-1.5 h-1.5 rounded-full bg-live mr-1.5" />}
        <Text className="font-mono text-[13px] text-ink-dim">{when}{match}</Text>
      </View>

      <View className="mt-6">
        <Reactions broadcastId={play.id} />
      </View>

      {play.anonymousId ? (
        <OutlineButton
          label="message the listener"
          onPress={() => router.push(`/dm?recipientAnonId=${play.anonymousId}`)}
          accessibilityLabel="Send direct message"
          className="mt-6"
        />
      ) : null}

      <SectionLabel title="COMMENTS" className="mt-10" />
    </View>
  );

  return <CommentThread broadcastId={play.id} viewerAnonId={viewerAnonId} header={details} />;
}
