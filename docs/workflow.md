# Wavelength — Application Workflow

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
App opens
  │
  ├─ Check SecureStore for `onboarding_complete`
  │   └─ NOT set → redirect to /onboarding
  │
  ├─ Check SecureStore for stored Spotify tokens
  │   ├─ Tokens exist AND not expired → redirect to /nearby-feed
  │   └─ No tokens or expired → show Login screen
  │
  └─ User taps "Log in with Spotify" → triggers OAuth flow
```

## 2. Onboarding (`app/onboarding.tsx`)

```
4-slide carousel:
  1. Welcome to Wavelength
  2. Location-Based Discovery (explains GPS fuzzing)
  3. Anonymous Connections
  4. Privacy & Data Handling

User can:
  - Tap "Next" through slides
  - Tap "Skip" at any time
  - Tap "Get Started" on final slide

All paths → set `onboarding_complete` in SecureStore → redirect to /
```

## 3. Authentication Flow

### Mobile Side (`src/services/spotifyAuth.ts`)

```
User taps Login
  │
  ├─ Create AuthSession.AuthRequest with Spotify scopes:
  │     user-read-currently-playing, user-read-playback-state,
  │     user-top-read, user-read-email, user-read-private
  │
  ├─ Open Spotify OAuth page (authorization code flow, no PKCE)
  │
  ├─ User authorizes → receive auth code
  │
  └─ POST /auth/callback { code, redirectUri }
       │
       └─ Receive { accessToken, refreshToken, expiresAt }
            │
            └─ Store all three in expo-secure-store
```

### Server Side (`routes/auth.ts`)

```
POST /auth/callback
  │
  ├─ Exchange auth code for tokens at Spotify's token endpoint
  │
  ├─ Fetch user profile from Spotify /v1/me → get spotifyUserId
  │
  ├─ Upsert user in `users` table (spotify_user_id, tokens, expiry)
  │
  ├─ Kick off background taste sync (syncUserTaste)
  │     └─ Fetches top 20 artists + top 20 tracks from Spotify
  │     └─ Stores in user_top_artists / user_top_tracks tables
  │
  └─ Return { userId, accessToken, refreshToken, expiresAt }
```

### Token Refresh

```
SpotifyAuthModule.getValidToken()
  │
  ├─ Token still valid (>60s remaining)? → return it
  │
  └─ Expired → POST /auth/refresh { refreshToken }
       │
       ├─ Server refreshes with Spotify, updates DB
       └─ Returns new { accessToken, expiresAt }
```

### Auth Middleware (`middleware/auth.ts`)

```
Every protected request:
  │
  ├─ Extract Bearer token from Authorization header
  ├─ Look up token in `users.encrypted_access_token`
  ├─ Found → attach req.userId, continue
  └─ Not found → 401 Unauthorized
```

## 4. Location System

### Foreground GPS (`src/services/gps.ts`)

```
Feed screen loads → GPSModule.requestPermission()
  │
  ├─ Granted → GPSModule.getCurrentPosition()
  │     └─ Returns { latitude, longitude, accuracy, timestamp }
  │
  └─ Denied → redirect to /location-required
```

### Background Location (`src/services/backgroundLocation.ts`)

```
On feed load → startBackgroundLocation()
  │
  ├─ Request foreground + background permissions
  │
  └─ Register expo-task-manager task: "wavelength-background-location"
       │
       ├─ Fires on location change (60s interval, 50m distance)
       ├─ POSTs new coords to POST /account/location
       └─ Server updates users.last_latitude / last_longitude
```

### Location Required Screen (`app/location-required.tsx`)

```
Shown when GPS permission is denied.
  └─ "Open Settings" button → links to device settings
```

## 5. Nearby Feed (`app/nearby-feed.tsx`)

This is the main screen. It ties together multiple systems:

```
Feed screen mounts
  │
  ├─ 1. Request GPS permission (→ /location-required if denied)
  │
  ├─ 2. Get current position
  │
  ├─ 3. Read discovery radius from SecureStore (default: 100m)
  │
  ├─ 4. POST /account/location { lat, lng } → update server-side location
  │
  ├─ 5. GET /feed/nearby?lat=X&lng=Y&radius=Z → fetch broadcasts
  │
  ├─ 6. Connect Socket.IO → listen for real-time updates
  │     ├─ Send location:update event
  │     ├─ On broadcast:new → add to list (if not duplicate)
  │     └─ On broadcast:removed → remove from list
  │
  ├─ 7. Start client-side Spotify poller (every 10s)
  │     └─ Checks currently playing → POST/DELETE /broadcasts
  │
  ├─ 8. Start background location tracking
  │
  ├─ 9. Register for push notifications
  │
  └─ 10. Set up HTTP poll interval (every 10s) to refresh feed
