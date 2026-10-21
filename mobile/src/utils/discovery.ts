import type { FeedBroadcast } from "../services/api";
export type Coordinate = { latitude: number; longitude: number };
export const RADIUS_KEY = "discovery_radius";
export function validRadius(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 50 && n <= 500
    ? Math.round(n / 50) * 50
    : 100;
}
export function sortFeed(items: FeedBroadcast[]) {
  return [...items].sort(
    (a, b) => Number(b.isLive) - Number(a.isLive) || b.startedAt - a.startedAt,
  );
}
export function listenerName(id: string) {
  // Session-derived names stay stable across plays without exposing a real profile.
  return `Listener ${
    id
      .replace(/[^a-z0-9]/gi, "")
      .slice(-6)
      .toUpperCase() || "UNKNOWN"
  }`;
}
export function distanceMeters(a: Coordinate, b: Coordinate) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.latitude - a.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(((b.longitude - a.longitude) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function distanceLabel(a: Coordinate | null, b?: Coordinate) {
  if (!a || !b) return "Distance unavailable";
  const meters = distanceMeters(a, b);
  return meters < 10 ? "Within 10 m" : `${Math.round(meters / 10) * 10} m away`;
}
export function timeAgo(at: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - at) / 60000));
  return minutes < 1
    ? "just now"
    : minutes < 60
      ? `${minutes} min ago`
      : `${Math.floor(minutes / 60)} hr ago`;
}
export function groupMarkers(items: FeedBroadcast[], threshold = 18) {
  // Group close pins into a selectable stack; never move their real coordinates.
  const groups: { coordinate: Coordinate; plays: FeedBroadcast[] }[] = [];
  for (const play of items) {
    if (!play.location) continue;
    const group = groups.find(
      (g) => distanceMeters(g.coordinate, play.location!) < threshold,
    );
    if (group) group.plays.push(play);
    else groups.push({ coordinate: play.location, plays: [play] });
  }
  return groups;
}
