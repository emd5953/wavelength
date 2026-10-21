import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { getMyAnonId } from "../src/services/presence";
import CommentThread from "../src/components/CommentThread";
import { EmptyState } from "../src/design/ui";
import { DEMO_MODE } from "../src/dev/demo";
export default function CommentThreadRoute() {
  const { broadcastId } = useLocalSearchParams<{ broadcastId: string }>();
  const [viewerAnonId, setViewerAnonId] = useState("");
  useEffect(() => {
    if (!DEMO_MODE) getMyAnonId().then((id) => setViewerAnonId(id ?? ""));
  }, []);
  return broadcastId ? (
    <CommentThread broadcastId={broadcastId} viewerAnonId={viewerAnonId} />
  ) : (
    <EmptyState
      title="Choose a play"
      body="Open a track from Nearby to read its comments."
    />
  );
}