```

### Feed Data Flow (Server Side)

```
GET /feed/nearby
  │
  ├─ Validate lat/lng, clamp radius to [50, 500]
  │
  ├─ Query broadcasts within radius using PostGIS ST_DWithin
  │     └─ Excludes requesting user's own broadcast
  │
  ├─ For each broadcast:
  │     ├─ Compute tasteScore between requester and broadcaster
  │     ├─ Fuzz location by 100-200m random offset (privacy)
  │     └─ Strip userId from response (anonymity)
  │
  └─ Return { broadcasts: [...], count }
```

### Feed View Modes

```
Nav bar: [List] [Map] [Connections] [👤]
  │
  ├─ List view (default)
  │     └─ FlatList of BroadcastCard components
  │
  └─ Map view
        └─ react-native-maps MapView with green pins
             └─ Callout shows album art, track, artist
```

## 6. Broadcasting (How Music Gets Into the Feed)

There are TWO parallel broadcast mechanisms:

### Client-Side Poller (`src/services/spotifyPoller.ts`)

```
Runs when app is open (every 10s):
  │
  ├─ Fetch Spotify /v1/me/player/currently-playing
  │
  ├─ Playing? → Get GPS position → POST /broadcasts { track, location }
  │
  └─ Not playing? → DELETE /broadcasts (remove own broadcast)
```

### Server-Side Poller (`server/services/spotifyPoller.ts`)

```
Runs continuously on server (every 15s):
  │
  ├─ Query ALL users from DB
  │
  ├─ For each user with a last known location:
  │     ├─ Refresh Spotify token if expired
  │     ├─ Fetch currently playing from Spotify API
  │     ├─ Playing → createBroadcast(userId, track, lastKnownLocation)
  │     └─ Not playing → removeBroadcast(userId)
  │
  └─ This means users broadcast even when the app is closed,
     as long as they have a stored location and are playing music
```

### Broadcast Creation (`services/broadcastService.ts`)

```
createBroadcast(userId, track, location)
  │
  ├─ Remove any existing broadcast for this user (upsert)
  ├─ Generate random UUID as anonymous_id
  ├─ Insert into broadcasts table with PostGIS geography point
  └─ Return broadcast object (no userId exposed)
```

### Real-Time Broadcast Push (`services/feedSocket.ts`)

```
When a broadcast is created:
  │
  ├─ emitBroadcastNew(io, broadcast)
  │     └─ For each connected Socket.IO client:
  │           ├─ Check if client location is within range (Haversine)
  │           ├─ Skip if it's the broadcaster's own socket
  │           └─ Emit 'broadcast:new' to qualifying clients
  │
  └─ sendPushToNearbyUsers(...)
        └─ Query users within 500m with push tokens
        └─ Send Expo push notifications in batches of 100
```

## 7. Social Interactions

### Reactions (`BroadcastCard` → `POST /social/reactions`)

```
User taps emoji on a BroadcastCard
  │
  ├─ 5 types: 🔥 fire, ❤️ heart, 🎧 headphones, 👏 clap, 😮 surprised
  │
  ├─ POST /social/reactions { broadcastId, viewerAnonId, type }
  │     └─ Upsert (unique per viewer+type via DB constraint)
  │
  └─ Returns updated reaction counts → displayed on card
```

### Comments (`app/comment-thread.tsx` → `CommentThread` component)

```
User taps "💬 Comments" on a BroadcastCard
  │
  ├─ Navigate to /comment-thread?broadcastId=X
  │
  ├─ GET /social/comments/:broadcastId → load existing comments
  │
  └─ POST /social/comments { broadcastId, authorAnonId, text }
       └─ Comment stored with anonymous author ID
```

### Direct Messages (`app/dm.tsx` → `DMScreen` component)

```
User taps "✉️ Message" on a BroadcastCard
  │
  ├─ Navigate to /dm?recipientAnonId=X
  │
  ├─ GET /social/dms/:participantA/:participantB → load thread
  │
  └─ POST /social/dms { senderAnonId, recipientAnonId, text, includesConnectionRequest }
       └─ Messages stored with anonymous IDs (identity hidden)
```

## 8. Connection Lifecycle

### Sending a Request

```
User wants to connect with an anonymous broadcaster
  │
  ├─ POST /connections/requests { viewerUserId, broadcasterAnonId }
  │
  └─ Creates pending request with 24h expiry
```

### Receiving & Managing Requests (`app/connection-requests.tsx`)

```
GET /connections/requests/incoming/:userId → list pending requests
  │
  ├─ Accept → POST /connections/requests/:id/accept
  │     ├─ Creates Connection record linking both users
  │     ├─ Fetches Spotify profiles for both users
  │     └─ Both users can now see each other's identity
  │
  ├─ Decline → POST /connections/requests/:id/decline
  │
  └─ Requests auto-expire after 24h (server scheduler)
```

### Connections List (`app/connections.tsx`)

```
GET /connections?userId=X
  │
  └─ Returns list of connected users with:
       ├─ displayName (from Spotify)
       ├─ profileImageUrl
       └─ createdAt
```

### Connection Detail (`app/connection-detail.tsx`)

```
GET /connections/:id?userId=X
  │
  └─ Returns full Spotify profile:
       ├─ displayName, profileImageUrl, profileLink
       ├─ topArtists
       └─ topTracks
