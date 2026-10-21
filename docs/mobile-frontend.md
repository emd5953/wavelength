# Wavelength mobile frontend

The mobile app uses an ink, warm-paper, coral, and icy-blue palette. The waveform is a decorative brand motif, not an audio visualization. Shared primitives and motion live in `mobile/src/design`, with discovery identity, distance, ordering, and marker grouping in `mobile/src/utils/discovery.ts`.

## Running

From `mobile`, run `npm start` and open the app in Expo Go on the existing iPhone simulator. The dependencies are aligned to Expo SDK 54, including Reanimated 4.1 and Worklets 0.5.1. Normal startup preserves Spotify authentication and the onboarding preference.

### Isolated design preview

Preview is **off by default** and cannot run in a production bundle. To inspect populated screens without authentication:

```sh
EXPO_PUBLIC_DEMO_MODE=true npm start -- --port 8082
```

Open `exp://127.0.0.1:8082/--/nearby-feed` in the simulator. A persistent banner identifies sample data. Fixtures are in `mobile/src/dev/demo.ts`. No preview API mutation fetches credentials or reaches the backend. Preview radius preferences use a separate storage key; preview onboarding does not change the real onboarding preference. Album thumbnails in fixtures are supplied by Apple's public catalog.

Preview-only routes for state inspection:

- `/nearby-feed?previewState=empty`
- `/nearby-feed?previewState=offline`
- `/onboarding`
- `/connection-requests`
- `/connections`
- `/connection-detail?connectionId=demo-connection`
- `/dm?recipientAnonId=demo-listener-a3f901`
- `/comment-thread?broadcastId=demo-play-1`
- `/profile`
- `/location-required`

Restart without `EXPO_PUBLIC_DEMO_MODE` to return to real data. The `previewState` query has no effect outside preview mode. Mutation attempts in preview report that they are unavailable; they never fabricate a successful reaction, message, request, acceptance, or deletion.

## Behavior and contracts

- Feed rows and React keys identify **plays**. Separate listeners playing the same song remain separate. Live plays precede recent plays.
- Reactions and comments use `broadcast.id`; messages and connection requests use `broadcast.anonymousId`. Conversations retain the server's existing session semantics.
- Socket events trigger an authoritative feed refresh instead of inserting potentially incomplete socket payloads. The HTTP feed preserves self-exclusion and taste scores.
- Map pins group nearby plays using a zoom-aware distance (at least 18 metres) for selection without altering exact coordinates. Selecting a stack exposes every play separately. Locations missing from a play are never fabricated.
- Radius is saved between 50 and 500 metres. Invalid stored values fall back to 100 metres.
- Mutations show pending and explicit failure feedback. Message/comment drafts survive failures. Account deletion logs out only after the server confirms deletion.
- Transient refresh failures retain Spotify credentials. A rejected session has an explicit sign-in route that bypasses automatic session restoration.
- Reduce Motion disables decorative loops, entrance/layout movement, and map camera animation. Track sheets have spring entrance, a drag handle, accessible close controls, and scrollable content.

## Existing backend boundaries

- There is no conversation-list endpoint. Anonymous messages are opened from a listener's track rather than an invented inbox. Incoming/outgoing connection requests have their own screen.
- Request listings do not expose the other participant's anonymous session identifier or a linked connection ID. They use a generic anonymous label; accepted profiles are available in Connections. The accept response supplies the new connection ID for the reveal transition.
- Profile photos, links, top artists, and top tracks may be missing. The UI uses an abstract avatar and explicit unavailable states.
- Exact coordinates are visible to nearby listeners. Onboarding, permission recovery, maps, and settings all explain this.
- Background location and push notifications retain the existing service integration. Expo Go has platform limitations; these need a development build and device verification for full coverage.
- Signing out clears local credentials and stops local services. It does not revoke Spotify access or erase recent server-side plays.

## Verification

Automated checks:

```sh
cd mobile
npm run check:types
npm test
npx expo install --check
cd ../server
npm test
```

Mobile tests cover play/listener API identity, same-song listeners, exact-coordinate map grouping, radius validation, unavailable locations, rejected deletion, failed messages, credential preservation during outages, and preview isolation. Existing server tests cover the backend contracts.

Manual simulator checks use the existing iPhone 17 Pro plus a temporary iPhone SE (375 × 667), including large Dynamic Type. Inspect all four onboarding scenes, list/map switching, stacked marker selection, track details, reaction failure feedback, comment and message composers, on-screen keyboard, request status tabs, connected profiles with missing data, radius persistence, account-deletion confirmation (cancelled), and session/permission recovery. Successful live Spotify authorization and social mutations require a signed-in account and other real listeners; the preview does not substitute for those end-to-end checks. Haptic feel requires a physical device.
