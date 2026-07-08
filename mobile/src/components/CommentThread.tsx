import { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
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
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: '#1a0a0a' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isMe = item.authorAnonId === viewerAnonId;
          return (
            <View className={`mx-4 my-1 ${isMe ? 'items-end' : 'items-start'}`}>
              <View
                className="max-w-[80%] px-4 py-3 rounded-2xl"
                style={isMe ? {
                  backgroundColor: 'rgba(220,38,38,0.2)',
                  borderBottomRightRadius: 4,
                } : {
                  backgroundColor: 'rgba(255,255,255,0.07)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderBottomLeftRadius: 4,
                }}
              >
                {!isMe && (
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '600', marginBottom: 4 }}>
                    {item.authorAnonId.slice(0, 8)}
                  </Text>
                )}
                <Text className="text-sm text-white/80 leading-5">{item.text}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View className="items-center mt-16">
            <Text style={{ fontSize: 32 }}>💬</Text>
            <Text className="text-white/35 mt-3 text-sm">No comments yet — be the first</Text>
          </View>
        }
        contentContainerStyle={{ paddingVertical: 12 }}
      />
      <View
        className="flex-row items-center p-3"
        style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', backgroundColor: '#2a1215' }}
      >
        <TextInput
          className="flex-1 rounded-2xl px-4 py-2.5 text-sm text-white"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
          value={text}
          onChangeText={setText}
          placeholder="Add a comment..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          accessibilityLabel="Comment input"
        />
        <TouchableOpacity
          className="ml-2 px-4 py-2.5 rounded-xl"
          style={{ backgroundColor: text.trim() ? '#DC2626' : 'rgba(255,255,255,0.07)' }}
          onPress={handleSend}
          disabled={sending || !text.trim()}
          accessibilityLabel="Send comment"
          accessibilityRole="button"
        >
          <Text style={{ fontWeight: '700', fontSize: 13, color: text.trim() ? '#fff' : 'rgba(255,255,255,0.3)' }}>
            Send
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
