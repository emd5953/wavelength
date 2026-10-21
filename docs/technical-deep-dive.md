# Wavelength — Technical Deep Dive

How the system works today. For *why* it works this way, see
`docs/product-overview.md` (product decisions) and `docs/specs/` (design
records for each change).

## Architecture Overview

Wavelength is a proximity-based music discovery app. Users who have linked
Spotify are polled by the server, and every track they play becomes a **play**
at their location. Other users nearby see live and recent plays (the last 6
hours) in a feed, anonymously.

Two layers:
- **Mobile client** (React Native, Expo dev build, iOS): auth, GPS, the
  presence heartbeat, and the feed UI.
- **Backend** (Node.js / Express / Socket.IO, PostgreSQL + PostGIS): Spotify
  polling, sessions and plays, the feed, social, connections, and push.

The server is the **only writer of plays**. The app never posts what you're
listening to; it only reports where you are and that it's open.

## Core Flow

```
User links Spotify ──▶ server stores tokens
                              │
            server polls Spotify every 15s for every user with a location
                              │
     playing ─▶ continue / start / resume a play in the user's listening session
     paused  ─▶ end the live play (it stays in the feed as "earlier" for 6h)
                              │
     viewers nearby see live plays first, then the last 6h, newest first
```

## Core Concepts

### Listening sessions

A **session** is a user's anonymous identity for one stretch of activity
(`listening_sessions`, `services/sessionService.ts`).

- Each session has one random `anonymous_id`. Every play, comment, reaction
  and DM in the session uses it, so DMs and connection requests carry across
  tracks.
- A session is opened by **playback** (the poller) or by **presence** (the app
  is open, `POST /account/presence`). There is at most one open session per
  user, enforced by a partial unique index.
- A session **ends** when the user has stopped playing **and** been away from
  the app for 5+ minutes, and has no live play. The next playback or presence
  opens a new session with a new ID.
- Sessions are kept until account deletion. They hold no location, and keeping
  them is what lets DM threads and account deletion find past IDs.

### Plays

A **play** is one track by one listener at one place (the `broadcasts` table;
the name predates the concept).

- `ended_at IS NULL` means live. The poller updates `last_seen_at` while the
  track keeps playing.
- Pausing ends the play. Resuming the **same track within 5 minutes reopens
  it** instead of creating a duplicate.
- A different track ends the previous play and starts a new one.
- Plays stay in the feed for **6 hours after ending**. After that they're
  deleted, along with their reactions and comments (cascade) and their
  location.
- Location is recorded **exactly**, where the play started. Fuzzing was
  removed by decision on 2026-10-21; see Privacy Model.

## Authentication

1. The app runs Spotify OAuth (authorization code flow, **no PKCE**) with
   redirect URI `wavelength://callback`.
2. The app sends the code to `POST /auth/callback`.
3. The server exchanges it for tokens using the client secret, fetches
   `/v1/me`, and upserts the user.
4. In the background it syncs top artists and tracks (for taste match) and
   short-term top tracks (for on-repeat push).
5. The server returns the access token, which the app sends as a Bearer token
   on every API call.

`authMiddleware` resolves the Bearer token to `req.userId` by matching
`users.encrypted_access_token`. **Every route takes the acting user from
`req.userId`**, never from the body, query or path.

## Server-Side Spotify Polling

`services/spotifyPoller.ts`, every 15s, for every user with a last known
location:

| Spotify says | What happens |
|---|---|
| Playing track T | `recordPlayback`: **continued** (same live play), **resumed** (same track, ended < 5 min ago), or **started** (new play; ends any other live play) |
| 204 / `is_playing: false` | `recordNotPlaying`: end the live play, emit `broadcast:ended` |
| Error (401, 429, 5xx) | **Nothing.** An error says nothing about playback. If errors persist, the scheduler ends the play after 60s |

On **started** the poller emits `broadcast:new` and runs on-repeat push. On
**resumed** it emits `broadcast:new` again so clients flip the card back to
live. It also re-syncs the user's on-repeat tracks when they're more than 24h
old.

