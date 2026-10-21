# Wavelength — Product Overview

> I have this app that lets you see music being played around you right now.

## What it is

Wavelength shows you what people nearby are listening to on Spotify, live or
recently, without revealing who they are. You can react, comment on someone's
taste, message them, and, if you're both curious, connect and see each other's
Spotify profiles.

The point is **music discovery driven by curiosity about the people around you.**
Meeting people can happen, but it isn't the goal, and the product doesn't need to
define itself as social or dating.

## Who it's for

Anyone who listens to music on their own in a shared space:

- cafes
- gyms
- parks
- libraries, campuses, transit, waiting rooms: anywhere people sit near strangers
  with headphones in

The user doesn't have to *do* anything. If they've linked Spotify, they're
already broadcasting. Opening the app is about looking around.

## Core loop

```
Listen on Spotify  ──▶  Appear anonymously in nearby feeds
        ▲                          │
        │                          ▼
Discover a song  ◀──  Browse feed / map of what's playing within ~100–500m
                                   │
                                   ▼
               React · comment · DM the anonymous listener
                                   │
                                   ▼
                  Send a connection request (optional)
                                   │
                                   ▼
             Both accept → Spotify profiles revealed to each other
```

1. **Passive broadcast.** The server polls Spotify every 15s and posts the user's
   current track at their last known location. They don't need the app open.
2. **Discovery.** The feed shows nearby tracks as a list or on a map, each with
   album art, title, artist, and a taste-match % against the viewer.
3. **Curiosity.** Reactions, comments, and DMs are tied to a broadcast, and
   both sides stay anonymous.
4. **Connection.** It's a mutual opt-in: a request expires after 24h, and if
   accepted, both users see each other's Spotify profiles.

## Features and status

