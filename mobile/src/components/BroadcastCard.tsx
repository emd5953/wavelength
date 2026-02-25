import { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
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
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.top}>
        <Image
          source={{ uri: broadcast.albumArtUrl }}
          style={styles.albumArt}
          accessibilityLabel={`Album art for ${broadcast.trackTitle}`}
        />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{broadcast.trackTitle}</Text>
          <Text style={styles.artist} numberOfLines={1}>{broadcast.artistName}</Text>
          <Text style={styles.time}>{formatTimeSince(broadcast.timeSinceStart)}</Text>
        </View>
      </View>

      <View style={styles.reactions}>
        {REACTIONS.map((r) => (
          <TouchableOpacity
            key={r.type}
            style={styles.reactionBtn}
            onPress={() => handleReaction(r.type)}
            accessibilityLabel={`React with ${r.type}`}
            accessibilityRole="button"
          >
            <Text style={styles.emoji}>{r.emoji}</Text>
            {counts[r.type] ? <Text style={styles.count}>{counts[r.type]}</Text> : null}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.actions}>
        {onOpenComments && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onOpenComments(broadcast.id)}
            accessibilityLabel="View comments"
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>💬 Comments</Text>
          </TouchableOpacity>
        )}
        {onOpenDM && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onOpenDM(broadcast.anonymousId)}
            accessibilityLabel="Send direct message"
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>✉️ Message</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  top: {
    flexDirection: 'row',
  },
  albumArt: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
  },
  artist: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  time: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  reactions: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
  },
  emoji: {
    fontSize: 16,
  },
  count: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  actionText: {
    fontSize: 13,
    color: '#333',
  },
});
