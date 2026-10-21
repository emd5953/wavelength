import Conversation from "./Conversation";
export default function CommentThread({
  broadcastId,
  viewerAnonId,
}: {
  broadcastId: string;
  viewerAnonId: string;
}) {
  return (
    <Conversation
      key={broadcastId}
      id={broadcastId}
      kind="comments"
      viewerAnonId={viewerAnonId}
    />
  );
}
