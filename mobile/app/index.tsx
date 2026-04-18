import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
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
      <View className="flex-1 justify-center items-center bg-surface">
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center items-center p-8 bg-surface">
      <Text className="text-5xl mb-4">🎵</Text>
      <Text className="text-3xl font-bold text-white mb-2">Wavelength</Text>
      <Text className="text-base text-muted-light text-center mb-8">
        Discover what people near you are listening to
      </Text>
      <TouchableOpacity
        className="bg-spotify px-8 py-3.5 rounded-3xl min-w-[200px] items-center"
        onPress={handleLogin}
        disabled={loggingIn}
      >
        {loggingIn ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text className="text-white text-base font-bold">Log in with Spotify</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
