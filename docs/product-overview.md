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
| Onboarding (4 slides) | ✅ Built | Explains location, anonymity, privacy |
| Spotify login | ✅ Built | OAuth; server stores tokens and refreshes them |
| Passive broadcasting | ✅ Built | Server-side poller, 15s interval |
| Background location | ✅ Built | 60s / 50m threshold keeps location fresh |
| Nearby feed (list + map) | ✅ Built | Radius 50–500m, user-adjustable |
| Location fuzzing | ❌ Removing | Decided: show exact location |
| Taste-match % | ✅ Built | Overlap of top 20 artists and top 20 tracks, 0–100 |
| Push: "someone nearby is playing…" | ⚠️ Built, needs change | Fires on every broadcast within 500m. Decided: only for the recipient's on-repeat tracks |
| Reactions / comments / DMs | ⚠️ Built, fragile | Wiped every ~15s; see Known gaps #1 |
| Listening sessions | ❌ Not built | Decided: one anonymous ID per session; see Decisions |
| Connection requests | ✅ Built | Fixed end to end in PR #3 |
| Revealed Spotify profile | ⚠️ Placeholder | Real fetcher exists but isn't wired in |
| "Recently played" nearby | ❌ Not built | Broadcasts are deleted after 30s. Decided: keep 6h |
| Account deletion | ✅ Built | Deletes all of the user's data |
| Deployment / App Store | ❌ Not started | Local only |

## Privacy model

Privacy is the reason strangers are comfortable broadcasting, so it's part of
the product, not just a technical detail.

- **Anonymous by default.** Each broadcast gets a random ID. Nothing in the feed
  links it to a Spotify account.
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

"On repeat" isn't something the Spotify API exposes directly; the "On Repeat"
playlist is generated by Spotify and can't be read through the API. The closest
signal is the user's short-term top tracks (`/v1/me/top/tracks?time_range=short_term`,
roughly the last 4 weeks), refreshed periodically. Today we only store
medium-term top tracks, synced at login.

How the feed shape and sessions fit together: each feed entry is one play.
Reactions and comments belong to that play. DMs and connection requests go to
the listener's session ID, so a conversation continues while they keep listening
to new tracks.

"Away from the app" requires the app to report when it's open, which it
doesn't do today. Background location updates can't serve as the signal,
because they also run while the app is closed.

## Known gaps

Ranked by how much each one undermines the core experience.

0. **Security: Spotify access tokens are used as anonymous IDs.** The mobile
   app sends the viewer's access token as their anonymous ID for comments and
   DMs, and DM threads have no participant check. Fixed by the
   listening-sessions spec (`docs/specs/listening-sessions-and-recent-feed.md`).
1. **Comments and reactions don't last.** The poller re-creates each listener's
   broadcast every 15s with a new anonymous ID and deletes the old one. Reactions
   and comments are deleted along with the broadcast they belong to, so they
   disappear within seconds. This works against "commenting on someone's taste."
   (`server/src/services/spotifyPoller.ts`, `broadcastService.ts`)
2. **No "recently played."** Broadcasts are deleted 30s after creation
   (`expireStaleBroadcasts`). The product vision includes recent music, not
   just what's playing this second.
3. **The revealed profile is a placeholder.** `connectionService.ts` has its own
   stand-in that returns a placeholder image and no top artists or tracks.
   `spotifyProfileFetcher.ts` has the real version, but nothing uses it.
4. **DM threads break when a broadcast changes.** This has the same cause as #1:
   anonymous IDs only last for one broadcast.
5. **The poller doesn't scale.** It queries every user every 15s, which runs into
   Spotify rate limits well before it reaches App Store scale.
6. **Not tested end to end.** Nobody has run two real devices against a running
   backend.

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

1. **Make the core loop hold together.** Listening sessions, 6h "recently
   played", the real revealed profile (known gaps 1–4), then the two-device test.
   Switch push to on-repeat only.
2. **Private beta.** Deploy the backend, ship on TestFlight, seed one location
   with friends.
3. **Launch readiness.** Resolve Spotify quota, add report and block, handle
   empty feeds, set up App Store assets and privacy labels. Improve the map
   and taste match.
4. **Public launch.** App Store release with online marketing.

## Open questions

None blocking. Still undecided: exact copy and design for feed entries and push notifications.
