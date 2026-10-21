import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  useWindowDimensions,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import {
  Button,
  Copy,
  Entrance,
  Icon,
  Label,
  Notice,
  Wave,
  color,
  type,
  styles,
} from "../src/design/ui";
import { DEMO_MODE } from "../src/dev/demo";
export const ONBOARDING_KEY = "onboarding_complete";
const slides = [
  {
    kicker: "01 / DISCOVER",
    title: "Every place\nhas a sound.",
    accent: "Tune into yours.",
    body: "The café. Your campus. The next block. Discover what people around you are playing on Spotify.",
    caption: "A LITTLE CLOSER. A LITTLE LOUDER.",
    icon: "radio" as const,
  },
  {
    kicker: "02 / STAY ANONYMOUS",
    title: "Good taste.\nNo names.",
    accent: "Let the music talk.",
    body: "React to a track, leave a comment, or say hello. Your Spotify profile stays hidden until you both choose to connect.",
    caption: "A SHARED SONG IS A GOOD START.",
    icon: "headphones" as const,
  },
  {
    kicker: "03 / FIND YOUR PEOPLE",
    title: "Same song.\nNew people.",
    accent: "Meet in the middle.",
    body: "Send a connection request. When they accept, you both reveal your Spotify profiles. Always a mutual choice.",
    caption: "TWO LISTENERS. ONE WAVELENGTH.",
    icon: "users" as const,
  },
  {
    kicker: "04 / YOUR CHOICE",
    title: "Your identity.\nYour decision.",
    accent: "Know what you share.",
    body: "Nearby listeners see your exact location and music. Profiles stay hidden until you both connect. Delete your account and data anytime.",
    caption: "ANONYMOUS IDENTITY. VISIBLE LOCATION.",
    icon: "map-pin" as const,
  },
];
export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const compact = height < 740 || fontScale > 1.2;
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const finish = async () => {
    if (DEMO_MODE) {
      router.replace("/nearby-feed");
      return;
    }
    setSaving(true);
    try {
      await SecureStore.setItemAsync(ONBOARDING_KEY, "true");
      router.replace("/");
    } catch {
      setError("Couldn’t save your preference. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  const slide = slides[page];
  const artSize = Math.min(
    fontScale > 1.2 ? 100 : 310,
    width - 64,
    height * (compact ? 0.2 : 0.32),
    310,
  );
  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.row,
          {
            paddingHorizontal: 26,
            paddingTop: (DEMO_MODE ? 0 : insets.top) + 12,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Wave size={24} />
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              letterSpacing: -0.5,
              color: color.paper,
            }}
          >
            wavelength
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip introduction"
          onPress={finish}
          style={{
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: 10,
          }}
        >
          <Copy style={{ fontSize: 13, color: color.muted }}>Skip intro</Copy>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 28,
          paddingBottom: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Entrance key={page}>
          <View
            style={{
              height: artSize + (compact ? 12 : 40),
              alignItems: "center",
              justifyContent: "center",
              marginVertical: compact ? 8 : 12,
            }}
          >
            <LinearGradient
              colors={
                page === 3 ? ["#25363C", color.ink] : ["#432723", color.ink]
              }
              style={{
                width: artSize,
                height: artSize,
                borderRadius: artSize / 2,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {[1, 0.78, 0.56].map((scale, i) => (
                <View
                  key={i}
                  style={{
                    position: "absolute",
                    width: artSize * scale,
                    height: artSize * scale,
                    borderRadius: artSize,
                    borderWidth: 1,
                    borderColor: page === 3 ? "#43606B" : "#69413B",
                    opacity: 0.55,
                  }}
                />
              ))}
              {page === 2 ? (
                <View style={{ flexDirection: "row", gap: 24 }}>
                  <Wave size={artSize * 0.22} animated />
                  <Wave size={artSize * 0.22} tint={color.ice} animated />
                </View>
              ) : (
                <Wave
                  size={artSize * (page === 0 ? 0.4 : 0.3)}
                  animated
                  tint={page === 3 ? color.ice : color.coral}
                />
              )}
              <View
                style={{
                  position: "absolute",
                  bottom: artSize * 0.14,
                  right: artSize * 0.14,
                  width: compact ? 38 : 52,
                  height: compact ? 38 : 52,
                  borderRadius: 26,
                  backgroundColor: color.paper,
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ rotate: "-12deg" }],
                }}
              >
                <Icon name={slide.icon} tint={color.ink} />
              </View>
            </LinearGradient>
          </View>
          <Label style={{ color: color.coral, marginBottom: 15 }}>
            {slide.kicker}
          </Label>
          <Text
            accessibilityRole="header"
            style={[
              type.display,
              {
                color: color.paper,
                fontSize: compact || width < 370 ? 39 : 46,
                lineHeight: compact || width < 370 ? 43 : 49,
              },
            ]}
          >
            {slide.title}
          </Text>
          <Text
            style={{
              color: page === 3 ? color.ice : color.coral,
              fontSize: 22,
              fontWeight: "600",
              letterSpacing: -0.6,
              marginTop: 8,
              marginBottom: 18,
            }}
          >
            {slide.accent}
          </Text>
          <Copy style={{ color: color.muted }}>{slide.body}</Copy>
          {error ? <Notice message={error} error /> : null}
        </Entrance>
      </ScrollView>
      <View
        style={{
          paddingHorizontal: 28,
          paddingBottom: Math.max(insets.bottom, 18),
          paddingTop: 12,
        }}
      >
        <View style={[styles.row, { marginBottom: 18 }]}>
          <View
            accessibilityLabel={`Scene ${page + 1} of 4`}
            style={{ flexDirection: "row", gap: 6 }}
          >
            {slides.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === page ? 28 : 8,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: i === page ? color.coral : color.line,
                }}
              />
            ))}
          </View>
          {page > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setPage(page - 1)}
              style={{
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: 12,
              }}
            >
              <Copy style={{ color: color.muted, fontSize: 13 }}>Back</Copy>
            </Pressable>
          )}
        </View>
        <Button
          title={page === 3 ? "Find my wavelength" : "Continue"}
          icon="arrow-right"
          busy={saving}
          onPress={() => (page === 3 ? finish() : setPage(page + 1))}
        />
      </View>
    </View>
  );
}
