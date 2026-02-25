import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { SpotifyAuthModule } from '../src/services/spotifyAuth';
import { ONBOARDING_KEY } from './onboarding';

export default function LoginScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    (async () => {
      const onboarded = await SecureStore.getItemAsync(ONBOARDING_KEY);
      if (!onboarded) {
        router.replace('/onboarding');
        return;
      }

      const tokens = await SpotifyAuthModule.getStoredTokens();
      if (tokens && Date.now() < tokens.expiresAt) {
        router.replace('/nearby-feed');
      } else {
        setChecking(false);
      }
    })();
  }, []);

  const handleLogin = async () => {
    setLoggingIn(true);
    try {
      const tokens = await SpotifyAuthModule.login();
      if (tokens) {
        router.replace('/nearby-feed');
      }
    } finally {
      setLoggingIn(false);
    }
  };

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎵</Text>
      <Text style={styles.title}>Wavelength</Text>
      <Text style={styles.subtitle}>Discover what people near you are listening to</Text>
      <TouchableOpacity
        style={styles.loginBtn}
        onPress={handleLogin}
        disabled={loggingIn}
      >
        {loggingIn ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.loginText}>Log in with Spotify</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#121212' },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#aaa', textAlign: 'center', marginBottom: 32 },
  loginBtn: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    minWidth: 200,
    alignItems: 'center',
  },
  loginText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
