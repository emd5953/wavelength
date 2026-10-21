import { useEffect, useState, type ReactElement } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text } from 'react-native';
import { getComments, addComment } from '../services/api';
import type { Comment } from '../services/api';
import { Bubble, BubbleText, Composer } from './Conversation';
import { EmptyState } from './ui';

interface CommentThreadProps {
  broadcastId: string;
  viewerAnonId: string;
  /** Rendered above the comments and scrolls with them (the play screen's song details). */
  header?: ReactElement;
}

export default function CommentThread({ broadcastId, viewerAnonId, header }: CommentThreadProps) {
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
      const res = await addComment(broadcastId, text.trim());
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
      className="flex-1 bg-ground"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Bubble mine={item.authorAnonId === viewerAnonId} author={`listener ${item.authorAnonId.slice(0, 4)}`}>
            <BubbleText text={item.text} />
          </Bubble>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          header ? null : (
            <EmptyState title="no comments yet." body="say what this song makes you think of." />
          )
        }
        contentContainerStyle={{ paddingVertical: 12 }}
      />
      <Composer
        value={text}
        onChangeText={setText}
        onSend={handleSend}
        sending={sending}
        placeholder="…"
        inputLabel="Comment input"
        sendLabel="Send comment"
      />
    </KeyboardAvoidingView>
  );
}