```

### Removing a Connection

```
DELETE /connections/:id?userId=X
  │
  └─ Deletes connection record
       └─ Future interactions return to anonymous
```

## 9. Music Taste Matching

```
On login → syncUserTaste(userId, accessToken)
  │
  ├─ Fetch top 20 artists from Spotify /v1/me/top/artists
  ├─ Fetch top 20 tracks from Spotify /v1/me/top/tracks
  └─ Store in user_top_artists / user_top_tracks tables

On feed load → getTasteScore(userA, userB)
  │
  ├─ Count shared artists (case-insensitive) → 3 pts each (max 60)
  ├─ Count shared tracks (case-insensitive) → 2 pts each (max 40)
  └─ Total score: 0–100, displayed as "X% match" badge on BroadcastCard
```

## 10. Profile & Settings (`app/profile.tsx`)

```
Profile screen:
  │
  ├─ Fetches Spotify /v1/me → display name + email
  │
  ├─ Discovery Radius slider (50m–500m, stored in SecureStore)
  │     └─ Read by feed screen on each load
  │
  ├─ "Log Out" → clear tokens from SecureStore → redirect to /
  │
  └─ "Delete Account" → confirmation dialog
       ├─ DELETE /account/:userId on server
       │     └─ Cascades: broadcasts, reactions, comments, DMs,
       │        connection_requests, connections, user_settings
       ├─ Clear local tokens + onboarding state
       └─ Redirect to /
```

## 11. Server Scheduled Tasks (`scheduler.ts`)

```
On server boot:
  │
  ├─ Every 30s → expireStaleBroadcasts()
  │     └─ Delete broadcasts older than 30s (user stopped playing)
  │
  └─ Every 60s → expireStaleRequests()
        └─ Mark pending connection requests as 'expired' if >24h old
```

## 12. Privacy & Cleanup

```
Socket disconnect → cleanupSessionData(userId)
  └─ Delete user's broadcast (removes location data)

Account deletion → deleteAccount(userId)
  ├─ Collect anonymous IDs from user's broadcasts
  ├─ Delete DMs referencing those anonymous IDs
  └─ Delete user row (cascades everything else)

Location fuzzing (on every feed response):
  └─ Add random 100-200m offset in random direction
     └─ Prevents pinpointing exact user location
```

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        MOBILE APP                               │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Spotify  │  │   GPS    │  │  Feed    │  │  Background   │  │
│  │ Auth     │  │  Module  │  │  Socket  │  │  Location     │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │             │                 │          │
│       │         ┌────┴─────┐      │                 │          │
│       │         │ Spotify  │      │                 │          │
│       │         │ Poller   │      │                 │          │
│       │         └────┬─────┘      │                 │          │
│       │              │             │                 │          │
│  ┌────┴──────────────┴─────────────┴─────────────────┴───────┐ │
│  │                    API Client (api.ts)                     │ │
│  │              authFetch() — injects Bearer token            │ │
│  └────────────────────────────┬───────────────────────────────┘ │
└───────────────────────────────┼─────────────────────────────────┘
                                │
                    HTTP + WebSocket (Socket.IO)
                                │
┌───────────────────────────────┼─────────────────────────────────┐
│                        SERVER                                    │
│                                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌───────────┐ │
│  │  Auth    │  │  Feed        │  │  Social    │  │ Broadcast │ │
│  │  Routes  │  │  Routes      │  │  Routes    │  │ Routes    │ │
│  └────┬─────┘  └──────┬───────┘  └─────┬──────┘  └─────┬─────┘ │
│       │               │                │                │       │
│  ┌────┴───────────────┴────────────────┴────────────────┴────┐  │
│  │                     Services Layer                         │  │
│  │  broadcastService │ socialService │ connectionService     │  │
│  │  tasteService     │ privacyService│ proximityService      │  │
│  │  spotifyPoller    │ feedSocket    │ pushService            │  │
│  └────────────────────────┬──────────────────────────────────┘  │
│                           │                                      │
│              ┌────────────┴────────────┐                        │
│              │    PostgreSQL + PostGIS  │                        │
│              │    Redis (cache/pubsub) │                        │
│              └─────────────────────────┘                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Scheduler: expire broadcasts (30s) + requests (60s)     │   │
│  │  Spotify Poller: poll all users every 15s                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Screen Navigation Map

```
/onboarding ──▶ / (login)
                  │
                  ▼
            /nearby-feed ◀──────────────────────┐
              │   │   │                          │
              │   │   ├──▶ /comment-thread       │
              │   │   │      ?broadcastId=X      │
              │   │   │                          │
              │   │   ├──▶ /dm                   │
              │   │   │      ?recipientAnonId=X  │
              │   │   │                          │
              │   │   └──▶ /profile ─────────────┘
              │   │          ├─ Logout → /
              │   │          └─ Delete Account → /
              │   │
              │   └──▶ /connections
              │          │
              │          └──▶ /connection-detail
              │                 ?connectionId=X
              │
              └──▶ /location-required
                     (if GPS denied)
```
