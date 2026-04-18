import { useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import type { FeedBroadcast, ReactionCount } from '../services/api';
import { addReaction } from '../services/api';

const REACTIONS = [
  { type: 'fire', emoji: '🔥' },
  { type: 'heart', emoji: '❤️' },
  { type: 'headphones', emoji: '🎧' },
  { type: 'clap', emoji: '👏' },
  { type: 'surprised', emoji: '😮' },
] as const;

function formatTimeSince(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

interface BroadcastCardProps {
  broadcast: FeedBroadcast;
  viewerAnonId: string;
  onOpenComments?: (broadcastId: string) => void;
  onOpenDM?: (recipientAnonId: string) => void;
}

export default function BroadcastCard({
  broadcast,
  viewerAnonId,
  onOpenComments,
  onOpenDM,
}: BroadcastCardProps) {
  const [counts, setCounts] = useState<ReactionCount>({});

  const handleReaction = async (type: string) => {
    try {
      const result = await addReaction(broadcast.id, viewerAnonId, type);
      setCounts(result.counts);
    } catch {
      // silently fail
    }
  };

  return (
    <View
      className="p-3 mx-4 my-1.5 bg-surface-card rounded-xl shadow-sm shadow-black/20"
      accessibilityRole="summary"
    >
      <View className="flex-row">
        <Image
          source={{ uri: broadcast.albumArtUrl }}
          className="w-14 h-14 rounded-lg bg-neutral-200"
          accessibilityLabel={`Album art for ${broadcast.trackTitle}`}
        />
        <View className="flex-1 ml-3 justify-center">
          <Text className="text-base font-bold text-white" numberOfLines={1}>
            {broadcast.trackTitle}
          </Text>
          <Text className="text-sm text-muted-light mt-0.5" numberOfLines={1}>
            {broadcast.artistName}
          </Text>
          <View className="flex-row items-center mt-1 gap-2">
            <Text className="text-xs text-muted-dark">
              {formatTimeSince(broadcast.timeSinceStart)}
            </Text>
            {broadcast.tasteScore != null && broadcast.tasteScore > 0 && (
              <View className="bg-spotify px-1.5 py-0.5 rounded-lg">
                <Text className="text-[10px] text-white font-bold">
                  {broadcast.tasteScore}% match
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View className="flex-row mt-2.5 gap-2">
        {REACTIONS.map((r) => (
          <TouchableOpacity
            key={r.type}
            className="flex-row items-center px-2 py-1 bg-surface-elevated rounded-2xl"
            onPress={() => handleReaction(r.type)}
            accessibilityLabel={`React with ${r.type}`}
            accessibilityRole="button"
          >
            <Text className="text-base">{r.emoji}</Text>
            {counts[r.type] ? (
              <Text className="text-xs text-muted-dark ml-1">{counts[r.type]}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      <View className="flex-row mt-2 gap-3">
        {onOpenComments && (
          <TouchableOpacity
            className="py-1.5 px-3 bg-surface-elevated rounded-lg"
            onPress={() => onOpenComments(broadcast.id)}
            accessibilityLabel="View comments"
            accessibilityRole="button"
          >
            <Text className="text-[13px] text-neutral-400">💬 Comments</Text>
          </TouchableOpacity>
        )}
        {onOpenDM && (
          <TouchableOpacity
            className="py-1.5 px-3 bg-surface-elevated rounded-lg"
            onPress={() => onOpenDM(broadcast.anonymousId)}
            accessibilityLabel="Send direct message"
            accessibilityRole="button"
          >
            <Text className="text-[13px] text-neutral-400">✉️ Message</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
