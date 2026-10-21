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
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

interface BroadcastCardProps {
  broadcast: FeedBroadcast;
  onOpenComments?: (broadcastId: string) => void;
  onOpenDM?: (recipientAnonId: string) => void;
}

export default function BroadcastCard({
  broadcast,
  onOpenComments,
  onOpenDM,
}: BroadcastCardProps) {
  const [counts, setCounts] = useState<ReactionCount>({});

  const handleReaction = async (type: string) => {
    try {
      const result = await addReaction(broadcast.id, type);
      setCounts(result.counts);
    } catch {
      // silently fail
    }
  };

  const when = broadcast.isLive
    ? 'playing now'
    : formatTimeSince(Date.now() - (broadcast.endedAt ?? broadcast.startedAt));
  const match = broadcast.tasteScore != null && broadcast.tasteScore > 0
    ? ` · ${broadcast.tasteScore}% match`
    : '';

  return (
    <View
      className="mx-4 my-1.5 rounded-[14px] overflow-hidden bg-card border border-rule"
      accessibilityRole="summary"
    >
      <View className="p-4">
        <View className="flex-row">
          <Image
            source={{ uri: broadcast.albumArtUrl }}
            className="w-14 h-14 rounded-lg bg-card"
            accessibilityLabel={`Album art for ${broadcast.trackTitle}`}
          />
          <View className="flex-1 ml-3.5 justify-center">
            <Text className="font-mono-medium text-[15px] text-ink" numberOfLines={1}>
              {broadcast.trackTitle}
            </Text>
            <Text className="font-mono text-[13px] text-ink-muted mt-0.5" numberOfLines={1}>
              {broadcast.artistName}
            </Text>
            <View
              className="flex-row items-center mt-1.5"
              accessibilityLabel={broadcast.isLive ? 'Playing now' : `Played ${when}`}
            >
              {broadcast.isLive && <View className="w-1.5 h-1.5 rounded-full bg-live mr-1.5" />}
              <Text className="font-mono text-xs text-ink-dim">
                {when}{match}
              </Text>
            </View>
          </View>
        </View>

        {/* Reactions — the one place emoji stay, because they are the content */}
        <View className="flex-row mt-3.5 gap-1">
          {REACTIONS.map((r) => {
            const count = counts[r.type];
            const hasCount = count != null && count > 0;
            return (
              <TouchableOpacity
                key={r.type}
                className={`flex-row items-center px-2 py-1 rounded-full ${hasCount ? 'bg-card border border-rule' : ''}`}
                onPress={() => handleReaction(r.type)}
                accessibilityLabel={`React with ${r.type}`}
                accessibilityRole="button"
              >
                <Text style={{ fontSize: 13 }}>{r.emoji}</Text>
                {hasCount && <Text className="font-mono text-[11px] text-ink-dim ml-1">{count}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Action bar */}
      <View className="flex-row border-t border-rule">
        {onOpenComments && (
          <TouchableOpacity
            className="flex-1 py-3 items-center"
            onPress={() => onOpenComments(broadcast.id)}
            accessibilityLabel="View comments"
            accessibilityRole="button"
          >
            <Text className="font-mono text-xs text-ink-muted">comment</Text>
          </TouchableOpacity>
        )}
        {onOpenComments && onOpenDM && <View className="w-px bg-rule" />}
        {onOpenDM && (
          <TouchableOpacity
            className="flex-1 py-3 items-center"
            onPress={() => onOpenDM(broadcast.anonymousId)}
            accessibilityLabel="Send direct message"
            accessibilityRole="button"
          >
            <Text className="font-mono text-xs text-ink-muted">message</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
