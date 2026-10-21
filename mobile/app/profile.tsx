import { useCallback, useState } from "react";
import { View, Text, Alert, ScrollView } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { SpotifyAuthModule } from "../src/services/spotifyAuth";
import { deleteAccount, friendlyError } from "../src/services/api";
import { resetPresence } from "../src/services/presence";
import { stopBackgroundLocation } from "../src/services/backgroundLocation";
import { disconnectFeedSocket } from "../src/services/feedSocket";
import {
  Avatar,
  BottomNav,
  Button,
  Copy,
  Label,
  Notice,
  RadiusControl,
  Surface,
  Title,
  color,
  styles,
} from "../src/design/ui";
import { RADIUS_KEY, validRadius } from "../src/utils/discovery";
import { DEMO_MODE } from "../src/dev/demo";
import { ONBOARDING_KEY } from "./onboarding";
export { RADIUS_KEY } from "../src/utils/discovery";
type Profile = {
  display_name?: string;
  images?: { url: string }[];
  product?: string;
  external_urls?: { spotify?: string };
};
export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(100);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const saved = await SecureStore.getItemAsync(
        DEMO_MODE ? "demo_discovery_radius" : RADIUS_KEY,
      );
      setRadius(validRadius(saved));
      if (DEMO_MODE) {
        setProfile({ display_name: "Your listening space" });
        return;
      }
      const token = await SpotifyAuthModule.getValidToken();
      if (!token) {
        setError(
          "Your session has expired. Sign in again to see your Spotify profile.",
        );
        return;
      }
      const res = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setProfile(await res.json());
    } catch {
      setError(
        "Your Spotify profile is unavailable right now. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  const saveRadius = async (value: number) => {
    try {
      await SecureStore.setItemAsync(
        DEMO_MODE ? "demo_discovery_radius" : RADIUS_KEY,
        String(value),
      );
      setRadius(value);
    } catch {
      setError("Couldn’t save your radius. Please try again.");
    }
  };
  const logout = async () => {
    if (DEMO_MODE) {
      setError("Preview only. No real account is signed in to this preview.");
      return;
    }
    setBusy(true);
    try {
      resetPresence();
      disconnectFeedSocket();
      await stopBackgroundLocation().catch(() => {});
      await SpotifyAuthModule.logout();
      router.replace("/");
    } catch {
      setError("Couldn’t finish signing out. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const confirmDelete = () =>
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your account, plays, messages, comments, reactions, and connections. This cannot be undone.",
      [
        { text: "Keep my account", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await deleteAccount();
              resetPresence();
              disconnectFeedSocket();
              await stopBackgroundLocation().catch(() => {});
              await SpotifyAuthModule.logout();
              await SecureStore.deleteItemAsync(ONBOARDING_KEY);
              router.replace("/onboarding");
            } catch (e) {
              setError(friendlyError(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingTop: DEMO_MODE ? 24 : insets.top + 24,
          paddingBottom: 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Label style={{ color: color.coral }}>YOUR FREQUENCY</Label>
        <View style={[styles.row, { marginTop: 26, marginBottom: 28 }]}>
          <View style={{ flex: 1 }}>
            <Title>
              {loading
                ? "Tuning in…"
                : profile?.display_name || "Your listening space"}
            </Title>
            <Copy style={{ color: color.muted, fontSize: 13, marginTop: 6 }}>
              {profile && !DEMO_MODE
                ? "Linked with Spotify"
                : "Your music. Your choice."}
            </Copy>
          </View>
          <Avatar id="my-profile" uri={profile?.images?.[0]?.url} size={72} />
        </View>
        {error && (
          <>
            <Notice error message={error} />
            <Button title="Retry profile" secondary onPress={load} />
          </>
        )}
        <Surface style={{ marginVertical: 16 }}>
          <RadiusControl value={radius} onChange={saveRadius} />
          <Copy style={{ color: color.muted, fontSize: 13, marginTop: 18 }}>
            How far you explore, from your corner of the café to the next block.
          </Copy>
        </Surface>
        <Label style={{ marginTop: 18, marginBottom: 16 }}>GOOD TO KNOW</Label>
        {[
          {
            title: "A name only when it’s mutual.",
            body: "Your Spotify profile stays hidden until a connection request is accepted. You can remove a connection at any time.",
          },
          {
            title: "Your location is visible.",
            body: "Nearby listeners can see your exact listening location on the map. An anonymous name does not hide where you are.",
          },
          {
            title: "Music leaves a little echo.",
            body: "Recent plays can remain in discovery for up to six hours after the music stops.",
          },
        ].map((item) => (
          <View
            key={item.title}
            style={{
              paddingVertical: 18,
              borderTopWidth: 1,
              borderColor: color.line,
            }}
          >
            <Copy style={{ fontWeight: "600", marginBottom: 7 }}>
              {item.title}
            </Copy>
            <Copy style={{ color: color.muted, fontSize: 14, lineHeight: 22 }}>
              {item.body}
            </Copy>
          </View>
        ))}
        <View style={{ gap: 12, marginTop: 16 }}>
          <Button
            title="Replay the introduction"
            secondary
            icon="radio"
            onPress={() => router.push("/onboarding")}
          />
          <Button
            title="Log out"
            secondary
            busy={busy}
            onPress={() =>
              Alert.alert(
                "Log out of Wavelength?",
                "You can sign in with Spotify again anytime.",
                [
                  { text: "Stay", style: "cancel" },
                  { text: "Log out", onPress: logout },
                ],
              )
            }
          />
          <Button
            title="Delete account"
            secondary
            danger
            disabled={busy}
            onPress={confirmDelete}
          />
        </View>
        <View style={{ alignItems: "center", marginTop: 30 }}>
          <Text style={{ color: color.muted, fontSize: 12 }}>
            wavelength · the sound of the room
          </Text>
        </View>
      </ScrollView>
      <BottomNav active="profile" />
    </View>
  );
}
