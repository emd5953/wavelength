import { View, Text, Image, StyleSheet } from 'react-native';
import type { FeedBroadcast } from '../services/api';

function formatTimeSince(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function BroadcastCard({ broadcast }: { broadcast: FeedBroadcast }) {
  return (
    <View style={styles.card} accessibilityRole="summary">
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
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
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
    fontWeight: '600',
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
});