This is what lets users broadcast without the app open: all it needs is a
location, which background location keeps fresh.

## Location Handling

1. **Foreground:** the feed reads GPS on every refresh and posts it to
   `POST /account/location` (`users.last_latitude`, `last_longitude`,
   `last_location_at`).
2. **Background:** `backgroundLocation.ts` (expo-task-manager, 60s / 50m)
   posts the same thing while the app is closed.
3. **Plays** copy the user's last location when they start. The poller has
   nothing else to go on.

## Database Schema (PostGIS)

Migrations live in `server/src/db/migrations/` and **all of them re-run on
every boot**, so every statement must be safe to re-run.

| Table | Holds |
|---|---|
| `users` | Spotify tokens, last location, `push_token`, `last_app_seen_at`, `repeat_tracks_synced_at` |
| `listening_sessions` | `anonymous_id`, `started_at`, `last_playing_at`, `ended_at` |
| `broadcasts` | Plays: `session_id`, track fields, `track_id`, `location` (geography), `started_at`, `last_seen_at`, `ended_at` |
| `reactions` / `comments` | Per play, keyed by the actor's anonymous ID; cascade with the play |
| `direct_messages` | `sender_anon_id` → `recipient_anon_id` |
| `connection_requests` / `connections` | By real user ID; 24h request expiry |
| `connection_messages` | Chat between connected users, by real user ID; cascades with the connection |
| `user_top_artists` / `user_top_tracks` | Medium-term top 20s, for taste match |
| `user_repeat_tracks` | Short-term top 50 track IDs, for on-repeat push |
| `push_notifications_sent` | `(recipient, listener, track)` dedup for push |
| `user_settings` | Unused; the app keeps the radius on-device |

Spatial queries use `ST_DWithin` on geography with a GIST index on
`broadcasts.location`.

## API

All routes except `/auth/*` and `/health` require a Bearer token.

| Route | Purpose |
|---|---|
| `POST /auth/callback`, `POST /auth/refresh` | OAuth code exchange, token refresh |
| `GET /feed/nearby?lat&lng&radius` | Plays in range (radius clamped 50–500m, default 100), live or ended within 6h, excluding the caller's own; live first, then newest. Each item has `isLive`, `endedAt`, `anonymousId`, exact `location`, `tasteScore`, `timeSinceStart`; never `userId` |
| `POST /account/presence` | Heartbeat. Opens or keeps the caller's session, returns `{ anonymousId }` |
| `POST /account/location` | Update last known location |
| `POST /account/push-token` | Store the Expo push token |
| `DELETE /account/me` | Delete the **caller's** account (the path segment is ignored) |
| `POST /social/reactions` `{ broadcastId, type }` | React as the caller's session. 404 if the play has expired |
| `GET /social/reactions/:broadcastId` | Counts |
| `POST /social/comments` `{ broadcastId, text }` | Comment as the caller's session. 404 if the play has expired |
| `GET /social/comments/:broadcastId` | Thread |
| `POST /social/dms` `{ recipientAnonId, text, includesConnectionRequest }` | DM as the caller's session. 404 if the recipient isn't addressable. With the flag, also creates the connection request and returns `connectionRequest: 'sent' \| 'already_pending'` (400 if asking yourself) |
| `GET /social/dms/:otherAnonId` | The caller's thread with that ID, across all the caller's sessions. Only participants can read it |
| `POST /connections/requests` `{ broadcasterAnonId }` | Request to connect without a DM. 404 if the ID is no longer addressable. The app uses the DM flag instead |
| `GET /connections/requests/incoming` · `/outgoing` | Pending requests |
| `POST /connections/requests/:id/accept` · `/decline` · `/cancel` | 403 if the caller isn't entitled, 409 if not pending |
| `GET /connections`, `GET /connections/:id`, `DELETE /connections/:id` | Connections and the revealed profile |
| `GET /connections/:id/messages` · `POST` `{ text }` | Chat between the two connected users. Participants only (404 otherwise); each message has `mine`, never a user ID. Deleted with the connection |

An anonymous ID is **addressable** while its session is open, or while it has
a play still inside the 6h feed window.

