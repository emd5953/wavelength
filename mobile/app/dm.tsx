import { useLocalSearchParams } from "expo-router";
import DMScreen from "../src/components/DMScreen";
import { EmptyState } from "../src/design/ui";
export default function DMRoute() {
  const { recipientAnonId } = useLocalSearchParams<{
    recipientAnonId: string;
  }>();
  return recipientAnonId ? (
    <DMScreen recipientAnonId={recipientAnonId} />
  ) : (
    <EmptyState
      title="Choose a listener"
      body="Open a track from Nearby to start a conversation."
    />
  );
}
