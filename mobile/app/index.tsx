import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { SpotifyAuthModule } from '../src/services/spotifyAuth';
import { Screen, PrimaryButton, Spinner } from '../src/components/ui';
import { ONBOARDING_KEY } from './onboarding';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  if (checking) return <Spinner />;

  return (
    <Screen className="px-8" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 24 }}>
      <View className="flex-1 justify-center">
        <Text className="font-mono-light text-[44px] text-ink">wavelength</Text>
        <Text className="font-mono text-[15px] text-ink-muted mt-4 leading-7">
          see what people around you are listening to, right now.
        </Text>
        <Text className="font-mono-medium text-[11px] text-ink-dim mt-8" style={{ letterSpacing: 1.5 }}>
          ANONYMOUS · NEARBY · LIVE
        </Text>
      </View>

      <PrimaryButton
        label="continue with spotify"
        onPress={handleLogin}
        loading={loggingIn}
        accessibilityLabel="Log in with Spotify"
      />
      <Text className="font-mono text-[11px] text-ink-dim text-center mt-5 leading-5">
        by continuing, you share what you're playing{'\n'}with people nearby, anonymously.
      </Text>
    </Screen>
  );
}
