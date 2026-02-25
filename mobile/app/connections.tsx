import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SpotifyAuthModule } from '../src/services/spotifyAuth';
import ConnectionsListScreen from '../src/components/ConnectionsListScreen';

export default function ConnectionsRoute() {
  const router = useRouter();
  const [userId, setUserId] = useState('');

  useEffect(() => {
    SpotifyAuthModule.getStoredTokens().then((tokens) => {
      if (tokens) setUserId(tokens.accessToken);
    });
  }, []);

  if (!userId) return null;

  return (
    <ConnectionsListScreen
      userId={userId}
      onSelectConnection={(connectionId) =>
        router.push(`/connection-detail?connectionId=${connectionId}`)
      }
    />
  );
}
