import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>👤</Text>
      <Text style={styles.name}>{profile?.display_name || 'Wavelength User'}</Text>
      <Text style={styles.email}>{profile?.email || ''}</Text>

      <View style={styles.radiusSection}>
        <Text style={styles.radiusLabel}>Discovery Radius: {radius}m</Text>
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
        <View style={styles.radiusRange}>
          <Text style={styles.rangeText}>50m</Text>
          <Text style={styles.rangeText}>500m</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Back to Feed</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 60, padding: 32, backgroundColor: '#121212' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  emoji: { fontSize: 64, marginBottom: 16 },
  name: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  email: { fontSize: 14, color: '#888', marginBottom: 32 },
  actions: { width: '100%', gap: 12 },
  btn: {
    backgroundColor: '#1DB954',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  logoutBtn: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: { color: '#ccc', fontSize: 16, fontWeight: 'bold' },
  deleteBtn: {
    borderWidth: 1,
    borderColor: '#d32f2f',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteText: { color: '#d32f2f', fontSize: 16, fontWeight: 'bold' },
  radiusSection: { width: '100%', marginBottom: 24 },
  radiusLabel: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  radiusRange: { flexDirection: 'row', justifyContent: 'space-between' },
  rangeText: { fontSize: 12, color: '#666' },
});

export { RADIUS_KEY };
