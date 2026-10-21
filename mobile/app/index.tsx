import { useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { SpotifyAuthModule } from "../src/services/spotifyAuth";
import { DEMO_MODE } from "../src/dev/demo";
import { ONBOARDING_KEY } from "./onboarding";
import {
  Button,
  Copy,
  EmptyState,
  Label,
  Notice,
  Wave,
  color,
  styles,
  type,
} from "../src/design/ui";
export default function LoginScreen() {
  const { signin } = useLocalSearchParams<{ signin?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    (async () => {
      try {
        if (DEMO_MODE) {
          setChecking(false);
          return;
        }
        if (!(await SecureStore.getItemAsync(ONBOARDING_KEY))) {
          router.replace("/onboarding");
          return;
        }
        const token =
          signin === "1" ? null : await SpotifyAuthModule.getValidToken();
        if (token) {
          router.replace("/nearby-feed");
          return;
        }
      } catch {
        setError("We couldn’t restore your session. Please sign in again.");
      }
      setChecking(false);
    })();
  }, [signin]);
  const login = async () => {
    if (DEMO_MODE) {
      setError("Preview only. Open the regular app to sign in with Spotify.");
      return;
    }
    setLoggingIn(true);
    setError("");
    try {
      const tokens = await SpotifyAuthModule.login();
      if (tokens) router.replace("/nearby-feed");
      else
        setError(
          "Sign-in wasn’t completed. You can try again whenever you’re ready.",
        );
    } catch {
      setError(
        "Couldn’t connect to Spotify. Check your connection and try again.",
      );
    } finally {
      setLoggingIn(false);
    }
  };
  if (checking)
    return (
      <View style={[styles.screen, { justifyContent: "center" }]}>
        <EmptyState loading title="Finding your frequency" />
      </View>
    );
  return (
    <LinearGradient
      colors={["#322320", color.ink, color.ink]}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 30,
          paddingTop: insets.top + 48,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <Wave size={90} />
        <Label style={{ marginTop: 40, color: color.coral }}>
          THE SOUND OF THE ROOM
        </Label>
        <Text
          style={[
            type.display,
            { color: color.paper, marginTop: 16, marginBottom: 20 },
          ]}
        >
          {"You’re in\ngood company."}
        </Text>
        <Copy style={{ color: color.muted, marginBottom: 38 }}>
          A shared song. A nearby stranger. The start of something unexpected.
        </Copy>
        <Button
          title="Continue with Spotify"
          icon="music"
          busy={loggingIn}
          onPress={login}
        />
        {error && <Notice error message={error} />}
        <Copy
          style={{
            color: color.muted,
            fontSize: 13,
            lineHeight: 20,
            marginTop: 22,
          }}
        >
          When you use discovery, nearby listeners can see your tracks and exact
          location. Your Spotify profile is revealed only when you both connect.
        </Copy>
        <View style={{ marginTop: 32 }}>
          <Button
            secondary
            title="Explore how it works"
            onPress={() => router.push("/onboarding")}
          />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
