# Wavelength — Technical Deep Dive

## Architecture Overview

Wavelength is a proximity-based music discovery app. Users who have linked their Spotify accounts automatically broadcast what they're listening to, and other users nearby can see those broadcasts in a live feed.

The system has two main layers:
- **Mobile client** (React Native / Expo) — handles auth, GPS, and feed display
- **Backend server** (Node.js / Express) — handles Spotify polling, broadcast management, and real-time updates

## Core Flow

```
User signs up → Links Spotify → Server stores tokens
                                      ↓
                Server polls Spotify every 15s for all users
                                      ↓
              User playing music? → Create/update broadcast with last known location
              Not playing?        → Remove broadcast
                                      ↓
              Other users nearby see the broadcast in their feed
```

## Authentication

1. Mobile app initiates Spotify OAuth (authorization code flow, no PKCE)
2. User authorizes on Spotify's login page
3. Mobile app receives auth code, sends it to `POST /auth/callback` on the server
4. Server exchanges code for access + refresh tokens via Spotify's token endpoint
5. Server fetches Spotify user profile (`/v1/me`) to get the Spotify user ID
6. Server upserts the user in the `users` table with encrypted tokens
7. Server returns the access token to the mobile app for subsequent API calls

The server's auth middleware (`authMiddleware`) validates requests by matching the Bearer token against stored `encrypted_access_token` values in the database.

## Server-Side Spotify Polling

This is the key architectural decision that makes Wavelength work without requiring users to have the app open.

**How it works:**
- `spotifyPoller.ts` runs on the server, polling every 15 seconds
- It queries all registered users from the database
- For each user with a last known location, it calls Spotify's `/v1/me/player/currently-playing`
- If the user is playing a track, it creates/updates a broadcast in the `broadcasts` table
- If the user stopped playing, it removes their broadcast
- Token refresh is handled automatically when tokens expire

**Why server-side polling?**
- Users don't need the app open to broadcast
- Once a user has signed up and granted Spotify access, their music shows up automatically
- The only requirement is a last known location (updated whenever the app is opened)

## Location Handling

Location is a two-part system:

1. **Real-time GPS** — When the app is open, it polls GPS and sends location to `POST /account/location`, updating `last_latitude`, `last_longitude`, and `last_location_at` on the user record
2. **Last known location** — When the app is closed, the server uses the last stored location for broadcasts

This means a user who was at a coffee shop and closed the app will still show up at that coffee shop as long as they're playing music on Spotify.

## Database Schema (PostGIS)

Key tables:
- `users` — Spotify credentials, last known location
- `broadcasts` — Active music broadcasts with PostGIS geography points
- `reactions` — Emoji reactions on broadcasts
- `comments` — Text comments on broadcasts
- `direct_messages` — Anonymous DMs between users
- `connection_requests` — Pending mutual connection requests
- `connections` — Accepted connections (identity revealed)
- `user_settings` — Per-user vicinity radius (50m–500m)

Spatial queries use PostGIS `ST_DWithin` for radius-based broadcast filtering, with a GIST index on the `location` column.

## Real-Time Updates (Socket.IO)

The feed uses a hybrid approach:
- **HTTP polling** — Mobile app fetches `/feed/nearby` every 10 seconds
- **WebSocket push** — Server emits `broadcast:new` and `broadcast:removed` events to connected clients within range

The `feedSocket.ts` service maintains a map of connected clients with their last known location and radius. When a new broadcast is created, it checks which connected clients are within range and pushes the update.

## Privacy Model

- Broadcasts are anonymous — each broadcast gets a random UUID as `anonymous_id`
- GPS coordinates are only stored on active broadcasts and as last known location
- When a broadcast is removed, its location data is deleted
- Session cleanup (`privacyService.ts`) removes broadcast data on disconnect
- Account deletion cascades to all user data (broadcasts, DMs, connections, etc.)

## Mobile App Structure

