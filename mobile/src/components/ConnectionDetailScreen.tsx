import { useCallback, useState } from "react";
import { Alert, Linking, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ConnectionDetailData,
  friendlyError,
  getConnectionDetail,
  removeConnection,
} from "../services/api";
import {
  Avatar,
  Button,
  Copy,
  EmptyState,
  Label,
  Notice,
  Surface,
  Title,
  color,
  styles,
} from "../design/ui";
export default function ConnectionDetailScreen({
  connectionId,
  onRemoved,
}: {
  connectionId: string;
  onRemoved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<ConnectionDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getConnectionDetail(connectionId);
      setDetail(res.connection);
      setError("");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [connectionId]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  const remove = () =>
    Alert.alert(
      "Remove this connection?",
      "Your Spotify profiles will no longer be shared through this connection. Future interactions will be anonymous.",
      [
        { text: "Keep connection", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setRemoving(true);
            try {
              await removeConnection(connectionId);
              onRemoved();
            } catch (e) {
              setError(friendlyError(e));
            } finally {
              setRemoving(false);
            }
          },
        },
      ],
    );
  if (loading) return <EmptyState loading title="Meeting your connection…" />;
  if (!detail)
    return (
      <EmptyState
        title="Profile unavailable"
        body={error || "This connection may have been removed."}
        action="Try again"
        onAction={load}
      />
    );
  const p = detail.profile;
  const openSpotify = () => {
    if (p.profileLink && /^https:\/\/open\.spotify\.com\//.test(p.profileLink))
      Linking.openURL(p.profileLink).catch(() =>
        setError("Couldn’t open Spotify. Please try again."),
      );
    else setError("A Spotify profile link isn’t available yet.");
  };
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 32 }}
    >
      <View style={{ alignItems: "center", paddingVertical: 24, gap: 16 }}>
        <Avatar id={connectionId} uri={p.profileImageUrl} size={112} />
        <Label style={{ color: color.ice }}>A MUTUAL CONNECTION</Label>
        <Title style={{ textAlign: "center", fontSize: 36 }}>
          {p.displayName || "Connected listener"}
        </Title>
        <Copy style={{ color: color.muted, fontSize: 13 }}>
          Connected {new Date(detail.createdAt).toLocaleDateString()}
        </Copy>
        {p.profileLink ? (
          <Button
            title="Open Spotify profile"
            icon="external-link"
            onPress={openSpotify}
          />
        ) : (
          <Copy style={{ color: color.muted, textAlign: "center" }}>
            A Spotify profile link isn’t available yet.
          </Copy>
        )}
      </View>
      {error && <Notice error message={error} />}
      {[
        {
          title: "IN THEIR ROTATION",
          items: p.topArtists ?? [],
          empty: "Their top artists aren’t available yet.",
        },
        {
          title: "TRACKS THEY COME BACK TO",
          items: p.topTracks ?? [],
          empty: "Their top tracks aren’t available yet.",
        },
      ].map((section) => (
        <Surface key={section.title} style={{ marginTop: 16 }}>
          <Label style={{ marginBottom: 14 }}>{section.title}</Label>
          {section.items.length ? (
            section.items.map((item, index) => (
              <View
                key={`${index}-${item}`}
                style={{
                  flexDirection: "row",
                  gap: 14,
                  paddingVertical: 12,
                  borderTopWidth: index ? 1 : 0,
                  borderColor: color.line,
                }}
              >
                <Text
                  style={{ fontSize: 12, color: color.coral, paddingTop: 5 }}
                >
                  {String(index + 1).padStart(2, "0")}
                </Text>
                <Copy style={{ flex: 1 }}>{item}</Copy>
              </View>
            ))
          ) : (
            <Copy style={{ color: color.muted }}>{section.empty}</Copy>
          )}
        </Surface>
      ))}
      <Button
        title="Remove connection"
        secondary
        danger
        busy={removing}
        onPress={remove}
        style={{ marginTop: 30 }}
      />
    </ScrollView>
  );
}