| Feature | Status | Notes |
|---|---|---|
| Onboarding (4 slides) | ✅ Built | Says location is visible on the map |
| Spotify login | ✅ Built | OAuth; server stores tokens and refreshes them |
| Passive broadcasting | ✅ Built | Server poller every 15s is the only writer of plays |
| Listening sessions | ✅ Built | One anonymous ID per session; ends after 5 min with no music and no app (PR #4) |
| Background location | ✅ Built | 60s / 50m threshold keeps location fresh |
| Nearby feed (list + map) | ✅ Built | Live plays first, then the last 6h; radius 50–500m |
| "Recently played" nearby | ✅ Built | Plays stay 6h after ending (PR #4) |
| Exact location | ✅ Built | Fuzzing removed by decision |
| Taste-match % | ✅ Built | Overlap of top 20 artists and top 20 tracks, 0–100 |
| On-repeat push | ✅ Built | Nearby play of your short-term top track; once per person per song (PR #4) |
| Reactions / comments / DMs | ✅ Built | Last as long as the play (6h); DMs follow the session |
| Connection requests | ⚠️ Server only | API works and is tested, but the app has no way to send one or reach the requests screen |
| Revealed Spotify profile | ⚠️ Placeholder | Real fetcher exists but isn't wired in |
| Account deletion | ✅ Built | Deletes everything, including DMs from past sessions; fixed in PR #4 |
| Visual design | ✅ Built | Sky palette + Paper Mono on every screen (`docs/design/222-reference.md`) |
| Deployment / App Store | ❌ Not started | Local only |

## Privacy model

Privacy is the reason strangers are comfortable broadcasting, so it's part of
the product, not just a technical detail.

- **Anonymous by default.** Each listening session gets a random ID, assigned by
  the server. Nothing in the feed links it to a Spotify account.
- **Exact location, by decision.** The map shows where a listener actually is.
  Fuzzing was removed on 2026-10-21 to keep the first version simple. Their
  identity stays hidden; their location doesn't.
- **Short-lived.** Plays stay visible as "recently played" for 6 hours, then
  they're deleted along with their location.
- **Identity reveal is mutual.** Profiles are shown only after both sides accept.
- **Leaving is total.** Deleting the account deletes everything.

## What makes it different

- **Spotify's Friend Activity** shows people you already know. Wavelength shows
  strangers in the same room.
- **Last.fm / stats apps** look at your own history. Wavelength looks outward.
- **Social and dating apps** start with identity. Wavelength starts with taste
  and reveals identity last, and only if both people want it.

The pitch should fit in one sentence: *see what music is playing around you
right now.*

## Business model

None. No monetization is planned. The only goal for now is growing the user base.

## Go-to-market

- **Target:** public App Store release.
- **Acquisition:** online marketing first.
- **The cold-start problem is the main product risk.** The feed is only
  interesting if other people nearby are on the app. An empty feed on first open
  is the most likely reason people churn. Options to weigh before launch:
  - concentrate launch in one city or campus so density builds faster
  - make "recently played nearby" the default view, so the feed isn't empty
    just because nobody is playing music this exact second
  - a fallback state for empty areas, such as the nearest activity even if
    it's outside the radius, or "be the first here"

## Decisions

| Decision | Choice | Date |
|---|---|---|
| Anonymous ID lifetime | **One per listening session.** The ID stays the same across tracks, so DMs and connection requests carry over while someone keeps listening. A new session gets a new ID. | 2026-10-21 |
| "Recently played" window | **6 hours.** Long enough that a new user's feed isn't empty. Revisit once there are enough users to fill the feed. | 2026-10-21 |
| Push notifications | **Only for songs on the recipient's recent repeat.** Notify someone when a person nearby plays a track they've been playing heavily lately, not for every nearby broadcast. | 2026-10-21 |
| Map view | **Keep, polish later.** A basic map already exists. Improvements come after the core loop works. | 2026-10-21 |
| Taste match | **Keep, deprioritized.** The core loop comes first. | 2026-10-21 |
| Session end | **Stopped listening and away from the app for 5+ minutes.** Both have to be true. Someone who paused but still has the app open keeps their session. Moving doesn't end a session. | 2026-10-21 |
| Feed shape | **A list of tracks recently played in the area, one entry per play.** The feed is about the place, not the people: "here's what's been played around you" over the last 6h, newest first. | 2026-10-21 |
| Push limits | **Once per person per song.** You get a notification the first time someone nearby plays one of your on-repeat songs. The same person playing it again doesn't notify you again; a different person playing it does. Repeats are tracked by the listener's account, not their session, so a new session doesn't trigger another notification. No time-based cap. | 2026-10-21 |
| Same song, different listeners | **Separate entries, never merged.** Each entry shows the anonymous listener first, then their song. A song always belongs to one person, so two people playing the same track show up as two entries. | 2026-10-21 |
| Live vs. recent | **Playing right now comes first.** Live entries are marked and sorted to the top; the rest of the last 6h follows, newest first. | 2026-10-21 |
| Location on the map | **Exact, no fuzzing.** Revisit before public launch. | 2026-10-21 |
| Visual direction | **Sky palette and Paper Mono, modeled on 222's calm.** One dark hue, a pale ink, album art as the only color. Reference: `docs/design/222-reference.md`. | 2026-10-21 |

"On repeat" isn't something the Spotify API exposes directly; the "On Repeat"
playlist is generated by Spotify and can't be read through the API. We use the
user's short-term top tracks (`/v1/me/top/tracks?time_range=short_term`,
roughly the last 4 weeks), synced at login and every 24h.

How the feed shape and sessions fit together: each feed entry is one play.
Reactions and comments belong to that play. DMs and connection requests go to
the listener's session ID, so a conversation continues while they keep listening
to new tracks.

"Away from the app" comes from a presence heartbeat the app sends every 60s
while it's in the foreground. Background location can't serve as the signal,
because it also runs while the app is closed.

## Known gaps

Ranked by how much each one undermines the core experience.

1. **The app can't send a connection request.** The "ask to connect" toggle in
   DMs only flags the message; it never calls `POST /connections/requests`, and
   nothing links to the requests screen. Connecting is the payoff of the app,
   so this blocks the core loop.
2. **The revealed profile is a placeholder.** `connectionService.ts` has its own
   stand-in that returns a placeholder image and no top artists or tracks.
   `spotifyProfileFetcher.ts` has the real version, but nothing uses it.
3. **Not tested end to end.** Nobody has run two real devices against a running
   backend.
4. **The feed can strand you on the location screen.** Its 10s refresh
   re-checks location permission, and if that runs while the app is
   backgrounded it replaces the stack with `/location-required`.
5. **The poller doesn't scale.** It queries every user every 15s, which runs into
   Spotify rate limits well before it reaches App Store scale.

Fixed in PR #4 (2026-10-21): comments and reactions being wiped every 15s, no
"recently played", DM threads breaking on every track change, Spotify access
tokens stored as anonymous IDs, and `DELETE /account/:id` deleting any account.

## Launch risks

- **Spotify API access.** Apps in Spotify's development mode are capped at a
  small allowlist of users, and Spotify has tightened who qualifies for
  extended quota. **Confirm the current policy before investing in marketing**,
  because it could block an App Store launch outright. Have a fallback in mind,
  such as Apple Music via MusicKit or a manual "share what I'm playing" mode.
- **App Store review.** Background location plus broadcasting exact locations
  to strangers will get scrutiny. The privacy model above is the answer; the onboarding
  and the App Privacy labels need to explain it clearly.
- **Safety.** Anonymous DMs between strangers who are physically close need
  report and block tools before a public launch.

## Roadmap

Rough phases.

1. **Make the core loop hold together.** ~~Listening sessions, 6h "recently
   played", on-repeat push~~ (done, PR #4), ~~redesign~~ (done). Next: wire up
   sending connection requests, the real revealed profile (known gaps 1–2),
   then the two-device test.
2. **Private beta.** Deploy the backend, ship on TestFlight, seed one location
   with friends.
3. **Launch readiness.** Resolve Spotify quota, add report and block, handle
   empty feeds, set up App Store assets and privacy labels. Improve the map
   and taste match.
4. **Public launch.** App Store release with online marketing.

## Open questions

None blocking. Still undecided: push notification copy, and whether reactions
should stay emoji under the new design.
