import { useLocalSearchParams, useRouter } from "expo-router";
import ConnectionDetailScreen from "../src/components/ConnectionDetailScreen";
import { EmptyState } from "../src/design/ui";
export default function ConnectionDetailRoute() {
  const router = useRouter();
  const { connectionId } = useLocalSearchParams<{ connectionId: string }>();
  return connectionId ? (
    <ConnectionDetailScreen
      connectionId={connectionId}
      onRemoved={() => router.replace("/connections")}
    />
  ) : (
    <EmptyState
      title="Choose a connection"
      body="Your mutual connections are waiting in Connections."
    />
  );
}
