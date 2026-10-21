import { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, TextButton } from './ui';

export type ViewMode = 'list' | 'map';

interface FeedHeaderProps {
  topInset: number;
  /** Album art of the newest live play; the header falls back to a plain gradient without it. */
  artUrl: string | null;
  liveCount: number;
  earlierCount: number;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  onOpenPeople: () => void;
  onOpenProfile: () => void;
}

const GROUND = COLORS.ground;
const GROUND_LIFT = COLORS.groundLift;

/**
 * One art image that fades in once loaded. Keyed by URL by the parent, so a
 * new track mounts a fresh instance with its own opacity — nothing ever
 * resets an image that has already loaded.
 */
function FadeInArt({ uri }: { uri: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  return (
    <Animated.Image
      source={{ uri }}
      blurRadius={40}
      resizeMode="cover"
      style={[StyleSheet.absoluteFill, { opacity }]}
      onLoad={() => Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start()}
    />
  );
}

/** Blurred, darkened album art that fades in when the track changes. */
function ArtBackdrop({ artUrl }: { artUrl: string | null }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[GROUND_LIFT, GROUND]} style={StyleSheet.absoluteFill} />
      {artUrl && <FadeInArt key={artUrl} uri={artUrl} />}
      {/* Darken so ink always wins over the art, and fade into the page */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: GROUND, opacity: 0.72 }]} />
      {/* Fade from ground at 0 alpha, not 'transparent' (black at 0 alpha), which dims mid-fade */}
      <LinearGradient
        colors={['rgba(8, 47, 73, 0)', GROUND]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 48 }}
      />
    </View>
  );
}

export default function FeedHeader({
  topInset,
  artUrl,
  liveCount,
  earlierCount,
  viewMode,
  onChangeViewMode,
  onOpenPeople,
  onOpenProfile,
}: FeedHeaderProps) {
  return (
    <View style={{ paddingTop: topInset + 12 }} className="px-6 pb-5 overflow-hidden">
      <ArtBackdrop artUrl={artUrl} />

      <View className="flex-row items-start justify-between">
        <View>
          <Text className="font-mono-light text-[32px] text-ink">nearby</Text>
          <Text className="font-mono text-[13px] text-ink-dim mt-1">
            {liveCount} playing now · {earlierCount} earlier
          </Text>
        </View>
        <View className="flex-row gap-5 pt-2">
          <TextButton label="people" onPress={onOpenPeople} accessibilityLabel="Connections" />
          <TextButton label="you" onPress={onOpenProfile} accessibilityLabel="Profile" />
        </View>
      </View>

      <View className="flex-row gap-1 mt-5">
        {(['list', 'map'] as const).map((mode) => {
          const selected = viewMode === mode;
          return (
            <TouchableOpacity
              key={mode}
              className={`px-4 py-1.5 rounded-full ${selected ? 'bg-card border border-rule' : ''}`}
              onPress={() => onChangeViewMode(mode)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text className={`font-mono text-[13px] ${selected ? 'text-ink' : 'text-ink-dim'}`}>{mode}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