```
mobile/
├── app/                    # Expo Router screens
│   ├── index.tsx           # Login screen
│   ├── nearby-feed.tsx     # Main feed (broadcasts nearby)
│   ├── comment-thread.tsx  # Comments on a broadcast
│   ├── dm.tsx              # Direct messaging
│   ├── connections.tsx     # Connections list
│   ├── connection-detail.tsx
│   ├── connection-requests.tsx
│   ├── location-required.tsx
│   └── _layout.tsx         # Root layout (Stack navigator)
├── src/
│   ├── components/         # Reusable UI components
│   ├── config/spotify.ts   # Spotify OAuth config
│   └── services/           # API client, auth, GPS, polling, sockets
```

## Server Structure

```
server/
├── src/
│   ├── db/
│   │   ├── connection.ts       # PostgreSQL pool
│   │   ├── migrate.ts          # Migration runner
│   │   └── migrations/         # SQL migration files
│   ├── middleware/
│   │   ├── auth.ts             # Bearer token validation
│   │   └── errorHandler.ts
│   ├── routes/
│   │   ├── auth.ts             # Spotify OAuth callback + refresh
│   │   ├── feed.ts             # Nearby feed endpoint
│   │   ├── broadcast.ts        # Create/remove broadcasts
│   │   ├── social.ts           # Reactions, comments, DMs
│   │   ├── connections.ts      # Connection requests + management
│   │   └── account.ts          # Location updates + account deletion
│   ├── services/
│   │   ├── broadcastService.ts # Broadcast CRUD + spatial queries
│   │   ├── spotifyPoller.ts    # Server-side Spotify polling
│   │   ├── feedSocket.ts       # WebSocket real-time updates
│   │   ├── privacyService.ts   # Session cleanup + account deletion
│   │   └── proximityService.ts # Radius validation
│   ├── scheduler.ts            # Periodic cleanup tasks
│   └── index.ts                # Express app entry point
```

## Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL with PostGIS extension
- Docker (for database via docker-compose)
- Spotify Developer account with app configured

### Spotify Dashboard Config
- Redirect URI: `exp://<your-ip>:8081/--/callback` (for Expo Go development)
- Required scopes: `user-read-currently-playing`, `user-read-playback-state`, `user-top-read`, `user-read-email`, `user-read-private`
- Users must be whitelisted in development mode (up to 25)

### Running Locally
```bash
# Start database
docker-compose up -d

# Start server
cd server && npm run dev

# Start mobile app
cd mobile && npx expo start
```

### Environment Variables

**Server (`server/.env`):**
| Variable | Description |
|---|---|
| `SPOTIFY_CLIENT_ID` | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret |
| `DB_HOST` | PostgreSQL host |
| `DB_PORT` | PostgreSQL port |
| `DB_NAME` | Database name |
| `DB_USER` | Database user |
| `DB_PASSWORD` | Database password |
| `REDIS_URL` | Redis connection string |
| `PORT` | Server port (default 3000) |
| `CORS_ORIGIN` | Allowed CORS origin |

**Mobile (`mobile/.env`):**
| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend server URL |
| `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` | Spotify app client ID |

## Location Privacy — Coordinate Fuzzing

Broadcast locations are never exposed at exact GPS coordinates. The server applies a random offset of 100–200m in a random direction before returning feed data to clients. This is done in the `/feed/nearby` route using a Haversine-based offset calculation.

This means:
- The map view shows the general area where someone is listening, not their exact position
- Each feed request generates a new random offset, so the pin shifts slightly each time
- The raw GPS data is only stored server-side and never sent to other clients at full precision

Combined with anonymous broadcast IDs, there is no way for a feed viewer to determine who is listening or exactly where they are.

## Onboarding Flow

First-time users see a 4-slide onboarding sequence before reaching the login screen:

1. **Welcome** — introduces Wavelength and its purpose
2. **Location-Based Discovery** — explains proximity-based feed and location fuzzing
3. **Anonymous Connections** — describes the anonymous interaction model
4. **Privacy** — explains data handling and account deletion

Onboarding completion is stored in `expo-secure-store` under the key `onboarding_complete`. The index screen checks this value on mount and redirects to onboarding if not set. Users can skip onboarding at any time.

## Profile Screen

The profile screen (`/profile`) provides:
- Display of the user's Spotify display name and email (fetched from Spotify's `/v1/me` endpoint)
- Navigation back to the feed
- Logout — clears stored tokens and returns to login
- Account deletion — prompts for confirmation, then calls `DELETE /account/me` on the server (cascades all user data), clears local tokens and onboarding state

