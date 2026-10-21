import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  acceptConnectionRequest,
  cancelConnectionRequest,
  ConnectionRequestData,
  declineConnectionRequest,
  friendlyError,
  getIncomingRequests,
  getOutgoingRequests,
} from "../services/api";
import {
  Avatar,
  Button,
  Copy,
  EmptyState,
  Entrance,
  feedback,
  Label,
  Notice,
  Sheet,
  Title,
  Wave,
  color,
  styles,
} from "../design/ui";
export default function ConnectionRequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
  const [incoming, setIncoming] = useState<ConnectionRequestData[]>([]);
  const [outgoing, setOutgoing] = useState<ConnectionRequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, out] = await Promise.all([
        getIncomingRequests(),
        getOutgoingRequests(),
      ]);
      setIncoming(inc.requests);
      setOutgoing(out.requests);
      setError("");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
      const clock = setInterval(() => setNow(Date.now()), 30000);
      const poll = setInterval(load, 30000);
      return () => {
        clearInterval(clock);
        clearInterval(poll);
      };
    }, [load]),
  );
  const act = async (
    item: ConnectionRequestData,
    action: "accept" | "decline" | "cancel",
  ) => {
    setBusy(item.id);
    setError("");
    try {
      if (action === "accept") {
        const { connection } = await acceptConnectionRequest(item.id);
        setRevealed(connection.id);
        feedback(true);
      } else if (action === "decline") await declineConnectionRequest(item.id);
      else await cancelConnectionRequest(item.id);
      const change = (prev: ConnectionRequestData[]) =>
        prev.map((r) =>
          r.id === item.id
            ? {
                ...r,
                status: (action === "accept"
                  ? "accepted"
                  : action === "decline"
                    ? "declined"
                    : "cancelled") as ConnectionRequestData["status"],
              }
            : r,
        );
      setIncoming(change);
      setOutgoing(change);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy("");
    }
  };
  return (
    <View style={styles.screen}>
      <View style={{ padding: 24, paddingBottom: 12 }}>
        <Label style={{ color: color.coral }}>
          FROM STRANGERS TO SOMETHING MORE
        </Label>
        <Title style={{ marginTop: 12 }}>Make it mutual.</Title>
        <Copy style={{ color: color.muted, marginTop: 10 }}>
          Accepting shares your Spotify profiles with each other.
        </Copy>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 20 }}>
          {(["incoming", "outgoing"] as const).map((t) => (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected: t === tab }}
              onPress={() => setTab(t)}
              style={{
                flex: 1,
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 14,
                backgroundColor: tab === t ? color.paper : color.surface,
              }}
            >
              <Text
                style={{
                  color: tab === t ? color.ink : color.muted,
                  fontWeight: "700",
                }}
              >
                {t === "incoming" ? "Incoming" : "Outgoing"}
              </Text>
            </Pressable>
          ))}
        </View>
        {error && (
          <>
            <Notice error message={error} />
            <Button title="Refresh requests" secondary onPress={load} />
          </>
        )}
      </View>
      <FlatList
        data={tab === "incoming" ? incoming : outgoing}
        refreshing={loading}
        onRefresh={load}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{
          padding: 24,
          paddingTop: 4,
          paddingBottom: insets.bottom + 24,
        }}
        ListEmptyComponent={
          <EmptyState
            loading={loading}
            title={
              loading
                ? "Checking your frequency…"
                : error
                  ? "Requests unavailable"
                  : "No requests yet."
            }
            body={
              error
                ? "Your requests will appear when Wavelength reconnects."
                : "A shared track can lead somewhere. Start with a listener in Nearby."
            }
          />
        }
        renderItem={({ item }) => {
          const status =
            item.status === "pending" && item.expiresAt <= now
              ? "expired"
              : item.status;
          const minutesLeft = Math.max(
            0,
            Math.ceil((item.expiresAt - now) / 60000),
          );
          const timeLeft =
            minutesLeft >= 60
              ? `${Math.floor(minutesLeft / 60)}h ${minutesLeft % 60}m left`
              : `${minutesLeft}m left`;
          return (
            <View
              style={{
                paddingVertical: 20,
                borderBottomWidth: 1,
                borderBottomColor: color.line,
              }}
            >
              <View
                style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
              >
                <Avatar id={item.id} size={44} />
                <View style={{ flex: 1 }}>
                  <Copy style={{ fontWeight: "600" }}>Anonymous listener</Copy>
                  <Copy
                    style={{
                      fontSize: 12,
                      color: status === "accepted" ? color.ice : color.muted,
                    }}
                  >
                    {status === "pending"
                      ? `${tab === "incoming" ? "Wants to connect" : "Waiting for a reply"} · ${timeLeft}`
                      : status.charAt(0).toUpperCase() + status.slice(1)}
                  </Copy>
                </View>
              </View>
              {status === "pending" ? (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                  {tab === "incoming" ? (
                    <>
                      <Button
                        title="Accept & reveal"
                        busy={busy === item.id}
                        disabled={!!busy}
                        onPress={() => act(item, "accept")}
                        style={{ flex: 1 }}
                      />
                      <Button
                        title="Decline"
                        secondary
                        disabled={!!busy}
                        onPress={() => act(item, "decline")}
                      />
                    </>
                  ) : (
                    <Button
                      title="Cancel request"
                      secondary
                      busy={busy === item.id}
                      disabled={!!busy}
                      onPress={() => act(item, "cancel")}
                    />
                  )}
                </View>
              ) : (
                <Copy
                  style={{ color: color.muted, fontSize: 12, marginTop: 10 }}
                >
                  {status === "accepted"
                    ? "Find your shared profiles in Connections."
                    : status === "expired"
                      ? "The time to respond has passed. Your profile remains hidden."
                      : "This request is closed. Your profile remains hidden."}
                </Copy>
              )}
            </View>
          );
        }}
      />
      <Sheet visible={!!revealed} onClose={() => setRevealed(null)}>
        <Entrance>
          <View style={{ alignItems: "center", paddingVertical: 20, gap: 22 }}>
            <View style={{ flexDirection: "row", gap: 16 }}>
              <Wave size={65} />
              <Wave size={65} tint={color.ice} />
            </View>
            <Label style={{ color: color.ice }}>THE FEELING IS MUTUAL</Label>
            <Title style={{ textAlign: "center" }}>
              {"You found your\nwavelength."}
            </Title>
            <Copy style={{ color: color.muted, textAlign: "center" }}>
              Your Spotify profiles are now visible to each other.
            </Copy>
            <Button
              title="Meet your connection"
              onPress={() => {
                const id = revealed;
                setRevealed(null);
                if (id)
                  router.push({
                    pathname: "/connection-detail",
                    params: { connectionId: id },
                  });
              }}
            />
          </View>
        </Entrance>
      </Sheet>
    </View>
  );
}
