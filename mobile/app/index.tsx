import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SpotifyAuthModule } from '../src/services/spotifyAuth';

export default function LoginScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    SpotifyAuthModule.getStoredTokens().then((tokens) => {
      if (tokens && Date.now() < tokens.expiresAt) {
        router.replace('/nearby-feed');
      } else {
        setChecking(false);
      }
    });
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
      <Text style={styles.title}>Music Vicinity</Text>
      <Text style={styles.subtitle}>Discover what people near you are listening to</Text>
      <TouchableOpacity
        style={styles.loginBtn}
        onPress={handleLogin}
        disabled={loggingIn}
        accessibilityRole="button"
        accessibilityLabel="Log in with Spotify"
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
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  title: { fontSize: 28, fontWeight: '700', color: '#333', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 32 },
  loginBtn: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    minWidth: 200,
    alignItems: 'center',
  },
  loginText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
