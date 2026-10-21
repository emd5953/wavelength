import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Text,
  View,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import {
  addReaction,
  FeedBroadcast,
  friendlyError,
  getReactionCounts,
  ReactionCount,
  sendConnectionRequest,
} from "../services/api";
import {
  Artwork,
  Avatar,
  Button,
  Copy,
  feedback,
  IconButton,
  Label,
  Notice,
  Sheet,
  styles,
  color,
  useReducedMotion,
} from "../design/ui";
import {
  Coordinate,
  distanceLabel,
  listenerName,
  timeAgo,
} from "../utils/discovery";
const reactions = [
  { type: "fire", emoji: "🔥", label: "Fire" },
  { type: "heart", emoji: "♥", label: "Love" },
  { type: "headphones", emoji: "🎧", label: "Listening" },
  { type: "clap", emoji: "👏", label: "Applause" },
  { type: "surprised", emoji: "😮", label: "Surprised" },
];
export default function TrackSheet({
  play,
  location,
  onClose,
}: {
  play: FeedBroadcast | null;
  location: Coordinate | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [counts, setCounts] = useState<ReactionCount>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reacted, setReacted] = useState("");
  const scale = useRef(new Animated.Value(1)).current;
  const activeId = useRef<string | undefined>(undefined);
  activeId.current = play?.id;
  useEffect(() => {
    setCounts({});
    setError("");
    setNotice("");
    setReacted("");
    setBusy("");
    if (play) {
      const id = play.id;
      getReactionCounts(id)
        .then((res) => {
          if (activeId.current === id) setCounts(res.counts);
        })
        .catch((e) => {
          if (activeId.current === id) setError(friendlyError(e));
        });
    }
  }, [play?.id]);
  if (!play) return null;
  const react = async (type: string) => {
    if (busy) return;
    const id = play.id;
    setBusy(type);
    setError("");
    try {
      const res = await addReaction(id, type);
      if (activeId.current !== id) return;
      setCounts(res.counts);
      setReacted(type);
      setNotice("Reaction added.");
      feedback();
      if (!reduced)
        Animated.sequence([
          Animated.spring(scale, { toValue: 1.25, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        ]).start();
    } catch (e) {
      if (activeId.current === id) setError(friendlyError(e));
    } finally {
      if (activeId.current === id) setBusy("");
    }
  };
  const connect = async () => {
    const id = play.id;
    setBusy("connect");
    setError("");
    try {
      const { request } = await sendConnectionRequest(play.anonymousId);
      if (activeId.current === id) {
        setNotice(
          request.status === "pending"
            ? "Request sent. Your profiles stay hidden until they accept."
            : `Request ${request.status}.`,
        );
        feedback(true);
      }
    } catch (e) {
      if (activeId.current === id) setError(friendlyError(e));
    } finally {
      if (activeId.current === id) setBusy("");
    }
  };
  const navigate = (path: "/dm" | "/comment-thread") => {
    onClose();
    router.push({
      pathname: path,
      params:
        path === "/dm"
          ? { recipientAnonId: play.anonymousId }
          : { broadcastId: play.id },
    });
  };
  return (
    <Sheet visible={!!play} onClose={onClose}>
      <View style={[styles.row, { marginBottom: 14 }]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            flex: 1,
          }}
        >
          <Avatar id={play.anonymousId} />
          <View style={{ flex: 1 }}>
            <Copy style={{ fontSize: 13 }}>
              {listenerName(play.anonymousId)}
            </Copy>
            <Copy style={{ fontSize: 12, color: color.muted }}>
              {distanceLabel(location, play.location)}
            </Copy>
          </View>
        </View>
        <IconButton name="x" label="Close track details" onPress={onClose} />
      </View>
      <View
        style={{
          alignItems: "center",
          overflow: "hidden",
          borderRadius: 20,
          paddingVertical: 12,
        }}
      >
        {!!play.albumArtUrl && (
          <Image
            source={{ uri: play.albumArtUrl }}
            blurRadius={45}
            accessible={false}
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              opacity: 0.22,
            }}
          />
        )}
        <Artwork
          uri={play.albumArtUrl}
          size={Math.min(width - 96, 270)}
          title={`Cover for ${play.trackTitle}`}
        />
      </View>
      <Label
        style={{
          color: play.isLive ? color.coral : color.muted,
          marginTop: 22,
        }}
      >
        {play.isLive
          ? "● PLAYING NOW"
          : `PLAYED ${timeAgo(play.endedAt ?? play.startedAt).toUpperCase()}`}
      </Label>
      <Text
        style={{
          color: color.paper,
          fontSize: 30,
          fontWeight: "800",
          letterSpacing: -1,
          marginTop: 8,
        }}
      >
        {play.trackTitle}
      </Text>
      <Copy style={{ color: color.muted, marginTop: 3 }}>
        {play.artistName}
      </Copy>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginVertical: 20,
        }}
      >
        {reactions.map((r) => (
          <Animated.View
            key={r.type}
            style={{ transform: [{ scale: reacted === r.type ? scale : 1 }] }}
          >
            <Pressable
              disabled={!!busy}
              accessibilityRole="button"
              accessibilityLabel={`${r.label} reaction, ${counts[r.type] ?? 0}`}
              accessibilityState={{ disabled: !!busy }}
              onPress={() => react(r.type)}
              style={{
                minWidth: 48,
                minHeight: 48,
                padding: 10,
                borderRadius: 14,
                backgroundColor:
                  reacted === r.type ? color.coralDim : color.raised,
                opacity: busy ? 0.6 : 1,
                flexDirection: "row",
                gap: 5,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 21, color: color.coral }}>
                {r.emoji}
              </Text>
              {counts[r.type] > 0 && (
                <Text style={{ color: color.paper, fontSize: 12 }}>
                  {counts[r.type]}
                </Text>
              )}
            </Pressable>
          </Animated.View>
        ))}
      </View>
      {error ? (
        <Notice error message={error} />
      ) : notice ? (
        <Notice message={notice} />
      ) : null}
      <View style={{ gap: 10 }}>
        <Button
          title="Join the conversation"
          icon="message-circle"
          secondary
          onPress={() => navigate("/comment-thread")}
        />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button
            title="Message"
            icon="send"
            secondary
            style={{ flex: 1 }}
            onPress={() => navigate("/dm")}
          />
          <Button
            title="Connect"
            icon="plus"
            style={{ flex: 1 }}
            busy={busy === "connect"}
            disabled={!!busy || notice.startsWith("Request sent")}
            onPress={connect}
          />
        </View>
      </View>
      <Copy
        style={{
          color: color.muted,
          fontSize: 12,
          lineHeight: 18,
          marginTop: 16,
        }}
      >
        Reactions and comments stay with this play. Messages go to this
        listener. Connecting reveals your Spotify profiles to each other.
      </Copy>
    </Sheet>
  );
}
