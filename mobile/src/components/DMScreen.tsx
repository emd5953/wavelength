import { useEffect, useState } from 'react';
import { View, Text, FlatList, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { getDMThread, sendDM } from '../services/api';
import type { DMMessage } from '../services/api';
import { Bubble, BubbleText, Composer } from './Conversation';
import { EmptyState, COLORS } from './ui';

interface DMScreenProps {
  recipientAnonId: string;
}

export default function DMScreen({ recipientAnonId }: DMScreenProps) {
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [text, setText] = useState('');
  const [includeConnectionReq, setIncludeConnectionReq] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getDMThread(recipientAnonId)
      .then((res) => setMessages(res.messages))
      .catch(() => {});
  }, [recipientAnonId]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await sendDM(recipientAnonId, text.trim(), includeConnectionReq);
      setMessages((prev) => [...prev, res.dm]);
      setText('');
      setIncludeConnectionReq(false);
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
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          // A thread spans all of my sessions, so "mine" is anything the other side didn't send
          <Bubble mine={item.senderAnonId !== recipientAnonId}>
            <BubbleText text={item.text} />
            {item.includesConnectionRequest && (
              <Text className="font-mono text-[11px] text-ink-muted mt-2 pt-2 border-t border-rule">
                + asked to connect
              </Text>
            )}
          </Bubble>
        )}
        ListEmptyComponent={
          <EmptyState title="say hello." body="they won't know who you are unless you both choose to connect." />
        }
        contentContainerStyle={{ paddingVertical: 12 }}
      />

      {/* Connection request toggle */}
      <View className="flex-row items-center justify-between px-4 py-2.5 bg-night border-t border-rule">
        <Text className="font-mono text-[12px] text-ink-muted">ask to connect with this message</Text>
        <Switch
          value={includeConnectionReq}
          onValueChange={setIncludeConnectionReq}
          trackColor={{ false: COLORS.rule, true: COLORS.primary }}
          thumbColor={includeConnectionReq ? COLORS.ink : COLORS.inkDim}
          accessibilityLabel="Include connection request with message"
        />
      </View>

      <Composer
        value={text}
        onChangeText={setText}
        onSend={handleSend}
        sending={sending}
        placeholder="write something…"
        inputLabel="Message input"
        sendLabel="Send message"
      />
    </KeyboardAvoidingView>
  );
}