## Real-Time Updates (Socket.IO)

The feed is hybrid:
- **HTTP refresh** of `/feed/nearby` every 10s (the source of truth; it also
  drops plays past 6h).
- **Socket events:** `broadcast:new` (a feed item, sent to clients within
  range) when a play starts or resumes, and `broadcast:ended` (play ID, sent
  to all clients) when one stops being live.

Disconnecting only forgets the client's subscription; plays outlive sockets.
Plays ended by the scheduler's stale check emit nothing, and clients pick them
up on the next refresh.

## Scheduler (`scheduler.ts`)

| Every | Job |
|---|---|
| 30s | `endStalePlays`: live plays not seen for 60s are ended at `last_seen_at` |
| 30s | `expireOldPlays`: delete plays ended more than 6h ago |
| 60s | `expireStaleRequests`: pending connection requests older than 24h → `expired` |
| 60s | `endIdleSessions`: the session-end rule above |

## On-Repeat Push Notifications

You get a push when someone nearby starts playing a track you've had on
repeat lately.

- **"On repeat"** means Spotify short-term top tracks (`time_range=short_term`,
  ~4 weeks, top 50), synced at login and re-synced by the poller every 24h.
  Spotify's own "On Repeat" playlist isn't readable through the API.
- **Recipients** have a push token, a last location within 500m of the play,
  and the play's `track_id` in `user_repeat_tracks`. The listener is never
  notified about their own play.
- **Dedup:** each `(recipient, listener, track)` is notified at most once,
  ever, and tracked by account, so a new session doesn't re-notify. The insert
  into `push_notifications_sent ... ON CONFLICT DO NOTHING RETURNING` decides
  who gets sent to, atomically.
- Sent through the Expo push API in batches of 100.

The app registers its token on first feed load (`pushNotifications.ts` →
`POST /account/push-token`). Simulators can't obtain push tokens.

## Music Taste Matching

- On login, `syncUserTaste` stores the medium-term top 20 artists and tracks.
- `getTasteScore(a, b)`: shared artists ×3 (max 60), plus shared tracks ×2
  (max 40), out of 100 and case-insensitive.
- The feed returns it per item, and the card shows `· 42% match` when it's
  above 0.

## Privacy Model

- **Anonymous by default.** Viewers see a session's random ID, never a user
  ID, and the server assigns every ID. Clients can't choose or spoof one, and
  the server ignores any ID a client sends for itself.
- **Exact location, by decision (2026-10-21).** Plays show where the listener
  actually was. This is a known risk to revisit before public launch; see the
  product overview.
- **Short-lived.** Plays and their locations are deleted 6h after ending. The
  user's last location is kept on `users` for the poller.
- **Mutual reveal.** Spotify profiles are shown only after both sides accept a
  connection.
- **Leaving is total.** `DELETE /account/me` deletes DMs from every session ID
  the user held, then the user row, which cascades to everything else.

## Mobile App Structure

```
mobile/
├── app/                        # Expo Router screens
│   ├── _layout.tsx             # Stack, header styles, font loading, LinearGradient interop
│   ├── index.tsx               # Login (redirects to onboarding / feed)
│   ├── onboarding.tsx
│   ├── (tabs)/                 # Bottom tab bar: nearby · map · people · you
│   │   ├── _layout.tsx         # Tabs + NearbyFeedProvider (one feed subscription for both feed tabs)
│   │   ├── nearby-feed.tsx     # nearby: PLAYING NOW / EARLIER list
│   │   ├── map.tsx             # map: same plays as pins
│   │   ├── connections.tsx     # people: requests card + connections
│   │   └── profile.tsx         # you: radius slider, log out, delete account
│   ├── play.tsx                # One play: big art, reactions, message, comments
│   ├── dm.tsx
│   ├── connection-detail.tsx · connection-requests.tsx
│   ├── chat.tsx                # Chat with a connection (polls every 5s)
│   └── location-required.tsx
├── assets/fonts/paper-mono/    # Paper Mono, SIL OFL 1.1
└── src/
    ├── components/
    │   ├── ui.tsx              # Design-system primitives + COLORS
    │   ├── Conversation.tsx    # Bubbles + composer (comments, DMs)
    │   ├── FeedHeader.tsx      # Blurred-art header with title and live/earlier counts
    │   ├── BroadcastRow.tsx    # Minimal feed row; tapping opens /play
    │   ├── Reactions.tsx       # Word pills: fire · love · same · yes · new to me
    │   ├── FeedMap.tsx         # Muted, sky-tinted map; album-art pins that open /play
    │   └── Connection*Screen.tsx · CommentThread.tsx · DMScreen.tsx
    ├── config/spotify.ts       # OAuth config
    └── services/
        ├── api.ts              # REST client (authFetch)
        ├── nearbyFeed.tsx      # Feed provider: polling, socket, presence, background location
        ├── presence.ts         # 60s heartbeat while foregrounded; caches my anonymous ID
        ├── feedSocket.ts       # broadcast:new / broadcast:ended
        ├── gps.ts · backgroundLocation.ts · pushNotifications.ts
        └── spotifyAuth.ts
```

