import { useCallback, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import {
  getConnectionDetail,
  getConnectionMessages,
  sendConnectionMessage,
  ConnectionGoneError,
  type ConnectionMessage,
} from '../src/services/api';
import { Bubble, BubbleText, Composer } from '../src/components/Conversation';
import { EmptyState, Screen } from '../src/components/ui';

const POLL_INTERVAL = 5_000;

/** Chat with a connection. Polls while focused; there's no push for new messages yet. */
export default function ChatScreen() {
  const { connectionId } = useLocalSearchParams<{ connectionId: string }>();
  const navigation = useNavigation();
  const [messages, setMessages] = useState<ConnectionMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [gone, setGone] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!connectionId) return;
      let active = true;

      // The name comes from the connection, not the URL, so titles with "+" or "&" survive
      getConnectionDetail(connectionId)
        .then(({ connection }) => {
          if (active) navigation.setOptions({ title: connection.profile.displayName.toLowerCase() });
        })
        .catch(() => {});

      const load = () =>
        getConnectionMessages(connectionId)
          .then((m) => active && setMessages(m))
          .catch((err) => {
            if (err instanceof ConnectionGoneError && active) {
              setGone(true);
              clearInterval(timer);
            }
          });
      load();
      const timer = setInterval(load, POLL_INTERVAL);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [connectionId, navigation]),
  );

  const handleSend = async () => {
    if (!connectionId || !text.trim() || sending) return;
    setSending(true);
    try {
      const message = await sendConnectionMessage(connectionId, text.trim());
      setMessages((prev) => [...prev, message]);
      setText('');
    } catch (err) {
      if (err instanceof ConnectionGoneError) setGone(true);
    } finally {
      setSending(false);
    }
  };

  if (gone) {
    return (
      <Screen>
        <EmptyState title="this connection was removed." body="anything after this is anonymous again." />
      </Screen>
    );
  }

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
          <Bubble mine={item.mine}>
            <BubbleText text={item.text} />
          </Bubble>
        )}
        ListEmptyComponent={<EmptyState title="say hello." body="you're connected now — no more anonymous." />}
        contentContainerStyle={{ paddingVertical: 12 }}
      />
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
