jest.mock("./spotifyAuth", () => ({
  SpotifyAuthModule: { getValidToken: jest.fn(async () => "test-token") },
}));
jest.mock("../dev/demo", () => ({ DEMO_MODE: false }));
import {
  addComment,
  addReaction,
  ApiError,
  deleteAccount,
  fetchNearbyFeed,
  sendConnectionRequest,
  sendDM,
} from "./api";
import { SpotifyAuthModule } from "./spotifyAuth";
const fetchMock = jest.fn();
global.fetch = fetchMock;
beforeEach(() => {
  jest.clearAllMocks();
  (SpotifyAuthModule.getValidToken as jest.Mock).mockResolvedValue(
    "test-token",
  );
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
});
it("uses play IDs for comments and reactions, and listener IDs for conversations and requests", async () => {
  await addComment("play-one", "A thought");
  await addReaction("play-one", "heart");
  await sendDM("session-one", "Hello");
  await sendConnectionRequest("session-one");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    broadcastId: "play-one",
    text: "A thought",
  });
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
    broadcastId: "play-one",
    type: "heart",
  });
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
    recipientAnonId: "session-one",
    text: "Hello",
    includesConnectionRequest: false,
  });
  expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({
    broadcasterAnonId: "session-one",
  });
});
it("reports a rejected account deletion instead of resolving successfully", async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 500 });
  await expect(deleteAccount()).rejects.toBeInstanceOf(ApiError);
});
it("distinguishes an expired session before attempting a feed request", async () => {
  (SpotifyAuthModule.getValidToken as jest.Mock).mockResolvedValue(null);
  await expect(fetchNearbyFeed(40, -74, 100)).rejects.toMatchObject({
    status: 401,
  });
  expect(fetchMock).not.toHaveBeenCalled();
});
it("keeps failed network mutations rejected for retry", async () => {
  fetchMock.mockRejectedValue(new TypeError("Network request failed"));
  await expect(sendDM("session", "Keep my draft")).rejects.toThrow(
    "Network request failed",
  );
});
