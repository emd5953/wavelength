import { useCallback, useState } from "react";
import { FlatList, TouchableOpacity, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ConnectionListItem,
  friendlyError,
  getConnections,
} from "../services/api";
import {
  Avatar,
  BottomNav,
  Button,
  Copy,
  EmptyState,
  Icon,
  IconButton,
  Label,
  Notice,
  Title,
  color,
  styles,
} from "../design/ui";
import { DEMO_MODE } from "../dev/demo";
export default function ConnectionsListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [connections, setConnections] = useState<ConnectionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getConnections();
      setConnections(res.connections);
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
    }, [load]),
  );
  return (
    <View style={styles.screen}>
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: DEMO_MODE ? 12 : insets.top + 12,
          paddingBottom: 22,
        }}
      >
        <View style={styles.row}>
          <Label style={{ color: color.coral }}>YOUR PEOPLE</Label>
          <IconButton
            name="inbox"
            label="Connection requests"
            onPress={() => router.push("/connection-requests")}
          />
        </View>
        <Title style={{ fontSize: 38, lineHeight: 43, marginTop: 12 }}>
          {"On your\nwavelength."}
        </Title>
        <Copy style={{ color: color.muted, marginTop: 12 }}>
          A little less stranger. A little more in sync.
        </Copy>
      </View>
      <FlatList
        data={connections}
        keyExtractor={(item) => item.id}
        onRefresh={load}
        refreshing={loading}
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 4 }}
        ListHeaderComponent={
          <>
            {error && (
              <>
                <Notice error message={error} />
                <Button title="Try again" secondary onPress={load} />
              </>
            )}
            <Label style={{ paddingVertical: 14 }}>
              {error && !connections.length
                ? "CONNECTIONS UNAVAILABLE"
                : loading && !connections.length
                  ? "CHECKING CONNECTIONS"
                  : `${connections.length} MUTUAL ${connections.length === 1 ? "CONNECTION" : "CONNECTIONS"}`}
            </Label>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`View ${item.displayName || "connected listener"} profile`}
            onPress={() =>
              router.push({
                pathname: "/connection-detail",
                params: { connectionId: item.id },
              })
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              paddingVertical: 22,
              borderBottomWidth: 1,
              borderBottomColor: color.line,
            }}
          >
            <Avatar id={item.id} uri={item.profileImageUrl} size={60} />
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: color.paper, fontSize: 22, fontWeight: "700" }}
              >
                {item.displayName || "Connected listener"}
              </Text>
              <Copy style={{ fontSize: 12, color: color.muted }}>
                Connected{" "}
                {new Date(item.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </Copy>
            </View>
            <Icon name="arrow-up-right" tint={color.coral} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !error ? (
            <EmptyState
              loading={loading}
              title={
                loading ? "Finding your people…" : "It starts with a song."
              }
              body="When a connection request is accepted, you’ll find their Spotify profile here."
              action={loading ? undefined : "Discover nearby listeners"}
              onAction={() => router.replace("/nearby-feed")}
            />
          ) : null
        }
        ListFooterComponent={
          <View style={{ marginTop: 24 }}>
            <Button
              title="View connection requests"
              secondary
              icon="inbox"
              onPress={() => router.push("/connection-requests")}
            />
          </View>
        }
      />
      <BottomNav active="connections" />
    </View>
  );
}
