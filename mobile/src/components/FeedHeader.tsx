import { useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from './ui';

interface FeedHeaderProps {
  topInset: number;
  title: string;
  /** Album art of the newest live play; the header falls back to a plain gradient without it. */
  artUrl: string | null;
  liveCount: number;
  earlierCount: number;
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

export default function FeedHeader({ topInset, title, artUrl, liveCount, earlierCount }: FeedHeaderProps) {
  return (
    <View style={{ paddingTop: topInset + 12 }} className="px-6 pb-5 overflow-hidden">
      <ArtBackdrop artUrl={artUrl} />
      <Text className="font-mono-light text-[32px] text-ink">{title}</Text>
      <Text className="font-mono text-[13px] text-ink-dim mt-1">
        {liveCount} playing now · {earlierCount} earlier
      </Text>
    </View>
  );
}
