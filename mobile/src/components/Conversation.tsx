import { useCallback, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  addComment,
  Comment,
  DMMessage,
  friendlyError,
  getComments,
  getDMThread,
  sendConnectionRequest,
  sendDM,
} from "../services/api";
import {
  Avatar,
  Button,
  Copy,
  EmptyState,
  feedback,
  Label,
  Notice,
  color,
  styles,
} from "../design/ui";
import { listenerName } from "../utils/discovery";
type Message = Comment | DMMessage;
export default function Conversation({
  id,
  kind,
  viewerAnonId = "",
}: {
  id: string;
  kind: "comments" | "dm";
  viewerAnonId?: string;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const list = useRef<FlatList<Message>>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const revision = useRef(0);
  const active = useRef(false);
  const atBottom = useRef(true);
  const load = useCallback(async () => {
    const version = revision.current;
    try {
      const result =
        kind === "dm"
          ? (await getDMThread(id)).messages
          : (await getComments(id)).comments;
      if (active.current && revision.current === version) {
        setMessages(result);
        setLoadError("");
      }
    } catch (e) {
      if (active.current) setLoadError(friendlyError(e));
    } finally {
      if (active.current) setLoading(false);
    }
  }, [id, kind]);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      load();
      const interval = setInterval(() => {
        if (AppState.currentState === "active") load();
      }, 8000);
      return () => {
        active.current = false;
        clearInterval(interval);
      };
    }, [load]),
  );
  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    revision.current++;
    try {
      const item =
        kind === "dm"
          ? (await sendDM(id, text.trim())).dm
          : (await addComment(id, text.trim())).comment;
      revision.current++;
      setMessages((prev) => [...prev.filter((m) => m.id !== item.id), item]);
      setText("");
      setNotice(kind === "dm" ? "Message sent." : "Comment posted.");
      atBottom.current = true;
      feedback();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSending(false);
    }
  };
  const connect = async () => {
    setConnecting(true);
    setError("");
    try {
      const res = await sendConnectionRequest(id);
      setRequested(res.request.status === "pending");
      setNotice(
        `Connection request ${res.request.status}. Your profiles are revealed only after acceptance.`,
      );
      feedback(true);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setConnecting(false);
    }
  };
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top + 56}
    >
      <View
        style={{
          padding: 20,
          paddingTop: 12,
          borderBottomWidth: 1,
          borderBottomColor: color.line,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar id={id} size={42} />
          <View style={{ flex: 1 }}>
            <Copy style={{ fontWeight: "700" }}>
              {kind === "dm" ? listenerName(id) : "A moment worth sharing"}
            </Copy>
            <Copy style={{ color: color.muted, fontSize: 12 }}>
              {kind === "dm"
                ? "Anonymous until you both connect"
                : "Comments on this specific play"}
            </Copy>
          </View>
        </View>
        {kind === "dm" && (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Button
              title={requested ? "Request sent" : "Ask to connect"}
              icon="user-plus"
              secondary
              busy={connecting}
              disabled={requested}
              style={{ flex: 1 }}
              onPress={connect}
            />
            <Button
              title="Requests"
              secondary
              onPress={() => router.push("/connection-requests")}
            />
          </View>
        )}
      </View>
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, flexGrow: 1 }}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } =
            e.nativeEvent;
          atBottom.current =
            contentOffset.y + layoutMeasurement.height >=
            contentSize.height - 80;
        }}
        scrollEventThrottle={100}
        onContentSizeChange={() => {
          if (atBottom.current) list.current?.scrollToEnd({ animated: false });
        }}
        renderItem={({ item }) => {
          const sender =
            "senderAnonId" in item ? item.senderAnonId : item.authorAnonId;
          const mine =
            "senderAnonId" in item ? sender !== id : sender === viewerAnonId;
          return (
            <View
              style={{
                alignItems: mine ? "flex-end" : "flex-start",
                marginBottom: 18,
              }}
            >
              <View
                style={{
                  maxWidth: "87%",
                  borderRadius: 20,
                  borderBottomRightRadius: mine ? 5 : 20,
                  borderBottomLeftRadius: mine ? 20 : 5,
                  backgroundColor: mine ? color.iceDim : color.surface,
                  padding: 15,
                }}
              >
                {kind === "comments" && (
                  <Label
                    style={{ fontSize: 9, color: color.ice, marginBottom: 5 }}
                  >
                    {mine ? "YOU" : listenerName(sender)}
                  </Label>
                )}
                <Copy>{item.text}</Copy>
                {"includesConnectionRequest" in item &&
                  item.includesConnectionRequest && (
                    <Copy
                      style={{ fontSize: 12, color: color.ice, marginTop: 8 }}
                    >
                      Interested in connecting · check Requests
                    </Copy>
                  )}
              </View>
              <Text
                style={{
                  color: color.muted,
                  fontSize: 11,
                  marginTop: 6,
                  marginHorizontal: 5,
                }}
              >
                {mine ? "You · " : ""}
                {new Date(item.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}{" "}
                ·{" "}
                {new Date(item.createdAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            loading={loading}
            title={
              loading
                ? "Tuning in…"
                : loadError
                  ? "Unable to load this conversation"
                  : kind === "dm"
                    ? "Start with the song."
                    : "Be the first voice."
            }
            body={
              loading
                ? undefined
                : loadError
                  ? "Your conversation will appear when Wavelength reconnects."
                  : kind === "dm"
                    ? "A good track is a good icebreaker. Say hello to the person behind it."
                    : "What does this track make you feel? Leave a thought for this play."
            }
            action={loadError ? "Try again" : undefined}
            onAction={load}
          />
        }
      />
      {(error || loadError || notice) && (
        <View style={{ paddingHorizontal: 20 }}>
          <Notice
            error={!!(error || loadError)}
            message={error || loadError || notice}
          />
        </View>
      )}
      <View
        style={{
          padding: 14,
          paddingBottom: Math.max(insets.bottom, 14),
          backgroundColor: color.surface,
          borderTopWidth: 1,
          borderTopColor: color.line,
          flexDirection: "row",
          gap: 10,
          alignItems: "flex-end",
        }}
      >
        <TextInput
          accessibilityLabel={kind === "dm" ? "Message input" : "Comment input"}
          editable={!sending}
          value={text}
          onChangeText={setText}
          placeholder={
            kind === "dm" ? "Say something about the music…" : "Add your voice…"
          }
          placeholderTextColor={color.muted}
          multiline
          maxLength={2000}
          style={{
            minHeight: 52,
            maxHeight: 130,
            flex: 1,
            borderRadius: 16,
            backgroundColor: color.raised,
            color: color.paper,
            padding: 14,
            paddingTop: 16,
            fontSize: 15,
          }}
        />
        <Button
          title="Send"
          icon="arrow-up"
          onPress={send}
          busy={sending}
          disabled={!text.trim()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
