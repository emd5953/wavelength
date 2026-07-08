import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Slider from '@react-native-community/slider';
import { SpotifyAuthModule } from '../src/services/spotifyAuth';
import { ONBOARDING_KEY } from './onboarding';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const RADIUS_KEY = 'discovery_radius';

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
      <LinearGradient colors={['#DC2626', '#991B1B', '#1a0a0a']} className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#fff" />
      </LinearGradient>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: '#1a0a0a' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Header gradient */}
        <LinearGradient colors={['#DC2626', '#B91C1C', '#1a0a0a']} locations={[0, 0.5, 1]}>
          <View style={{ paddingTop: insets.top + 12 }} className="px-5 pb-8">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mb-6"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text className="text-sm text-white/80 font-semibold">← Back</Text>
            </TouchableOpacity>

            <View className="items-center">
              <View
                className="w-24 h-24 rounded-3xl items-center justify-center mb-4"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}
              >
                <Text style={{ fontSize: 40 }}>👤</Text>
              </View>
              <Text className="text-2xl font-extrabold text-white">
                {profile?.display_name || 'Wavelength User'}
              </Text>
              {profile?.email ? (
                <Text className="text-sm text-white/50 mt-1">{profile.email}</Text>
              ) : null}
            </View>
          </View>
        </LinearGradient>

        {/* Settings */}
        <View className="px-5 -mt-2">
          <View
            className="rounded-2xl p-5 mb-4"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <Text className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1">
              Discovery Radius
            </Text>
            <Text className="text-3xl font-extrabold text-white mb-1">{radius}m</Text>
            <Text className="text-xs text-white/35 mb-4">
              How far to scan for nearby listeners
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
              minimumTrackTintColor="#DC2626"
              maximumTrackTintColor="rgba(255,255,255,0.15)"
              thumbTintColor="#fff"
            />
            <View className="flex-row justify-between">
              <Text className="text-xs text-white/35">50m</Text>
              <Text className="text-xs text-white/35">500m</Text>
            </View>
          </View>

          {/* Actions */}
          <View className="gap-3 mt-2">
            <TouchableOpacity
              className="py-4 rounded-2xl items-center"
              style={{
                backgroundColor: '#fff',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
              }}
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Text style={{ color: '#DC2626', fontSize: 16, fontWeight: '800' }}>Back to Feed</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="py-4 rounded-2xl items-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              onPress={handleLogout}
              accessibilityRole="button"
            >
              <Text className="text-white/60 text-base font-semibold">Log Out</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="py-4 rounded-2xl items-center"
              style={{ borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' }}
              onPress={handleDeleteAccount}
              accessibilityRole="button"
            >
              <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '600' }}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export { RADIUS_KEY };
