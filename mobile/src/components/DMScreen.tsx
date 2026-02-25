import { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Switch } from 'react-native';
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
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.senderAnonId === myAnonId ? styles.mine : styles.theirs]}>
            <Text style={styles.msgText}>{item.text}</Text>
            {item.includesConnectionRequest && (
              <Text style={styles.connReq}>🤝 Connection request included</Text>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Start a conversation</Text>}
        contentContainerStyle={styles.list}
      />
      <View style={styles.connRow}>
        <Text style={styles.connLabel}>Include connection request</Text>
        <Switch
          value={includeConnectionReq}
          onValueChange={setIncludeConnectionReq}
          accessibilityLabel="Include connection request with message"
        />
      </View>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          accessibilityLabel="Message input"
        />
        <TouchableOpacity
          style={styles.sendBtn}
          onPress={handleSend}
          disabled={sending}
          accessibilityLabel="Send message"
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
    backgroundColor: '#fff',
  },
  list: {
    padding: 12,
  },
  bubble: {
    maxWidth: '75%',
    padding: 10,
    borderRadius: 12,
    marginVertical: 4,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: '#DCF8C6',
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
  msgText: {
    fontSize: 14,
    color: '#333',
  },
  connReq: {
    fontSize: 12,
    color: '#1DB954',
    marginTop: 4,
  },
  empty: {
    textAlign: 'center',
    color: '#999',
    marginTop: 32,
    fontSize: 14,
  },
  connRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  connLabel: {
    fontSize: 13,
    color: '#666',
  },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
  },
  sendBtn: {
    marginLeft: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sendText: {
    color: '#1DB954',
    fontWeight: '600',
    fontSize: 14,
  },
});
