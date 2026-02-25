import { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
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
    <View style={styles.container}>
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.comment}>
            <Text style={styles.author}>{item.authorAnonId.slice(0, 8)}</Text>
            <Text style={styles.text}>{item.text}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No comments yet</Text>}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Add a comment..."
          accessibilityLabel="Comment input"
        />
        <TouchableOpacity
          style={styles.sendBtn}
          onPress={handleSend}
          disabled={sending}
          accessibilityLabel="Send comment"
          accessibilityRole="button"
        >
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  comment: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  author: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  text: {
    fontSize: 14,
    color: '#ddd',
  },
  empty: {
    textAlign: 'center',
    color: '#666',
    marginTop: 32,
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: '#fff',
    backgroundColor: '#1e1e1e',
  },
  sendBtn: {
    marginLeft: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sendText: {
    color: '#1DB954',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
