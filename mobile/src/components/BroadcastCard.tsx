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
      className="mx-4 my-1.5 rounded-2xl overflow-hidden"
      style={{
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
      }}
      accessibilityRole="summary"
    >
      <View className="p-4">
        <View className="flex-row">
          <Image
            source={{ uri: broadcast.albumArtUrl }}
            className="w-16 h-16 rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
            accessibilityLabel={`Album art for ${broadcast.trackTitle}`}
          />
          <View className="flex-1 ml-3.5 justify-center">
            <Text className="text-base font-bold text-white" numberOfLines={1}>
              {broadcast.trackTitle}
            </Text>
            <Text className="text-sm text-white/60 mt-0.5" numberOfLines={1}>
              {broadcast.artistName}
            </Text>
            <View className="flex-row items-center mt-1.5 gap-2">
              <View className="flex-row items-center gap-1">
                <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#DC2626' }} />
                <Text className="text-xs text-white/35">
                  {formatTimeSince(broadcast.timeSinceStart)}
                </Text>
              </View>
              {broadcast.tasteScore != null && broadcast.tasteScore > 0 && (
                <View
                  className="px-2 py-0.5 rounded-lg"
                  style={{ backgroundColor: 'rgba(220,38,38,0.2)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.3)' }}
                >
                  <Text style={{ fontSize: 10, color: '#EF4444', fontWeight: '700' }}>
                    {broadcast.tasteScore}% match
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Reactions */}
        <View className="flex-row mt-3 gap-1.5">
          {REACTIONS.map((r) => {
            const count = counts[r.type];
            const hasCount = count != null && count > 0;
            return (
              <TouchableOpacity
                key={r.type}
                className="flex-row items-center px-2.5 py-1.5 rounded-xl"
                style={{
                  backgroundColor: hasCount ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.06)',
                  borderWidth: hasCount ? 1 : 0,
                  borderColor: 'rgba(220,38,38,0.25)',
                }}
                onPress={() => handleReaction(r.type)}
                accessibilityLabel={`React with ${r.type}`}
                accessibilityRole="button"
              >
                <Text style={{ fontSize: 14 }}>{r.emoji}</Text>
                {hasCount && (
                  <Text className="text-xs text-white/60 ml-1">{count}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Action bar */}
      <View className="flex-row" style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
        {onOpenComments && (
          <TouchableOpacity
            className="flex-1 py-3 items-center flex-row justify-center gap-1.5"
            style={{ borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)' }}
            onPress={() => onOpenComments(broadcast.id)}
            accessibilityLabel="View comments"
            accessibilityRole="button"
          >
            <Text style={{ fontSize: 13 }}>💬</Text>
            <Text className="text-xs text-white/50 font-medium">Comments</Text>
          </TouchableOpacity>
        )}
        {onOpenDM && (
          <TouchableOpacity
            className="flex-1 py-3 items-center flex-row justify-center gap-1.5"
            onPress={() => onOpenDM(broadcast.anonymousId)}
            accessibilityLabel="Send direct message"
            accessibilityRole="button"
          >
            <Text style={{ fontSize: 13 }}>✉️</Text>
            <Text className="text-xs text-white/50 font-medium">Message</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
