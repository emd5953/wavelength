jest.mock("./spotifyAuth", () => ({
  SpotifyAuthModule: { getValidToken: jest.fn() },
}));
jest.mock("../dev/demo", () => ({
  DEMO_MODE: true,
  demoFeed: [{ id: "fixture-only" }],
}));
import {
  addComment,
  addReaction,
  deleteAccount,
  fetchNearbyFeed,
  sendConnectionRequest,
  sendDM,
} from "./api";
import { SpotifyAuthModule } from "./spotifyAuth";
it("never fetches credentials or contacts the backend for sample data and mutations", async () => {
  global.fetch = jest.fn();
  expect((await fetchNearbyFeed(0, 0, 100)).broadcasts).toEqual([
    { id: "fixture-only" },
  ]);
  for (const action of [
    () => addComment("sample", "text"),
    () => addReaction("sample", "heart"),
    () => sendDM("sample", "hello"),
    () => sendConnectionRequest("sample"),
    deleteAccount,
  ]) {
    await expect(action()).rejects.toThrow("Preview only");
  }
  expect(global.fetch).not.toHaveBeenCalled();
  expect(SpotifyAuthModule.getValidToken).not.toHaveBeenCalled();
});
