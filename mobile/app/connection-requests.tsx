import { useEffect, useState } from 'react';
import { SpotifyAuthModule } from '../src/services/spotifyAuth';
import ConnectionRequestScreen from '../src/components/ConnectionRequestScreen';

export default function ConnectionRequestsRoute() {
  const [userId, setUserId] = useState('');

  useEffect(() => {
    SpotifyAuthModule.getStoredTokens().then((tokens) => {
      if (tokens) setUserId(tokens.accessToken);
    });
  }, []);

  if (!userId) return null;

  return <ConnectionRequestScreen userId={userId} />;
}
