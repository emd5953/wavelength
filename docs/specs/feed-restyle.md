# Feed restyle: sky + Paper Mono

First screen of the redesign in `docs/design/222-reference.md`.

## Problem

The nearby feed still uses the old red system: red gradient header, emoji
nav buttons (🤝 👤 🔇), a white segmented control, a bold system sans, red LIVE
pills, and emoji reactions. It's loud where the product wants to be calm,
and it ignores the sky palette and Paper Mono tokens now in
`tailwind.config.js`.

## Goals

- The feed screen, feed card, and empty, loading, and error states use only
  the sky tokens and Paper Mono.
- Album art provides the color: the top live play's art is blurred and
  darkened behind the header.
- A live play reads as calm: a small `live` dot plus "playing now" in place
  of the red pill.
- Text replaces emoji: nav is `people` / `you`, and the empty state uses copy
  only.
- The voice is lowercase.

## Non-goals

- Other screens (onboarding, login, profile, comments, DMs, connections) come
  in later passes. They keep the red tokens until then.
- The map's internals. The pins and callout stay as they are; only the
  list/map toggle is restyled.
- The reaction set. The five reactions stay; only their presentation changes
  (see Design).
- Line-drawing illustrations. No artwork exists yet, so the empty state is
  copy only.
- Any change to feed behavior or data.

## Approach

Restyle in place with Tailwind classes and the new tokens. No new component
library and no new dependencies beyond `expo-blur` (Expo SDK, already
compatible). The alternative was Rivet variants first. That lost because the
direction is already pinned (palette, font, and reference all chosen), so
variants would only explore details we can tune live in the simulator.

## Design

**Header** (`app/nearby-feed.tsx`):
- The background is the newest live play's album art, full-bleed, with
  `expo-blur` intensity ~60 and a `ground` overlay at ~75%. With no live play
  it falls back to a plain `ground-lift` → `ground` gradient.
- The title is `nearby` in `font-mono-light`, ~32pt, `ink`. The subtitle is
  `2 playing now · 5 earlier`, ~13pt, `ink-dim`.
- The nav is two text buttons, `people` and `you`, ~13pt `font-mono`,
  `ink-muted`. This replaces the emoji tiles.
- The list/map toggle is text only (`list` / `map`). The selected one is `ink`
  on a `card` pill and the other is `ink-dim`, matching 222's tab treatment.

**Section labels:** the list is split into `PLAYING NOW` and `EARLIER`.
Labels are uppercase `font-mono-medium`, ~11pt, tracked +1.5, `ink-dim`, on
a `rule` hairline. These replace the per-card LIVE pill as the main live signal.

**Card** (`src/components/BroadcastCard.tsx`):
- `card` fill, 1px `rule` border, radius 14, no shadow.
- 56pt album art (radius 8), with the track in `font-mono-medium` 15pt `ink`
  and the artist in `font-mono` 13pt `ink-muted`.
- Meta line: live plays get a 6pt `live` dot and `playing now`; ended plays get
  `12m ago`. Then `· 42% match` if above 0. All 12pt `ink-dim`.
- The reactions stay as five emoji, smaller and on a single row with
  `ink-dim` counts. They're the one place emoji stay, because they *are* the
  content. The action row becomes text: `comment` · `message`.

**States:**
- Empty: `nothing played nearby yet.`, then `songs played around you in the
  last 6 hours show up here. what's playing right now goes on top.`
- Loading: the same layout with a muted spinner.
- Error: copy plus a `try again` text button.

## Behavior

- The header art changes when the newest live play changes, cross-fading
  over ~300ms. If the art URL fails to load, the gradient fallback shows.
- The `PLAYING NOW` section is hidden when nothing is live, and `EARLIER`
  when nothing has ended. Socket `broadcast:ended` moves a card between
  sections; it already re-sorts.
- Long track and artist names truncate to one line, as today.

## Verification

1. `npm run check:types` and `npm test` (mobile).
2. Seed about 6 plays around a fixed simulator GPS point (`xcrun simctl
   location set`), 2 live and 4 ended at different ages, using a scratch
   script that isn't committed.
3. Screenshots in the simulator of the populated feed, the empty feed, and a
   card going live → ended. Compare against `222-reference.md` for calm,
   hierarchy, and contrast.

## Risks / open questions

- **Contrast:** `ink-dim` (sky-200 at 45%) on `ground` may fall below 4.5:1
  for 12pt text. Check in the screenshot; if it's too faint, bump to 55%.
- **A monospace font in a reading UI.** Paper Mono at body sizes is wider
  than a proportional font, so track names truncate sooner. That's acceptable
  for one-line titles; revisit if it hurts.
- `expo-blur` is a native module and needs one rebuild (`expo run:ios`).

## Milestones

1. Header, toggle, and section labels.
2. Card.
3. Empty, loading, and error states. Seed, screenshot, and tune.

## Status

Milestones 1–3 done. Checked in the iOS simulator against 6 seeded plays
(2 live, 4 earlier) and in the empty state.

What moved from the spec:

- **No `expo-blur`.** React Native's `Image` `blurRadius` covers it, so there's
  one fewer native dependency and no rebuild for anyone pulling this.
- The header is its own component, `src/components/FeedHeader.tsx`, to keep
  `nearby-feed.tsx` about data and state.
- Two bugs found in the simulator and fixed:
  - The header fade used `'transparent'`, which on iOS is transparent black,
    so it showed a dark band. It now fades from `ground` at 0 alpha.
  - An image that loaded before a re-render could get stuck at opacity 0.
    Each art URL now mounts its own fading image, so nothing resets a loaded
    one.
- Contrast: `ink-dim` reads fine at 12–13pt on `ground` in screenshots, so
  it stays at 45%.

## Follow-up: every screen

Extended to all screens on request, using the same system. Shared primitives
now live in `src/components/ui.tsx` (`Screen`, `Card`, `SectionLabel`,
`PrimaryButton`, `OutlineButton`, `TextButton`, `EmptyState`, `Spinner`,
`COLORS`), and comment and DM bubbles plus the message input live in
`src/components/Conversation.tsx`. The red tokens are removed from
`tailwind.config.js`; nothing references them any more.

- Login and onboarding are type-only, with no emoji tiles and a single sky
  primary action. Onboarding uses 222's "lead-in, then statement" rhythm.
- Connection requests use a quiet **no** next to a pill **yes**, with no
  red accept/decline buttons.
- Map pins are `live` for playing-now and `primary` for earlier, on a dark map.
- Fixed copy: `location-required` still said "your exact location is never
  shared", which has been false since the 2026-10-21 fuzzing decision.

Screenshot-checked in the simulator: feed (populated and empty), comments,
DM, connection requests, connections, profile, location-required. Login and
onboarding are type-checked only; reaching them means logging out.

Found while testing, **not fixed** (it predates this change): the feed's 10s
refresh calls `GPSModule.requestPermission()` and `router.replace`s to
`location-required` when it isn't `granted`, which can happen while the app
is in the background. Coming back can leave you on that screen with no way
back except re-granting.
