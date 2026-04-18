import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Slider from '@react-native-community/slider';
import { SpotifyAuthModule } from '../src/services/spotifyAuth';
import { ONBOARDING_KEY } from './onboarding';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const RADIUS_KEY = 'discovery_radius';

export default function ProfileScreen() {
  const router = useRouter();
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
      'Delete Account',
      'This will permanently delete your account and all data. This cannot be undone.',
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

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-surface">
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <View className="flex-1 items-center pt-16 p-8 bg-surface">
      <Text className="text-6xl mb-4">👤</Text>
      <Text className="text-[22px] font-bold text-white mb-1">
        {profile?.display_name || 'Wavelength User'}
      </Text>
      <Text className="text-sm text-muted mb-8">{profile?.email || ''}</Text>

      <View className="w-full mb-6">
        <Text className="text-base font-bold text-white mb-2">
          Discovery Radius: {radius}m
        </Text>
        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={50}
          maximumValue={500}
          step={50}
          value={radius}
          onSlidingComplete={async (val) => {
            setRadius(val);
            await SecureStore.setItemAsync(RADIUS_KEY, String(val));
          }}
          minimumTrackTintColor="#1DB954"
          maximumTrackTintColor="#444"
          thumbTintColor="#1DB954"
        />
        <View className="flex-row justify-between">
          <Text className="text-xs text-muted-dark">50m</Text>
          <Text className="text-xs text-muted-dark">500m</Text>
        </View>
      </View>

      <View className="w-full gap-3">
        <TouchableOpacity
          className="bg-spotify py-3.5 rounded-xl items-center"
          onPress={() => router.back()}
        >
          <Text className="text-white text-base font-bold">Back to Feed</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-surface-elevated py-3.5 rounded-xl items-center"
          onPress={handleLogout}
        >
          <Text className="text-neutral-400 text-base font-bold">Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="border border-danger py-3.5 rounded-xl items-center"
          onPress={handleDeleteAccount}
        >
          <Text className="text-danger text-base font-bold">Delete Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export { RADIUS_KEY };
