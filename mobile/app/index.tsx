import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
      try {
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
      } catch (e) {
        console.warn('Startup check failed:', e);
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
      <LinearGradient colors={['#DC2626', '#991B1B', '#1a0a0a']} className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#fff" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#DC2626', '#B91C1C', '#7F1D1D', '#1a0a0a']} locations={[0, 0.3, 0.6, 1]} className="flex-1">
      <View className="flex-1 justify-center items-center px-8">
        {/* Logo */}
        <View
          className="w-28 h-28 rounded-3xl items-center justify-center mb-10"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}
        >
          <Text style={{ fontSize: 52 }}>🎵</Text>
        </View>

        <Text className="text-5xl font-extrabold text-white tracking-tight mb-3">Wavelength</Text>
        <Text className="text-lg text-white/80 text-center leading-7 mb-2">
          Discover what people near you{'\n'}are listening to
        </Text>
        <Text className="text-sm text-white/40 text-center mb-12">
          Anonymous · Location-based · Real-time
        </Text>

        {/* Login button — white pill */}
        <TouchableOpacity
          className="w-full py-4 rounded-2xl items-center"
          style={{
            backgroundColor: '#fff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
          }}
          onPress={handleLogin}
          disabled={loggingIn}
          accessibilityRole="button"
          accessibilityLabel="Log in with Spotify"
        >
          {loggingIn ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <Text style={{ color: '#DC2626', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }}>
              Log in with Spotify
            </Text>
          )}
        </TouchableOpacity>

        <Text className="text-xs text-white/30 text-center mt-8 leading-5">
          By continuing, you agree to share your{'\n'}currently playing track anonymously
        </Text>
      </View>
    </LinearGradient>
  );
}
