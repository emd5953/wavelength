import "../global.css";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { StatusBar, Text, View } from "react-native";
import { color, useReducedMotion } from "../src/design/ui";
import { DEMO_MODE } from "../src/dev/demo";
export default function RootLayout() {
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <StatusBar barStyle={DEMO_MODE ? "dark-content" : "light-content"} />
      {DEMO_MODE && (
        <Text
          style={{
            paddingTop: insets.top + 4,
            paddingBottom: 6,
            textAlign: "center",
            color: color.ink,
            backgroundColor: color.ice,
            fontWeight: "700",
            fontSize: 11,
          }}
        >
          DESIGN PREVIEW · SAMPLE DATA · READ ONLY
        </Text>
      )}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: color.ink },
          headerTintColor: color.paper,
          headerTitleStyle: { fontWeight: "600", fontSize: 16 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: color.ink },
          animation: reduced ? "none" : "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="nearby-feed" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="connections" options={{ headerShown: false }} />
        <Stack.Screen
          name="comment-thread"
          options={{ title: "The conversation" }}
        />
        <Stack.Screen name="dm" options={{ title: "Between listeners" }} />
        <Stack.Screen
          name="connection-detail"
          options={{ title: "On your wavelength" }}
        />
        <Stack.Screen
          name="connection-requests"
          options={{ title: "Connection requests" }}
        />
        <Stack.Screen
          name="location-required"
          options={{ title: "Find your surroundings" }}
        />
      </Stack>
    </View>
  );
}
