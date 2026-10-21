import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { getMyAnonId } from '../src/services/presence';
import CommentThread from '../src/components/CommentThread';

export default function CommentThreadRoute() {
  const { broadcastId } = useLocalSearchParams<{ broadcastId: string }>();
  const [viewerAnonId, setViewerAnonId] = useState('');

  useEffect(() => {
    getMyAnonId().then((id) => {
      if (id) setViewerAnonId(id);
    });
  }, []);

  if (!broadcastId || !viewerAnonId) return null;

  return <CommentThread broadcastId={broadcastId} viewerAnonId={viewerAnonId} />;
}
