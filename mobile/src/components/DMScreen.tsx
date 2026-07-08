import { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Switch, KeyboardAvoidingView, Platform } from 'react-native';
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
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: '#1a0a0a' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isMe = item.senderAnonId === myAnonId;
          return (
            <View className={`mx-4 my-1 ${isMe ? 'items-end' : 'items-start'}`}>
              <View
                className="max-w-[75%] px-4 py-3 rounded-2xl"
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
                <Text className="text-sm text-white/80 leading-5">{item.text}</Text>
                {item.includesConnectionRequest && (
                  <View
                    className="flex-row items-center mt-2 pt-2"
                    style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}
                  >
                    <Text style={{ fontSize: 12 }}>🤝</Text>
                    <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '600', marginLeft: 4 }}>
                      Connection request
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View className="items-center mt-16">
            <Text style={{ fontSize: 32 }}>✉️</Text>
            <Text className="text-white/35 mt-3 text-sm">Start a conversation</Text>
          </View>
        }
        contentContainerStyle={{ padding: 12 }}
      />

      {/* Connection request toggle */}
      <View
        className="flex-row items-center justify-between px-4 py-2.5"
        style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', backgroundColor: '#2a1215' }}
      >
        <Text className="text-xs text-white/50">Include connection request</Text>
        <Switch
          value={includeConnectionReq}
          onValueChange={setIncludeConnectionReq}
          trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(220,38,38,0.5)' }}
          thumbColor={includeConnectionReq ? '#DC2626' : 'rgba(255,255,255,0.4)'}
          accessibilityLabel="Include connection request with message"
        />
      </View>

      {/* Input */}
      <View
        className="flex-row items-center p-3"
        style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', backgroundColor: '#2a1215' }}
      >
        <TextInput
          className="flex-1 rounded-2xl px-4 py-2.5 text-sm text-white"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          accessibilityLabel="Message input"
        />
        <TouchableOpacity
          className="ml-2 px-4 py-2.5 rounded-xl"
          style={{ backgroundColor: text.trim() ? '#DC2626' : 'rgba(255,255,255,0.07)' }}
          onPress={handleSend}
          disabled={sending || !text.trim()}
          accessibilityLabel="Send message"
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
