# Wavelength — Application Workflow

Step-by-step flows through the app and server. For the system reference
(schema, API table, design tokens) see `docs/technical-deep-dive.md`.

## High-Level Flow

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Onboarding │ ──▶ │  Spotify     │ ──▶ │  Nearby      │ ──▶ │  Social &    │
│  (4 slides) │     │  Login       │     │  Feed        │     │  Connections │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

---

## 1. App Launch & Entry (`app/index.tsx`)

```
App opens (fonts load first; the root layout renders nothing until they do)
  │
  ├─ SecureStore `onboarding_complete` not set → /onboarding
  │
  ├─ Stored Spotify tokens exist and aren't expired → /nearby-feed
  │
  └─ Otherwise → login screen → "continue with spotify" → OAuth
```

## 2. Onboarding (`app/onboarding.tsx`)

```
4 slides, each a lead-in plus a statement:
  1. "welcome to" / wavelength
  2. "let us show you" / what's playing around you   (says location is visible on the map)
  3. "say something" / without saying who you are
  4. "you decide" / when to be known

"continue" through the slides, "skip" at any time, "get started" on the last.
All paths → set `onboarding_complete` → /
```

## 3. Authentication

### Mobile (`src/services/spotifyAuth.ts`)

```
"continue with spotify"
  │
  ├─ AuthSession request: authorization code, no PKCE,
  │   redirect wavelength://callback, scopes:
  │   user-read-currently-playing, user-read-playback-state,
  │   user-top-read, user-read-email, user-read-private
  │
  └─ POST /auth/callback { code, redirectUri }
       └─ store { accessToken, refreshToken, expiresAt } in SecureStore
```

### Server (`routes/auth.ts`)

```
POST /auth/callback
  ├─ Exchange code for tokens (client secret)
  ├─ GET Spotify /v1/me → upsert user
  ├─ Background: syncUserTaste      (medium-term top 20 artists + tracks)
  ├─ Background: syncRepeatTracks   (short-term top 50 tracks, for push)
  └─ Return { userId, accessToken, refreshToken, expiresAt }
```

### Token refresh and auth middleware

```
getValidToken(): valid for > 60s? use it : POST /auth/refresh

Every protected request:
  Bearer token → users.encrypted_access_token → req.userId   (else 401)
  Routes only ever act as req.userId, never an ID from the body/query/path.
```

## 4. Location

```
Feed refresh (every 10s)
  ├─ GPSModule.requestPermission()  (not granted → /location-required)
  ├─ GPSModule.getCurrentPosition()
  └─ POST /account/location → users.last_latitude / last_longitude

Background (backgroundLocation.ts, expo-task-manager, 60s / 50m)
  └─ POST /account/location while the app is closed
```

`/location-required` explains that location powers the feed and that nearby
people see where you're listening on the map, then offers "open settings".

> Known issue: the 10s refresh can hit the permission check while the app is
> backgrounded and replace the stack with `/location-required`.

## 5. Presence and Listening Sessions

```
Feed mounts → startPresence()  (src/services/presence.ts)
  │
  ├─ App foregrounded → POST /account/presence now and every 60s
  │     └─ server: users.last_app_seen_at = NOW()
  │               get or create the open session → { anonymousId }
  │               (cached on the client for "is this my comment")
  │
  └─ App backgrounded → heartbeat stops

Session ends (scheduler, every 60s) when ALL of:
  ├─ no playback seen for 5+ min
  ├─ app not seen for 5+ min
  └─ no live play in the session
Next playback or presence → new session → new anonymous ID
```

## 6. Broadcasting: How Music Gets Into the Feed

The **server poller is the only writer**. The app never posts plays.

```
spotifyPoller.ts, every 15s, for every user with a last location:
  │
  ├─ Refresh the Spotify token if expired
  ├─ Repeat tracks older than 24h? → syncRepeatTracks
  │
  ├─ GET /v1/me/player/currently-playing
  │     ├─ 204 or is_playing:false → recordNotPlaying
  │     │     └─ end live play (ended_at = now) → emit broadcast:ended
  │     ├─ other error (401/429/5xx) → change nothing
  │     └─ playing track T → recordPlayback(user, T, last location)
  │
  └─ recordPlayback, in the user's open session (opened if needed):
        ├─ latest play is T and live            → continued (bump last_seen_at)
        ├─ latest play is T, ended < 5 min ago  → resumed  → emit broadcast:new
        └─ otherwise → end other live play, insert new play
                     → started → emit broadcast:new + notifyRepeatListeners
```

### On-repeat push (`services/pushService.ts`)

```
On a started play P by listener L:
  recipients = users with a push token
             AND last location within 500m of P
             AND P.track_id ∈ their user_repeat_tracks
             AND ≠ L
  claim (recipient, L, track) in push_notifications_sent ON CONFLICT DO NOTHING
  → send Expo push only to the rows actually claimed (once per pair+track, ever)
```

## 7. Nearby Feed (`app/nearby-feed.tsx`)

```
Feed mounts
  ├─ Connect socket
  │     ├─ broadcast:new   → insert, or replace by ID (resumed plays come back live)
  │     └─ broadcast:ended → mark isLive:false, endedAt:now
  ├─ loadFeed() now and every 10s:
  │     ├─ location (section 4)
  │     ├─ radius from SecureStore `discovery_radius` (default 100m)
  │     └─ GET /feed/nearby?lat&lng&radius
  ├─ startPresence()  ·  startBackgroundLocation()  ·  registerForPushNotifications()
  │
  └─ Render
        ├─ FeedHeader: newest live play's art, blurred + darkened
        │     "nearby" · "N playing now · M earlier" · people / you · list / map
        ├─ list: SectionList of PLAYING NOW, then EARLIER (empty sections hidden)
        │     └─ BroadcastCard: art, track, artist, live dot / "12m ago",
        │        "· 42% match", 5 reactions, comment / message
        └─ map: FeedMap, dark style, bright pins live / darker pins earlier
```

