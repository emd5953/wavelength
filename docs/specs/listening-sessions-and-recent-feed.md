# Listening sessions, recent feed, and on-repeat push

Implements the 2026-10-21 decisions in `docs/product-overview.md` (Decisions table).

## Problem

The core loop doesn't hold together:

- **Comments and reactions are deleted within seconds.** Every 15s the server
  poller calls `createBroadcast`, which deletes the user's broadcast and inserts
  a new one with a new `anonymous_id` (`server/src/services/broadcastService.ts`).
  Reactions and comments are deleted along with the old broadcast
  (`ON DELETE CASCADE`).
- **The feed only shows this moment.** `expireStaleBroadcasts` deletes every
  broadcast 30s after creation.
- **Push notifications fire on every broadcast within 500m,** and only on the
  mobile `POST /broadcasts` path, not from the server poller.
- **Viewer anonymous IDs leak credentials.** The mobile app uses the Spotify
  access token as the viewer's anonymous ID for comments and DMs
  (`mobile/app/dm.tsx:12`, `mobile/app/comment-thread.tsx:12`) and `'anonymous'`
  for reactions (`mobile/app/nearby-feed.tsx:33`). The server trusts whatever ID
  the client sends, so the token is stored in `comments.author_anon_id` and
  `direct_messages.sender_anon_id`. `GET /social/dms/:a/:b` has no participant
  check, so anyone who knows two anonymous IDs can read that thread, tokens
  included.
- **Two writers create broadcasts.** The server poller and the mobile
  `src/services/spotifyPoller.ts` (via `POST /broadcasts`) both create and delete
  broadcasts for the same user.

## Goals

- One anonymous ID per **listening session**. A session ends once the user has
  both stopped playing and been away from the app for 5+ minutes.
- The feed lists **every play within the viewer's radius over the last 6h**:
  one entry per play, never merged across listeners. Live plays are marked and
  sorted first, then the rest, newest first.
- Reactions and comments belong to a play and last as long as the play does (6h).
- DMs and connection requests address a session's anonymous ID, so they carry
  across tracks.
- Push notifications only for a nearby play of one of the recipient's
  on-repeat tracks, once per (recipient, listener, track).
- The server assigns every anonymous ID. Clients never send one for themselves.

## Non-goals

