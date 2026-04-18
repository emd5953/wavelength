import { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { getComments, addComment } from '../services/api';
import type { Comment } from '../services/api';

interface CommentThreadProps {
  broadcastId: string;
  viewerAnonId: string;
}

export default function CommentThread({ broadcastId, viewerAnonId }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getComments(broadcastId)
      .then((res) => setComments(res.comments))
      .catch(() => {});
  }, [broadcastId]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await addComment(broadcastId, viewerAnonId, text.trim());
      setComments((prev) => [...prev, res.comment]);
      setText('');
    } catch {
      // silently fail
    } finally {
      setSending(false);
    }
  };

  return (
    <View className="flex-1 bg-surface">
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-4 py-2 border-b border-surface-elevated">
            <Text className="text-xs text-muted-dark mb-0.5">
              {item.authorAnonId.slice(0, 8)}
            </Text>
            <Text className="text-sm text-neutral-300">{item.text}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text className="text-center text-muted-dark mt-8 text-sm">No comments yet</Text>
        }
      />
      <View className="flex-row p-3 border-t border-surface-elevated">
        <TextInput
          className="flex-1 border border-muted-border rounded-[20px] px-4 py-2 text-sm text-white bg-surface-card"
          value={text}
          onChangeText={setText}
          placeholder="Add a comment..."
          placeholderTextColor="#666"
          accessibilityLabel="Comment input"
        />
        <TouchableOpacity
          className="ml-2 justify-center px-4"
          onPress={handleSend}
          disabled={sending}
          accessibilityLabel="Send comment"
          accessibilityRole="button"
        >
          <Text className="text-spotify font-bold text-sm">Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
