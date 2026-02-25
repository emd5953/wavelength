import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SpotifyAuthModule } from '../src/services/spotifyAuth';
import CommentThread from '../src/components/CommentThread';

export default function CommentThreadRoute() {
  const { broadcastId } = useLocalSearchParams<{ broadcastId: string }>();
  const [viewerAnonId, setViewerAnonId] = useState('');

  useEffect(() => {
    SpotifyAuthModule.getStoredTokens().then((tokens) => {
      if (tokens) setViewerAnonId(tokens.accessToken);
    });
  }, []);

  if (!broadcastId || !viewerAnonId) return null;

  return <CommentThread broadcastId={broadcastId} viewerAnonId={viewerAnonId} />;
}
