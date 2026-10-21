import { useEffect, useState } from 'react';
import { View, Text, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Slider from '@react-native-community/slider';
import { SpotifyAuthModule } from '../../src/services/spotifyAuth';
import { RADIUS_KEY } from '../../src/services/nearbyFeed';
import { ONBOARDING_KEY } from '../onboarding';
import { Screen, SectionLabel, OutlineButton, TextButton, Spinner, COLORS } from '../../src/components/ui';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(100);

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

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
        className="px-6"
      >
        <Text className="font-mono text-[15px] text-ink-dim mt-6">you are</Text>
        <Text className="font-mono-light text-[32px] text-ink mt-1" numberOfLines={1}>
          {(profile?.display_name || 'a listener').toLowerCase()}
        </Text>
        {profile?.email ? (
          <Text className="font-mono text-[13px] text-ink-dim mt-1">{profile.email}</Text>
        ) : null}
        <Text className="font-mono text-[13px] text-ink-muted mt-4 leading-6">
          nearby listeners only ever see you anonymously, until you both connect.
        </Text>

        <SectionLabel title="DISCOVERY RADIUS" className="mt-10 mb-4" />
        <Text className="font-mono-light text-[40px] text-ink">{radius}m</Text>
        <Text className="font-mono text-[13px] text-ink-dim mt-1">how far to look for music around you</Text>
        <Slider
          style={{ width: '100%', height: 40, marginTop: 12 }}
          minimumValue={50}
          maximumValue={500}
          step={50}
          value={radius}
          onSlidingComplete={async (val) => {
            setRadius(val);
            await SecureStore.setItemAsync(RADIUS_KEY, String(val));
          }}
          minimumTrackTintColor={COLORS.live}
          maximumTrackTintColor={COLORS.rule}
          thumbTintColor={COLORS.ink}
        />
        <View className="flex-row justify-between">
          <Text className="font-mono text-[11px] text-ink-dim">50m</Text>
          <Text className="font-mono text-[11px] text-ink-dim">500m</Text>
        </View>

        <SectionLabel title="ACCOUNT" className="mt-10 mb-4" />
        <View className="gap-3">
          <OutlineButton label="log out" onPress={handleLogout} />
          <TextButton
            label="delete account and all data"
            onPress={handleDeleteAccount}
            accessibilityLabel="Delete account"
            className="items-center py-3"
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

