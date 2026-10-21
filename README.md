# Wavelength

A proximity-based music discovery app. See what people around you are listening to on Spotify, right now or in the last few hours, anonymously, and connect with the ones whose taste you like.

## How It Works

1. Link your Spotify account. The server polls what you're playing, so the app doesn't need to be open.
2. Each track you play appears to nearby users under an anonymous ID that lasts for your listening session.
3. Browse what's playing nearby (100m by default, up to 500m): live plays first, then everything from the last 6 hours.
4. React, comment, or DM anonymous listeners.
5. Send a connection request. If it's accepted, you both see each other's Spotify profiles.
6. Get a push notification when someone nearby plays a song you've had on repeat.

## Tech Stack

- **Mobile**: React Native + Expo (native iOS dev build), Expo Router, NativeWind
- **Backend**: Node.js / Express (TypeScript)
- **Database**: PostgreSQL + PostGIS (spatial queries)
- **Real-time**: Socket.IO (WebSockets)
- **Auth**: Spotify OAuth 2.0 authorization code flow (code exchanged server-side)
- **Push**: Expo push notifications
- **Testing**: Vitest + fast-check (server), Jest (mobile)

Redis is in `docker-compose.yml` but is currently unused.

## Key Features

- **Anonymous listening sessions**: your song is visible, your identity isn't
- **Live + recent feed**: what's playing now, then the last 6 hours nearby
- **Reactions, comments, DMs**: engage before revealing who you are
- **Connection requests**: mutual opt-in identity reveal
- **On-repeat push**: hear when someone nearby plays one of your songs
- **Short-lived data**: plays and their exact locations are deleted 6h after they end, and account deletion removes everything

## Project Structure

```
mobile/    — React Native app
server/    — Express API + WebSocket server
docs/      — product overview, technical deep dive, workflow, design reference, specs
```

## Getting Started

```bash
# Install dependencies
cd mobile && npm install
cd ../server && npm install

# Set up environment variables
cp server/.env.example server/.env
cp mobile/.env.example mobile/.env
# Add your Spotify client ID (both files) and client secret (server)

# Run database migrations
cd server && npm run migrate

# Start the backend
cd server && npm run dev

# Build and run the iOS app on a simulator (native dev build, not Expo Go)
cd mobile && npx expo run:ios

# Validate Docker config, server build/tests, and mobile tests
node scripts/check-local-setup.mjs
```

## Testing

```bash
# Unit + route tests (no external dependencies — everything is mocked)
cd server && npm test

# PostGIS integration tests (needs a live database)
docker compose up -d postgres
cd server && DB_HOST=localhost DB_PASSWORD=postgres npm run test:integration

# Mobile tests
cd mobile && npm test && npm run check:types
```

CI runs all four suites plus `docker compose config` on every push to `main` and
every pull request — see `.github/workflows/ci.yml`.

## Docs

- [`docs/product-overview.md`](docs/product-overview.md): what it is, decisions, status, gaps, roadmap
- [`docs/technical-deep-dive.md`](docs/technical-deep-dive.md): architecture, schema, API, design system
- [`docs/workflow.md`](docs/workflow.md): step-by-step flows through the app and server
- [`docs/design/222-reference.md`](docs/design/222-reference.md): visual direction
- [`docs/specs/`](docs/specs/): design records for each major change

## Environment Variables

**Server (`server/.env`)**

| Variable | Description |
|---|---|
| `SPOTIFY_CLIENT_ID` | Spotify app client ID (required) |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret (required) |
| `DB_HOST` | PostgreSQL host (required) |
| `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | PostgreSQL connection (defaults: 5432 / music_vicinity / postgres / empty) |
| `PORT` | API port (default 3000) |
| `CORS_ORIGIN` | Allowed origin (default `*`) |

**Mobile (`mobile/.env`)**

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend URL (e.g. `http://localhost:3000` for the simulator) |
| `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` | Spotify app client ID |

The Spotify app needs redirect URI `wavelength://callback`.

## License

MIT