- Replacing the placeholder revealed profile (known gap #3). Separate change.
- A DM inbox. Recipients still can't list incoming threads. This exists today
  and is unchanged.
- Making the poller scale beyond one process (known gap #5).
- Taste-match or map-view changes beyond rendering the new fields.
- Feed copy and visual design beyond a "Live" badge and sort order.
- Removing the unused `mobile/src/services/spotifyTrackPoller.ts`.

## Approach

**The server poller is the only writer.** Each poll it updates the user's
session and current play in place. It never deletes and re-creates them. The
mobile app stops posting broadcasts and instead sends a presence heartbeat,
which is the "on the app" signal.

The `broadcasts` table stays and now means **a play**. Renaming it would touch
every query and test for no behavioral gain. Anonymous IDs move from
`broadcasts` to a new `listening_sessions` table. Each play references its
session.

*Alternative considered:* keep the delete-and-insert in `createBroadcast` but
reuse the anonymous ID. Rejected: it still deletes the reactions and comments
on every poll, and it can't represent "ended but still visible for 6h".

**Sessions also cover viewers who aren't listening.** Anyone who comments, DMs,
or has the app open needs an anonymous ID. The presence heartbeat gets or
creates a session, so a listener and a viewer use the same mechanism and the
same end rule.

## Design

### Schema — `server/src/db/migrations/004_listening_sessions.sql`

Every migration file re-runs on each boot (`migrate.ts`), so every statement
must be safe to re-run. Changes to existing rows sit inside
`DO $$ … IF NOT EXISTS (column check) … $$` blocks so they run only once.

```
listening_sessions
  id               UUID PK
  user_id          UUID → users ON DELETE CASCADE
  anonymous_id     VARCHAR(64) UNIQUE NOT NULL
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  last_playing_at  TIMESTAMPTZ NULL      -- last poll that saw playback
  ended_at         TIMESTAMPTZ NULL      -- NULL = open
  UNIQUE INDEX one open session per user: (user_id) WHERE ended_at IS NULL

broadcasts (a play) — changes, run once:
  TRUNCATE (current rows live at most 30s; nothing to keep)
  + session_id    UUID NOT NULL → listening_sessions ON DELETE CASCADE
  + track_id      VARCHAR(64) NOT NULL   -- Spotify track id
  + last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  + ended_at      TIMESTAMPTZ NULL       -- NULL = live
  - anonymous_id  (moves to listening_sessions)
  INDEX (ended_at), INDEX (session_id)

users
  + last_app_seen_at  TIMESTAMPTZ NULL

user_repeat_tracks            -- Spotify short_term top tracks
  user_id    UUID → users ON DELETE CASCADE
  track_id   VARCHAR(64)
  rank       INTEGER
  synced_at  TIMESTAMPTZ
  PK (user_id, track_id)

push_notifications_sent
  recipient_user_id  UUID → users ON DELETE CASCADE
  listener_user_id   UUID → users ON DELETE CASCADE
  track_id           VARCHAR(64)
  sent_at            TIMESTAMPTZ DEFAULT NOW()
  PK (recipient_user_id, listener_user_id, track_id)
```

`user_top_tracks` (taste match) is left alone. It has no track ID, and
taste match is out of scope.

### Services

`server/src/services/sessionService.ts` (new) owns session lifecycle:

```ts
getOrCreateOpenSession(userId: string): Promise<{ id: string; anonymousId: string }>
touchPresence(userId: string): Promise<{ anonymousId: string }>   // bumps last_app_seen_at
endIdleSessions(): Promise<number>                                 // scheduler
resolveAnonId(anonymousId: string): Promise<string | null>         // → user_id
anonIdsForUser(userId: string): Promise<string[]>                  // DM thread + deletion
```

`server/src/services/broadcastService.ts` replaces create/remove with play
transitions:

```ts
recordPlayback(userId: string, track: CurrentTrack, location: GeoPosition):
  Promise<{ play: Broadcast; isNew: boolean }>
recordNotPlaying(userId: string): Promise<{ endedPlayId: string | null }>
getFeedInRadius(location: GeoPosition, radiusMeters: number, excludeUserId: string):
  Promise<FeedPlay[]>
endStalePlays(): Promise<number>        // live but not seen for 60s
expireOldPlays(): Promise<number>       // ended > 6h ago
```

`createBroadcast`, `removeBroadcast`, `getBroadcastsInRadius` and
`expireStaleBroadcasts` are removed. `proximityService.findNearby` duplicates
the old feed query. It switches to the same 6h window so the integration tests
keep exercising real SQL.

`server/src/services/pushService.ts`: `sendPushToNearbyUsers` is replaced by

```ts
notifyRepeatListeners(listenerUserId: string, play: Broadcast): Promise<number>
```

It selects recipients within 500m of the play (by `last_latitude/longitude`)
who have a push token and have `play.track_id` in `user_repeat_tracks`. Then,
in a single statement, it inserts into `push_notifications_sent ... ON CONFLICT
DO NOTHING RETURNING recipient_user_id` and sends only to the rows returned.
That makes deduplication atomic.

`server/src/services/tasteService.ts`: add `syncRepeatTracks(userId, token)`,
which reads `/v1/me/top/tracks?time_range=short_term&limit=50`. It's called on
login and from the poller whenever `synced_at` is older than 24h.

`server/src/services/spotifyPoller.ts`: calls `recordPlayback` /
`recordNotPlaying`. When `isNew`, it emits `broadcast:new` and calls
`notifyRepeatListeners`. When a play ends, it emits `broadcast:ended`.

`server/src/scheduler.ts`: replace `expireStaleBroadcasts` with
`endStalePlays` + `expireOldPlays` (every 30s) and add `endIdleSessions`
(every 60s). `expireStaleRequests` is unchanged.

`server/src/services/privacyService.ts`: `deleteAccount` collects anonymous IDs
from `listening_sessions`, not `broadcasts`. Today it misses every past ID.
`cleanupSessionData` and the socket `disconnect` handler that calls it are
removed, because deleting plays when the socket disconnects contradicts the 6h
window.

### Routes

| Route | Change |
|---|---|
| `POST /account/presence` | **New.** Get or create the open session, set `last_app_seen_at = NOW()`. → `200 { anonymousId }` |
| `GET /feed/nearby` | Returns plays from the last 6h. Each item adds `isLive: boolean`, `endedAt: number \| null`; `anonymousId` is the session's. `fuzzLocation` is removed, so locations are exact |
| `POST /social/reactions` | Body `{ broadcastId, type }`. Actor's ID comes from the session |
| `POST /social/comments` | Body `{ broadcastId, text }`. Actor's ID comes from the session |
| `POST /social/dms` | Body `{ recipientAnonId, text, includesConnectionRequest }`. Sender's ID comes from the session |
| `GET /social/dms/:otherAnonId` | **Replaces** `/dms/:a/:b`. Returns DMs between any of the caller's session IDs and `otherAnonId` |
| `POST /connections/requests` | `resolveAnonId` resolves any session that has a play in the 6h window, not just live ones |
| `POST /broadcasts`, `DELETE /broadcasts` | **Removed** |

Client-supplied `viewerAnonId` / `authorAnonId` / `senderAnonId` are ignored,
not rejected, so an old mobile build doesn't get 400s mid-rollout.

Socket events: `broadcast:new` (a feed item with `isLive: true`) and
`broadcast:ended` (`playId`). `broadcast:removed` is dropped. Plays leave the
feed at 6h through the existing 10s re-fetch.

### Mobile

- `src/services/api.ts`: drop self-ID params from `addReaction`, `addComment`,
  `sendDM`. `getDMThread(otherAnonId)`. Add `sendPresence(): Promise<{ anonymousId }>`.
  `FeedBroadcast` gains `isLive` and `endedAt`.
- `src/services/presence.ts` (new): calls `sendPresence` immediately and every
  60s while `AppState` is `active`, and stops in the background. It caches
  `anonymousId` and exposes `getMyAnonId()` for the "is this me" display checks.
- `app/nearby-feed.tsx`: start presence instead of `startPolling`. Handle
  `broadcast:ended` by setting `isLive: false`. Sort live first, then
  `startedAt` desc.
- `app/dm.tsx`, `app/comment-thread.tsx`: use `getMyAnonId()` instead of
  `tokens.accessToken`.
- `src/components/BroadcastCard.tsx`: "Live" badge when `isLive`, otherwise
  "Nm ago" from `endedAt`.
- Delete `src/services/spotifyPoller.ts` (the mobile broadcast writer).
- `app/onboarding.tsx:19`: replace "Your exact location is never shared." with
  "People nearby can see where you're listening on the map." The current
  line would be false.

No new dependencies.

## Behavior

Server poll for user U every 15s. U must have a last known location,
otherwise skip, as today.

1. **Playing track T, no open session** → create a session with a new
   anonymous ID, then insert play(T) as live at U's last location. `isNew` →
   emit `broadcast:new` and notify repeat listeners.
2. **Playing T, latest play in the session is live and also T** → update
   `last_seen_at` and the session's `last_playing_at`. No event.
3. **Playing T, latest play is a different track** → end it (`ended_at = now`,
   emit `broadcast:ended`), insert play(T). `isNew`.
4. **Playing T, latest play is T and ended < 5 min ago** (pause then resume)
   → reopen it (`ended_at = NULL`). No new entry, no push.
5. **Not playing / 204 / Spotify error** → end the live play if there is one.
   The session stays open.
6. **Same track on loop** → Spotify reports the same ID, so it stays one play
   (case 2).

Scheduler:

- **Ending stale plays:** a live play whose `last_seen_at` is older than 60s
  is ended. This covers poller failures, revoked tokens and server restarts.
- **Expiring old plays:** plays with `ended_at < now − 6h` are deleted along
  with their reactions and comments (cascade). Plays that are still live are
  never deleted.
- **Ending idle sessions:** an open session ends when
  `COALESCE(last_playing_at, started_at) < now − 5m` **and**
  `COALESCE(users.last_app_seen_at, '-infinity') < now − 5m`. Its plays stay in
  the feed. The next playback or presence call creates a new session with a
  new ID.

Feed for viewer V at radius r (clamped to 50–500 as today): plays within r
that are live or have `ended_at > now − 6h`, excluding V's own, ordered
`isLive DESC, started_at DESC`. Two listeners on the same track appear as two
entries. Locations are returned exactly as recorded, with no fuzzing.

Push on a new play P by listener L: recipients within 500m who have a push
token, aren't L, and have `P.track_id` in their `user_repeat_tracks`.
Deduplicated per (recipient, L, track), permanently, by account rather than
by session.

Errors:

- Reaction or comment on a play that has expired → **404** "That play is no
  longer in the feed". Today the foreign-key violation becomes a 500.
- DM to an anonymous ID that doesn't resolve → **404**.
- Connection request to a session with no play in the 6h window → **404**, as today.
- `GET /social/dms/:otherAnonId` only ever returns DMs where the caller is a
  participant, which also closes the read-anyone's-thread hole.
- Repeat-track sync fails → keep the previous rows. Push simply doesn't fire
  for a user who has none.

## Verification

1. **Unit tests (Vitest, mocked pool, matching the existing style)** for
   poll cases 1–6, the three scheduler rules (including the both-conditions
   rule for ending sessions), push deduplication, and server-derived IDs in the
   social routes (client-sent IDs ignored). Rewrite the 8 test files that use
   the removed functions: `feedRoute`, `anonymousIdNonTraceability`,
   `broadcastDataCompleteness`, `broadcastPayloadIdentity`, `broadcastRemoval`,
   `broadcastService`, `expiredBroadcastExclusion`, `selfExclusion`.
2. **Integration test** `server/src/services/listeningSession.itest.ts` against
   PostGIS:
   - play A → B: one session, two plays, B live
   - reactions on A survive B starting
   - a play ended 6h+ ago is gone, along with its comments
   - feed ordering is live first
   - the session-end rule
   - push deduplication through the real `ON CONFLICT`
3. **Data check:** no access token appears in `comments` or
   `direct_messages` after a mobile run (`SELECT ... WHERE author_anon_id LIKE 'BQ%'`).
4. `npm test`, `npm run test:integration`, mobile tests and type check, and
   `node scripts/check-local-setup.mjs`, all green in CI.
5. **Two-device manual check** (the first one this project has had):
   - A plays a song, B sees it live
   - A skips, B sees two entries and the first is no longer live
   - B comments on the first, the comment persists
   - B DMs A across the track change
   - A pauses and closes the app, and after 5+ min a new play shows a new
     anonymous ID

## Risks / open questions

- **Exact locations, visible for 6h.** Location fuzzing is removed by decision
  (2026-10-21). Combined with the 6h window, the map shows where a stranger
  sat, to within GPS accuracy, for hours. The risks are stalking, App Store
  review of the location disclosure, and the privacy labels. Revisit before
  public launch.
- **Session rows are kept until the account is deleted.** They hold
  `anonymous_id → user_id` and no location. Keeping them is what lets DM threads
  and account deletion find past IDs. The alternative, deleting sessions after
  6h, orphans the DMs.
- **Assumption: "stopped listening" means no playback seen by the poller.**
  Spotify reports listening on any device, so someone listening on a laptop
  keeps their session open with the phone closed. That seems right, since
  they are still listening.
- **Stale recipient location for push.** Recipients are matched on
  `last_latitude/longitude` with no age limit, as today. Someone who left the
  area hours ago and has background location off could still be notified.
  Leaving it unchanged; flagging it.
- **Backgrounded app.** Presence stops when the app is backgrounded, so an
  app left in the background counts as "off the app". That matches the decision.
- **Rollout.** The server ignores old fields, but an old mobile build's
  `POST /broadcasts` will get 404s (it swallows errors) and its DM thread
  calls will fail. Fine with no users yet.

## Status

Milestones 1–4 implemented on branch `listening-sessions`. Verified:

- 136 unit tests
- 53 integration tests (19 new in `listeningSession.itest.ts`, checked by
  breaking the code on purpose and watching them fail)
- mobile type check and tests, `check-local-setup.mjs`
- a live smoke run against a booted server: presence, the 6h feed with
  live-first order, a comment on an ended play, DMs readable by both sides, a
  spoofed `authorAnonId` ignored, zero tokens stored in `comments` or
  `direct_messages`, and `POST /broadcasts` returning 404

**Not done:** the two-device manual check (milestone 5). It needs two real
phones and Spotify accounts.

What moved from the spec during implementation:

- The repeat-track sync time lives on `users.repeat_tracks_synced_at`, not on
  `user_repeat_tracks`. Otherwise a user with no recent top tracks has no rows
  and would be re-synced on every poll.
- `endIdleSessions` also requires the session to have no live play. Otherwise
  a live play could sit in an ended session.
- A resumed play also emits `broadcast:new`, and mobile replaces the entry by
  ID, so it flips back to live without waiting for the 10s re-fetch.
  `endStalePlays` runs from the scheduler, which has no socket, so clients
  only see those ends on the next re-fetch.
- `proximityService.findNearby` was deleted rather than updated. Nothing
  outside its integration test used it, and that test now runs against
  `getFeedInRadius`.
- The DM screen treats as "mine" any message the other side didn't send,
  since one thread spans all of the caller's sessions.

Fixed along the way, because these sat in the code being changed:

- **`DELETE /account/:userId` deleted the account named in the URL.** Any
  signed-in user could delete anyone. It also meant the app's own
  `DELETE /account/me` always failed: `'me'` isn't a UUID, and the client
  swallowed the error. It now always deletes the caller.
- **`broadcast:new` socket payloads carried the listener's real `userId`.**
  It's now stripped before emitting.

Deleted tests: 7 in-memory simulation tests asserting rules this spec
reverses (30s expiry, removal on stop, distance-sorted feed, per-broadcast
anonymous IDs, location deleted at session end, the removed broadcast router):
`anonymousIdNonTraceability`, `broadcastRemoval`, `broadcastRouterProperties`,
`broadcastService`, `expiredBroadcastExclusion`, `feedSortedByProximity`,
`sessionScopedLocationData`. None of them called real code. The integration
test covers their replacements.

## Milestones

1. ✅ **Schema and play model.** Migration 004, `sessionService`,
   `recordPlayback`/`recordNotPlaying`, the poller and scheduler, and the 6h
   feed with `isLive`, fuzzing removed. The old social routes keep working against plays. Unit
   tests updated.
2. ✅ **Server-assigned identity.** `POST /account/presence`, social routes take
   IDs from the session, the DM thread route and participant check,
   `resolveAnonId` via sessions, account-deletion fix, removal of
   `POST/DELETE /broadcasts` and the disconnect cleanup.
3. ✅ **Mobile.** Presence, API signature changes, the token-as-ID fix, Live
   badge and ordering, delete the mobile poller. Lands together with 2, since
   the DM thread route changes shape.
4. ✅ **On-repeat push.** `user_repeat_tracks` sync, `notifyRepeatListeners`
   with deduplication. Independent of 2 and 3.
5. **Integration test and the two-device check.**
