import { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Switch } from 'react-native';
import { getDMThread, sendDM } from '../services/api';
import type { DMMessage } from '../services/api';

interface DMScreenProps {
  myAnonId: string;
  recipientAnonId: string;
}

export default function DMScreen({ myAnonId, recipientAnonId }: DMScreenProps) {
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [text, setText] = useState('');
  const [includeConnectionReq, setIncludeConnectionReq] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getDMThread(myAnonId, recipientAnonId)
      .then((res) => setMessages(res.messages))
      .catch(() => {});
  }, [myAnonId, recipientAnonId]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await sendDM(myAnonId, recipientAnonId, text.trim(), includeConnectionReq);
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
    <View className="flex-1 bg-surface">
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            className={`max-w-[75%] p-2.5 rounded-xl my-1 ${
              item.senderAnonId === myAnonId
                ? 'self-end bg-chat-mine'
                : 'self-start bg-surface-elevated'
            }`}
          >
            <Text className="text-sm text-neutral-300">{item.text}</Text>
            {item.includesConnectionRequest && (
              <Text className="text-xs text-spotify mt-1">🤝 Connection request included</Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          <Text className="text-center text-muted-dark mt-8 text-sm">Start a conversation</Text>
        }
        contentContainerStyle={{ padding: 12 }}
      />
      <View className="flex-row items-center justify-between px-4 py-2 border-t border-surface-elevated">
        <Text className="text-[13px] text-muted-light">Include connection request</Text>
        <Switch
          value={includeConnectionReq}
          onValueChange={setIncludeConnectionReq}
          accessibilityLabel="Include connection request with message"
        />
      </View>
      <View className="flex-row p-3 border-t border-surface-elevated">
        <TextInput
          className="flex-1 border border-muted-border rounded-[20px] px-4 py-2 text-sm text-white bg-surface-card"
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor="#666"
          accessibilityLabel="Message input"
        />
        <TouchableOpacity
          className="ml-2 justify-center px-4"
          onPress={handleSend}
          disabled={sending}
          accessibilityLabel="Send message"
          accessibilityRole="button"
        >
          <Text className="text-spotify font-bold text-sm">Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
