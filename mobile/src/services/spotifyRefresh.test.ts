jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) =>
    key === "spotify_refresh_token" ? "stored-refresh" : null,
  ),
  deleteItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
jest.mock("expo-web-browser", () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock("expo-auth-session", () => ({
  makeRedirectUri: () => "wavelength://callback",
}));
import * as SecureStore from "expo-secure-store";
import { SpotifyAuthModule } from "./spotifyAuth";
beforeEach(() => {
  jest.clearAllMocks();
});
it("retains saved credentials during a network outage", async () => {
  global.fetch = jest.fn().mockRejectedValue(new TypeError("Network failed"));
  await expect(SpotifyAuthModule.refreshToken()).rejects.toThrow(
    "Network failed",
  );
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});
it("retains credentials when refresh service is temporarily unavailable", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
  await expect(SpotifyAuthModule.refreshToken()).rejects.toThrow();
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});
it("clears credentials only when refresh is definitively rejected", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
  await expect(SpotifyAuthModule.refreshToken()).resolves.toBeNull();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(3);
});
