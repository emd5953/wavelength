import Conversation from "./Conversation";
export default function DMScreen({
  recipientAnonId,
}: {
  recipientAnonId: string;
}) {
  return <Conversation key={recipientAnonId} id={recipientAnonId} kind="dm" />;
}