### Server side

```
GET /feed/nearby
  ├─ Validate lat/lng, clamp radius to [50, 500]
  ├─ Plays within radius (ST_DWithin) that are live, or ended < 6h ago,
  │   excluding the caller's own
  ├─ ORDER BY live first, then started_at desc
  ├─ Per play: tasteScore(caller, listener); strip userId
  └─ { broadcasts: [...], count }   (exact locations; no fuzzing)
```

## 8. Social Interactions

The caller's anonymous ID always comes from their session on the server.
The app never sends one.

### Reactions (`BroadcastCard`)
```
tap 🔥 ❤️ 🎧 👏 😮 → POST /social/reactions { broadcastId, type }
  ├─ unique per (play, session, type)
  ├─ → updated counts
  └─ play expired → 404
```

### Comments (`/comment-thread?broadcastId=X`)
```
GET  /social/comments/:broadcastId
POST /social/comments { broadcastId, text }   (play expired → 404)
Comments belong to the play and are deleted with it 6h after it ends.
```

### Direct messages (`/dm?recipientAnonId=X`)
```
GET  /social/dms/:recipientAnonId
       └─ DMs between ANY of my session IDs and theirs; participants only
POST /social/dms { recipientAnonId, text, includesConnectionRequest }
       └─ recipient not addressable (session ended, no play in the 6h window) → 404
"Mine" in the UI = anything the other side didn't send.
```

With "ask to connect" on, the same call also creates the connection request
(section 9). The footer reads `+ asked to connect`, or `+ already asked` if
one was still pending.

## 9. Connection Lifecycle

```
In a DM: toggle "ask to connect" → send
  POST /social/dms { recipientAnonId, text, includesConnectionRequest: true }
    ├─ resolve recipient (404 if not addressable); yourself → 400
    ├─ create pending request (24h expiry)  → connectionRequest: 'sent'
    │     └─ one already pending            → connectionRequest: 'already_pending'
    └─ save the DM, flagged
  (POST /connections/requests { broadcasterAnonId } does the same without a DM)

/connections ("people") → "requests · N waiting" card (refetched on focus)

/connection-requests
  ├─ incoming: GET /connections/requests/incoming
  │     ├─ yes → POST /connections/requests/:id/accept  → connection created
  │     └─ no  → POST /connections/requests/:id/decline
  ├─ sent: GET /connections/requests/outgoing
  │     └─ cancel → POST /connections/requests/:id/cancel
  └─ not your request → 403 · not pending → 409 · auto-expire after 24h

/connections        GET /connections        → name, image, connected date
/connection-detail  GET /connections/:id    → profile, top artists, top tracks
                                              (profile data is still a placeholder)
remove              DELETE /connections/:id → anonymous again
```

## 10. Profile & Settings (`app/profile.tsx`)

```
"you are" <spotify display name> · email
Discovery radius slider 50–500m → SecureStore `discovery_radius`
"log out" → clear tokens → /
"delete account and all data" → confirm
     ├─ DELETE /account/me  (always the caller's account)
     │     └─ delete DMs from every session ID → delete user (cascades the rest)
     └─ clear tokens + onboarding → /
```

## 11. Scheduled Tasks (`scheduler.ts`)

```
every 30s  endStalePlays        live, not seen for 60s → ended at last_seen_at
every 30s  expireOldPlays       ended > 6h ago → deleted (+ reactions, comments)
every 60s  expireStaleRequests  pending > 24h → expired
every 60s  endIdleSessions      section 5 rule
```

## 12. Privacy & Cleanup

```
Anonymity       a session's random ID, assigned by the server; userId is never sent
Location        exact (decision 2026-10-21); deleted with the play 6h after it ends
Socket close    forgets the subscription only; plays outlive sockets
Account delete  DMs for all session IDs, then the user row (cascade)
```

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          MOBILE APP                              │
│  Spotify Auth · GPS · Background Location · Presence · Socket    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              API client (api.ts, Bearer token)             │  │
│  └─────────────────────────────┬──────────────────────────────┘  │
└────────────────────────────────┼─────────────────────────────────┘
                     HTTP + WebSocket (Socket.IO)
┌────────────────────────────────┼─────────────────────────────────┐
│                           SERVER                                 │
│  Routes:   auth · feed · social · connections · account          │
│  Services: sessionService · broadcastService · spotifyPoller     │
│            pushService · tasteService · socialService            │
│            connectionService · privacyService · feedSocket       │
│                               │                                  │
│                  PostgreSQL + PostGIS                            │
│                                                                  │
│  Spotify poller   every 15s, all users → plays                   │
│  Scheduler        stale plays · 6h expiry · requests · sessions  │
└──────────────────────────────────────────────────────────────────┘
          Spotify Web API  ◀── poller, auth, taste/repeat sync
          Expo Push API    ◀── on-repeat notifications
```

## Screen Navigation Map

```
/onboarding ──▶ / (login)
                  │
                  ▼
            /nearby-feed ◀────────────────────────┐
              │   │   │                            │
              │   │   ├──▶ /comment-thread?broadcastId=X
              │   │   ├──▶ /dm?recipientAnonId=X   │
              │   │   └──▶ /profile ("you") ───────┘
              │   │          ├─ log out → /
              │   │          └─ delete account → /
              │   │
              │   └──▶ /connections ("people")
              │          ├──▶ /connection-requests  ("requests" card)
              │          └──▶ /connection-detail?connectionId=X
              │
              └──▶ /location-required  (permission not granted)
```
