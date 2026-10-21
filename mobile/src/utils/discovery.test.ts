import {
  distanceMeters,
  groupMarkers,
  listenerName,
  sortFeed,
  validRadius,
} from "./discovery";
import type { FeedBroadcast } from "../services/api";
const play = (
  id: string,
  live: boolean,
  started: number,
  latitude = 40,
): FeedBroadcast => ({
  id,
  anonymousId: `session-${id}`,
  trackTitle: "The same song",
  artistName: "Artist",
  albumArtUrl: "",
  startedAt: started,
  timeSinceStart: 0,
  createdAt: started,
  isLive: live,
  endedAt: live ? null : started + 1,
  location: { latitude, longitude: -74 },
});
describe("discovery identities and location", () => {
  it("retains separate listeners playing the same track and orders live plays first", () => {
    const a = play("one", true, 1);
    const b = play("two", true, 2);
    const c = play("three", false, 3);
    expect(sortFeed([c, a, b]).map((p) => p.id)).toEqual([
      "two",
      "one",
      "three",
    ]);
    expect(listenerName(a.anonymousId)).not.toBe(listenerName(b.anonymousId));
  });
  it("groups overlapping pins while preserving each play and exact coordinates", () => {
    const a = play("one", true, 1),
      b = play("two", true, 2),
      c = play("three", false, 3, 40.01);
    const grouped = groupMarkers([a, b, c]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].plays.map((p) => p.id)).toEqual(["one", "two"]);
    expect(grouped[0].coordinate).toEqual(a.location);
    expect(distanceMeters(a.location!, c.location!)).toBeGreaterThan(1000);
  });
  it("does not fabricate coordinates for locationless plays", () => {
    expect(
      groupMarkers([{ ...play("one", true, 1), location: undefined }]),
    ).toEqual([]);
  });
  it.each([null, undefined, "", "NaN", "0", "501", "Infinity"])(
    "recovers an invalid persisted radius %s",
    (value) => {
      expect(validRadius(value)).toBe(100);
    },
  );
  it.each([50, 100, 500])("preserves valid radius %s", (value) =>
    expect(validRadius(String(value))).toBe(value),
  );
});
