# Wavelength

A proximity-based music discovery and social connection app. See what people around you are listening to on Spotify — anonymously — and connect with those who share your taste.

## How It Works

1. Link your Spotify account
2. Your currently playing track is broadcast anonymously to nearby users
3. Browse a live feed of songs playing within your vicinity (~100m default, configurable up to 500m)
4. React, comment, or DM anonymous listeners
5. Send a connection request — if accepted, both users reveal their Spotify profiles

## Tech Stack

- **Mobile**: React Native (TypeScript)
- **Backend**: Node.js / Express (TypeScript)
- **Database**: PostgreSQL + PostGIS (spatial queries)
- **Cache / Pub-Sub**: Redis
- **Real-time**: Socket.IO (WebSockets)
- **Auth**: Spotify OAuth 2.0 PKCE
- **Testing**: Vitest + fast-check (property-based testing)

## Key Features

- **Anonymous broadcasting** — your song is visible, your identity isn't
- **GPS-based proximity feed** — discover music in cafes, gyms, anywhere
- **Reactions, comments, DMs** — engage before revealing who you are
- **Connection requests** — mutual opt-in identity reveal
- **Spotify profile sharing** — view top artists, tracks, and profile links after connecting
- **Privacy-first** — location data is session-scoped, account deletion cascades all data

## Project Structure

```
mobile/    — React Native app
server/    — Express API + WebSocket server
```

## Getting Started

```bash
# Install dependencies
cd mobile && npm install
cd ../server && npm install

# Set up environment variables
cp server/.env.example server/.env
# Add your Spotify Client ID and database credentials

# Run database migrations
cd server && npm run migrate

# Start the backend
cd server && npm run dev

# Start the mobile app
cd mobile && npm start
```

## Environment Variables

| Variable | Description |
|---|---|
| `SPOTIFY_CLIENT_ID` | Spotify app client ID |
| `DATABASE_URL` | PostgreSQL connection string (with PostGIS) |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for signing auth tokens |

## License

MIT
