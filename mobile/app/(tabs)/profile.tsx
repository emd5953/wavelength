import { useEffect, useState } from 'react';
import { View, Text, Alert, ScrollView, ActionSheetIOS } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Slider from '@react-native-community/slider';
import { SpotifyAuthModule } from '../../src/services/spotifyAuth';
import { RADIUS_KEY } from '../../src/services/nearbyFeed';
import { ONBOARDING_KEY } from '../onboarding';
import { Screen, Spinner, Avatar, COLORS } from '../../src/components/ui';
import MarkHeader from '../../src/components/MarkHeader';
import { More } from '../../src/components/icons';
import { PressableScale, SPRING } from '../../src/components/motion';

const RING_BOX = 240;

/** One ring of the radius: springs to its share of the box as the radius changes. */
function Ring({ fraction }: { fraction: number }) {
  const style = useAnimatedStyle(() => {
    const d = withSpring(RING_BOX * fraction, SPRING.settle);
    return { width: d, height: d, borderRadius: RING_BOX };
  }, [fraction]);
  return <Animated.View style={[{ position: 'absolute', borderWidth: 1, borderColor: COLORS.rule }, style]} />;
}

/** The discovery radius as rings around you; meters appear only while dragging. */
function RadiusRings({ radius, showLabel }: { radius: number; showLabel: boolean }) {
  // 50m still reads as a real circle; 500m fills the box
  const f = 0.35 + 0.65 * ((radius - 50) / 450);
  return (
    <View style={{ width: RING_BOX, height: RING_BOX, marginVertical: 28, alignItems: 'center', justifyContent: 'center' }}>
      <Ring fraction={f} />
      <Ring fraction={f * 0.66} />
      <Ring fraction={f * 0.33} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.live }} />
      {showLabel && (
        <Animated.Text
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(200)}
          className="font-mono text-[13px] text-ink-muted"
          style={{ position: 'absolute', bottom: 6 }}
        >
          {radius}m
        </Animated.Text>
      )}
    </View>
  );
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(100);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    (async () => {
      const savedRadius = await SecureStore.getItemAsync(RADIUS_KEY);
      if (savedRadius) setRadius(Number(savedRadius));

      const token = await SpotifyAuthModule.getValidToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setProfile(await res.json());
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const handleLogout = async () => {
    await SpotifyAuthModule.logout();
    router.replace('/');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and all your data. It can\'t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const token = await SpotifyAuthModule.getValidToken();
            if (token) {
              await fetch(`${API_BASE}/account/me`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              }).catch(() => {});
            }
            await SpotifyAuthModule.logout();
            await SecureStore.deleteItemAsync(ONBOARDING_KEY);
            router.replace('/');
          },
        },
      ],
    );
  };

  if (loading) return <Spinner />;

  const name = profile?.display_name || 'listener';
  const openMore = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Log out', 'Delete account and all data', 'Cancel'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
      (i) => {
        if (i === 0) handleLogout();
        if (i === 1) handleDeleteAccount();
      },
    );

  return (
    <Screen>
      <MarkHeader
        topInset={insets.top}
        right={
          <PressableScale scaleTo={0.88} onPress={openMore} accessibilityLabel="Account options">
            <More size={28} color={COLORS.inkMuted} />
          </PressableScale>
        }
      />
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 32 }}>
        <View className="mt-6 items-center">
          <Avatar uri={profile?.images?.[0]?.url} name={name} size={112} />
          <Text className="font-mono-light text-[24px] text-ink mt-4">{name.toLowerCase()}</Text>
        </View>

        <RadiusRings radius={radius} showLabel={dragging} />

        <View style={{ width: '82%' }}>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={50}
            maximumValue={500}
            step={50}
            value={radius}
            onSlidingStart={() => setDragging(true)}
            onValueChange={(val) => setRadius(val)}
            onSlidingComplete={async (val) => {
              setDragging(false);
              setRadius(val);
              await SecureStore.setItemAsync(RADIUS_KEY, String(val));
            }}
            minimumTrackTintColor={COLORS.live}
            maximumTrackTintColor={COLORS.rule}
            thumbTintColor={COLORS.ink}
            accessibilityLabel={`Discovery radius, ${radius} meters`}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

