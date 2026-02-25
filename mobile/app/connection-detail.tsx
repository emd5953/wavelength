import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SpotifyAuthModule } from '../src/services/spotifyAuth';
import ConnectionDetailScreen from '../src/components/ConnectionDetailScreen';

export default function ConnectionDetailRoute() {
  const router = useRouter();
  const { connectionId } = useLocalSearchParams<{ connectionId: string }>();
  const [userId, setUserId] = useState('');

  useEffect(() => {
    SpotifyAuthModule.getStoredTokens().then((tokens) => {
      if (tokens) setUserId(tokens.accessToken);
    });
  }, []);

  if (!connectionId || !userId) return null;

  return (
    <ConnectionDetailScreen
      connectionId={connectionId}
      userId={userId}
      onBack={() => router.back()}
      onRemoved={() => router.replace('/connections')}
    />
  );
}
