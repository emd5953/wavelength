import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { ReactionCount } from '../services/api';
import { addReaction, getReactionCounts } from '../services/api';

// Words, not emoji: they read as part of the type system and say what they
// mean. The server types are unchanged; only the labels are ours.
const REACTIONS = [
  { type: 'fire', label: 'fire' },
  { type: 'heart', label: 'love' },
  { type: 'headphones', label: 'same' },
  { type: 'clap', label: 'yes' },
  { type: 'surprised', label: 'new to me' },
] as const;

/** The five reactions for a play, with live counts. */
export default function Reactions({ broadcastId }: { broadcastId: string }) {
  const [counts, setCounts] = useState<ReactionCount>({});

  useEffect(() => {
    getReactionCounts(broadcastId)
      .then((res) => setCounts(res.counts))
      .catch(() => {});
  }, [broadcastId]);

  const react = async (type: string) => {
    try {
      const result = await addReaction(broadcastId, type);
      setCounts(result.counts);
    } catch {
      // silently fail
    }
  };

  return (
    <View className="flex-row flex-wrap gap-2">
      {REACTIONS.map((r) => {
        const count = counts[r.type];
        const hasCount = count != null && count > 0;
        return (
          <TouchableOpacity
            key={r.type}
            className={`flex-row items-center px-3.5 py-2 rounded-full border border-rule ${hasCount ? 'bg-card' : ''}`}
            onPress={() => react(r.type)}
            accessibilityLabel={`React: ${r.label}`}
            accessibilityRole="button"
          >
            <Text className={`font-mono text-[13px] ${hasCount ? 'text-ink' : 'text-ink-muted'}`}>{r.label}</Text>
            {hasCount && <Text className="font-mono text-[13px] text-ink-dim ml-2">{count}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