## Server Structure

```
server/src/
├── db/                     # pool, migration runner, migrations 001–005
├── middleware/             # auth (Bearer → req.userId), errorHandler
├── routes/                 # auth, feed, social, connections, account
├── services/
│   ├── sessionService.ts   # Sessions, presence, anonymous-ID resolution
│   ├── broadcastService.ts # Play lifecycle + feed query
│   ├── spotifyPoller.ts    # The only writer of plays
│   ├── pushService.ts      # On-repeat push with dedup
│   ├── tasteService.ts     # Taste sync + score, repeat-track sync
│   ├── socialService.ts · connectionService.ts · privacyService.ts
│   ├── feedSocket.ts       # Socket emits
│   └── proximityService.ts # Radius clamp
├── scheduler.ts
└── index.ts
```

`server/src/db/redis.ts` exists but nothing imports it. Redis runs in
`docker-compose` and is currently unused.

## Design System

Sky palette and Paper Mono. The reasoning is in
`docs/design/222-reference.md`.

- **Tokens** (`mobile/tailwind.config.js`; raw values in `ui.tsx` `COLORS`):
  `night` `#051F33`, `ground` `#082F49`, `ground-lift` `#0C4A6E`, `primary`
  `#075985`, `ink` `#F0F9FF`, `ink-muted` / `ink-dim` (sky-100/200 at
  65%/45%), `card` / `rule` (sky-50 at 6%/15%), and `live` `#38BDF8` (the
  only bright color).
- **Type:** `font-mono-light` / `font-mono` / `font-mono-medium` /
  `font-mono-semibold`, one family per weight because React Native can't
  synthesize weights for custom fonts. Copy is lowercase; section labels are
  tracked uppercase on hairlines.
- **Rules:** no shadows, no emoji (reactions are words), one filled
  (`primary`) action per screen, and album art as the only source of color.
  The feed is plain rows on hairlines; actions live on the play screen.
- NativeWind only applies `className` to components it knows about.
  Third-party components (like `LinearGradient`) need `cssInterop` in
  `_layout.tsx`.

## Development Setup

### Prerequisites
- Node.js 18+, Docker, Xcode (iOS simulator)
- A Spotify Developer app with redirect URI `wavelength://callback` and scopes
  `user-read-currently-playing`, `user-read-playback-state`, `user-top-read`,
  `user-read-email`, `user-read-private`
- In development mode, Spotify only allows allowlisted users (up to 25)

### Running Locally
```bash
docker compose up -d                 # Postgres + PostGIS (and Redis, unused)
cd server && npm run dev             # API + poller + scheduler on :3000
cd mobile && npx expo run:ios        # native dev build + Metro on :8081
```
Pin the simulator's location with `xcrun simctl location booted set <lat>,<lng>`.

### Environment Variables

**Server (`server/.env`):** `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`,
`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `PORT` (default
3000), `CORS_ORIGIN`, and `REDIS_URL` (unused).

**Mobile (`mobile/.env`):** `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SPOTIFY_CLIENT_ID`.
