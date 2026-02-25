import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SpotifyAuthModule } from '../src/services/spotifyAuth';
import DMScreen from '../src/components/DMScreen';

export default function DMRoute() {
  const { recipientAnonId } = useLocalSearchParams<{ recipientAnonId: string }>();
  const [myAnonId, setMyAnonId] = useState('');

  useEffect(() => {
    SpotifyAuthModule.getStoredTokens().then((tokens) => {
      if (tokens) setMyAnonId(tokens.accessToken);
    });
  }, []);

  if (!recipientAnonId || !myAnonId) return null;

  return <DMScreen myAnonId={myAnonId} recipientAnonId={recipientAnonId} />;
}
