import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpotifyAuthModule } from '../../src/services/spotifyAuth';
import ConnectionsListScreen from '../../src/components/ConnectionsListScreen';
import { Screen, PageTitle } from '../../src/components/ui';

export default function ConnectionsRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState('');

  useEffect(() => {
    SpotifyAuthModule.getStoredTokens().then((tokens) => {
      if (tokens) setUserId(tokens.accessToken);
    });
  }, []);

  if (!userId) return null;

  return (
    <Screen>
      <PageTitle title="people" subtitle="who you've connected with" topInset={insets.top} />
      <ConnectionsListScreen
        userId={userId}
        onSelectConnection={(connectionId) =>
          router.push(`/connection-detail?connectionId=${connectionId}`)
        }
        onOpenRequests={() => router.push('/connection-requests')}
      />
    </Screen>
  );
}
