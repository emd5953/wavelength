import { View, Text, Image, TouchableOpacity } from 'react-native';
import type { FeedBroadcast } from '../services/api';

export function formatTimeSince(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

interface BroadcastRowProps {
  broadcast: FeedBroadcast;
  onOpen: (broadcast: FeedBroadcast) => void;
}

/** One play in the feed: art, track, artist, when. Tapping opens the play. */
export default function BroadcastRow({ broadcast, onOpen }: BroadcastRowProps) {
  const when = broadcast.isLive
    ? 'now'
    : formatTimeSince(Date.now() - (broadcast.endedAt ?? broadcast.startedAt));
  const match = broadcast.tasteScore != null && broadcast.tasteScore > 0 ? ` · ${broadcast.tasteScore}%` : '';

  return (
    <TouchableOpacity
      className="flex-row items-center px-6 py-3.5"
      onPress={() => onOpen(broadcast)}
      accessibilityRole="button"
      accessibilityLabel={`${broadcast.trackTitle} by ${broadcast.artistName}, ${broadcast.isLive ? 'playing now' : `played ${when} ago`}`}
    >
      <Image source={{ uri: broadcast.albumArtUrl }} className="w-12 h-12 rounded-md bg-card" />
      <View className="flex-1 ml-4">
        <Text className="font-mono-medium text-[15px] text-ink" numberOfLines={1}>
          {broadcast.trackTitle}
        </Text>
        <View className="flex-row items-center mt-1">
          <Text className="font-mono text-[13px] text-ink-muted flex-shrink" numberOfLines={1}>
            {broadcast.artistName}
          </Text>
          <Text className="font-mono text-[13px] text-ink-dim"> · </Text>
          {broadcast.isLive && <View className="w-1.5 h-1.5 rounded-full bg-live mr-1.5" />}
          <Text className="font-mono text-[13px] text-ink-dim">{when}{match}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
