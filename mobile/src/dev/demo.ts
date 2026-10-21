import type {
  FeedBroadcast,
  ConnectionRequestData,
  ConnectionListItem,
  ConnectionDetailData,
  DMMessage,
  Comment,
} from "../services/api";
// Explicit, development-only switch. Never combines fixtures with real activity.
export const DEMO_MODE =
  __DEV__ && process.env.EXPO_PUBLIC_DEMO_MODE === "true";
const now = Date.now();
export const demoLocation = { latitude: 40.7308, longitude: -73.9973 };
export const demoFeed: FeedBroadcast[] = [
  {
    id: "demo-play-1",
    anonymousId: "demo-listener-a3f901",
    trackTitle: "Moon River",
    artistName: "Frank Ocean",
    albumArtUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
    isLive: true,
    startedAt: now - 95000,
    createdAt: now - 95000,
    timeSinceStart: 95000,
    endedAt: null,
    tasteScore: 87,
    location: { latitude: 40.731, longitude: -73.9971 },
  },
  {
    id: "demo-play-2",
    anonymousId: "demo-listener-b2c817",
    trackTitle: "BIRDS OF A FEATHER",
    artistName: "Billie Eilish",
    albumArtUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/92/9f/69/929f69f1-9977-3a44-d674-11f70c852d1b/24UMGIM36186.rgb.jpg/600x600bb.jpg",
    isLive: true,
    startedAt: now - 40000,
    createdAt: now - 40000,
    timeSinceStart: 40000,
    endedAt: null,
    tasteScore: 72,
    location: { latitude: 40.7306, longitude: -73.997 },
  },
  {
    id: "demo-play-3",
    anonymousId: "demo-listener-c4d920",
    trackTitle: "Moon River",
    artistName: "Frank Ocean",
    albumArtUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
    isLive: true,
    startedAt: now - 130000,
    createdAt: now - 130000,
    timeSinceStart: 130000,
    endedAt: null,
    location: { latitude: 40.731, longitude: -73.9971 },
  },
  {
    id: "demo-play-4",
    anonymousId: "demo-listener-f8e201",
    trackTitle: "Tadow",
    artistName: "Masego, FKJ",
    albumArtUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/5d/e3/8a/5de38af4-52e3-993d-213b-7bdfcf8a055f/842812109249.jpg/600x600bb.jpg",
    isLive: false,
    startedAt: now - 600000,
    createdAt: now - 600000,
    timeSinceStart: 600000,
    endedAt: now - 360000,
    tasteScore: 64,
    location: { latitude: 40.7303, longitude: -73.998 },
  },
];
export const demoRequests: ConnectionRequestData[] = [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "expired",
].map((status, i) => ({
  id: `demo-request-${i}`,
  viewerUserId: "",
  broadcasterUserId: "",
  status: status as ConnectionRequestData["status"],
  createdAt: now - 3600000,
  expiresAt: status === "expired" ? now - 1000 : now + 7200000,
}));
export const demoConnections: ConnectionListItem[] = [
  {
    id: "demo-connection",
    connectedUserId: "demo-person",
    displayName: "Alex",
    profileImageUrl: "",
    createdAt: now - 86400000,
  },
];
export const demoDetail: ConnectionDetailData = {
  ...demoConnections[0],
  profile: {
    displayName: "Alex",
    profileImageUrl: "",
    profileLink: "",
    topArtists: ["Frank Ocean", "SZA", "Khruangbin"],
    topTracks: ["Moon River", "Good Days", "Friday Morning"],
  },
};
export const demoMessages = (id: string): DMMessage[] => [
  {
    id: "demo-message-1",
    senderAnonId: id,
    recipientAnonId: "demo-me",
    text: "This song makes the walk home feel like a movie.",
    createdAt: now - 240000,
    includesConnectionRequest: false,
  },
  {
    id: "demo-message-2",
    senderAnonId: "demo-me",
    recipientAnonId: id,
    text: "Exactly. Those layered vocals are everything.",
    createdAt: now - 180000,
    includesConnectionRequest: false,
  },
];
export const demoComments = (id: string): Comment[] => [
  {
    id: "demo-comment",
    broadcastId: id,
    authorAnonId: "demo-listener-f8e201",
    text: "An instant save. Perfect for this time of day.",
    createdAt: now - 120000,
  },
];