## Map View

The feed supports two view modes toggled via List/Map buttons:

- **List view** — the default, showing broadcast cards in a scrollable list
- **Map view** — renders a `react-native-maps` MapView centered on the user's current location, with green pins for each nearby broadcast

Tapping a map pin opens a callout showing the album art, track title, and artist name. Pins use the fuzzed coordinates from the server, so they represent the general area rather than exact positions.

The map region is initialized from the user's current GPS position with a tight zoom level (~500m visible area) to match the app's proximity focus.

## Feed Navigation

The feed screen nav bar includes:
- **List / Map toggle** — switches between feed views, with active state highlighted in green
- **Connections** — navigates to the connections list
- **Profile (👤)** — navigates to the profile screen


## Dark Mode

The entire app uses a dark theme with a consistent color palette:

- Background: `#121212` (screens, headers, nav)
- Card/surface: `#1e1e1e` (broadcast cards, chat bubbles, list items)
- Elevated surface: `#2a2a2a` (buttons, inputs, reaction pills)
- Primary text: `#fff`
- Secondary text: `#aaa` / `#ccc`
- Muted text: `#666`
- Accent: `#1DB954` (Spotify green — buttons, active states, badges)
- Destructive: `#d32f2f` (delete/remove actions)

The Stack navigator in `_layout.tsx` applies dark header styling globally via `screenOptions`. All screens, components, inputs, and chat bubbles follow this palette.

## Discovery Radius Setting

Users can adjust their discovery radius (50m–500m) from the profile screen using a slider (`@react-native-community/slider`). The value is persisted in `expo-secure-store` under the key `discovery_radius` and read by the feed screen on each load. The server validates and clamps the radius in `proximityService.ts`.

## Background Location

`backgroundLocation.ts` uses `expo-task-manager` and `expo-location` to keep the user's location updated even when the app is not in the foreground.

- Registers a background task (`wavelength-background-location`) that fires on location changes
- Configured with `Accuracy.Balanced`, 60-second interval, 50m distance threshold
- Each update POSTs the new coordinates to `POST /account/location`
- On Android, shows a persistent foreground service notification
- On iOS, uses the background location indicator

This ensures the server-side Spotify poller always has a reasonably fresh location for creating broadcasts, even if the user hasn't opened the app recently.

## Push Notifications

Push notifications alert users when someone nearby starts playing music.

**Mobile side (`pushNotifications.ts`):**
- Requests notification permissions on first feed load
- Registers an Expo push token via `Notifications.getExpoPushTokenAsync()`
- Sends the token to `POST /account/push-token` for server storage
- Configures the notification handler to show alerts with sound

**Server side (`pushService.ts`):**
- When a new broadcast is created (`POST /broadcasts`), the server queries all users within 500m who have a push token stored
- Uses PostGIS `ST_DWithin` against each user's `last_latitude`/`last_longitude`
- Sends notifications via the Expo Push API (`https://exp.host/--/api/v2/push/send`) in batches of 100
- Notification includes the track title and artist name

**Database:**
- Migration `002_push_tokens.sql` adds a `push_token TEXT` column to the `users` table

## Music Taste Matching

Wavelength computes a taste similarity score between users based on their Spotify listening history.

**Data collection (`tasteService.ts` — `syncUserTaste`):**
- On login, the server fetches the user's top 20 artists and top 20 tracks from Spotify's `/v1/me/top/artists` and `/v1/me/top/tracks` (medium-term range)
- Stored in `user_top_artists` and `user_top_tracks` tables with rank ordering

**Score computation (`tasteService.ts` — `getTasteScore`):**
- Compares two users' top artists and tracks using case-insensitive matching
- Shared artists: 3 points each (max 60)
- Shared tracks: 2 points each (max 40)
- Total score: 0–100

**Feed integration:**
- The `/feed/nearby` route computes a taste score between the requesting user and each broadcaster
- The score is returned as `tasteScore` in the feed response
- The `BroadcastCard` component displays a green badge (e.g., "42% match") when the score is above 0

**Database:**
- Migration `003_music_taste.sql` creates `user_top_artists` and `user_top_tracks` tables
