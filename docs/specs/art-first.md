# Art-first: fewer words, crafted icons, motion

## Problem

The sky + Paper Mono pass made the app calm, but it still *reads*. Lowercase
copy explains every screen ("2 playing now · 4 earlier", "PLAYING NOW",
"requests", "message the listener", word-pill reactions). The product is
about music you can see around you; the screens should show it, not
describe it. The direction is as few words as possible, with art,
hand-crafted icons, and motion carrying the meaning.

## Principles

1. **Art is the interface.** Album covers are the primary content and the
   only color.
2. **Show state, don't label it.** Live is motion (equalizer bars, breathing
   scale). Age is fading (older covers dim). Counts are dots, not numbers.
3. **Our own icons, drawn once.** One custom SVG set, with a single stroke
   weight (1.5), rounded caps, and slightly imperfect hand-drawn curves. No
   stock icon packs, emoji, or Feather.
4. **Everything responds.** Every tap gets a spring and a light haptic, and
   screens enter with a short stagger. Motion stays short (≤ 400ms) and
   never loops on still content.
5. **Words only where nothing else works:** the track and artist on the play
   screen, chat text, and the confirm dialogs for destructive actions.
   Accessibility labels stay complete; only *visible* words go.

## Design

### Icon set (`src/components/icons/`)

Hand-authored SVG components, each `({ size, color, strokeWidth })`:

| Icon | Used for | Drawing |
|---|---|---|
| `Waves` | nearby tab | three concentric arcs radiating from a dot |
| `Ripple` | map tab | a pin-head dot inside two loose rings |
| `Pair` | people tab | two overlapping circles |
| `Self` | you tab | one circle with a small dot inside |
| `Flame` · `Heart` · `Phones` · `Spark` · `Hands` | the 5 reactions (fire · heart · headphones · surprised · clap) | single-stroke outlines, filled when you've reacted |
| `Note` | message the listener | a speech curve with a tail |
| `Link` | open on spotify | an arrow leaving a circle |
| `Back` | headers | an open chevron |

### Tab bar
Icons only, no labels. The active icon is `ink` with a 4pt `live` dot
beneath it that springs to the new tab. The others are `ink-dim`.

### Nearby: the record crate (`app/(tabs)/nearby-feed.tsx`)
- **Header:** the Wavelength mark (the `Waves` icon, large) on the left,
  and on the right one `live` dot per live play (up to 5, then a ring).
  No title and no counts.
- **Grid:** 2 columns of square covers, 12pt gutters, radius 10. Live
  plays come first, then the rest by recency. No section labels, because
  motion and fading separate them.
- **Live covers:** 3 animated equalizer bars in the bottom-right corner
  (Reanimated, staggered sine heights) and a slow 1.0→1.02 breathing scale.
- **Earlier covers:** opacity fades from 0.85 (just ended) to 0.35 (6h),
  with a slight desaturation overlay. Recency is visible without "39m".
- **Tap:** spring press to 0.96, a light haptic, then `/play`.
- **Entrance:** covers fade and rise in a 30ms stagger. New live plays from
  the socket pop in with a spring.

### Play screen (`app/play.tsx`)
- The cover fills the top edge to edge and scales in from 0.94 on open,
  with the background tinted by the cover (blurred art, as in the feed
  header).
- Track title (light) and artist (dim) stay. These are the words that earn
  their place.
- **Reactions:** the 5 icons in a row. Tapping one fills it, bursts 6
  particles in `live`, and plays a haptic. The count is a small number,
  shown only when it's above 0.
- **Actions:** `Note` (message the listener) is an icon button. Comments
  sit below as bubbles, with the composer placeholder reduced to `…`.

### Map
Already art pins. The header becomes the same mark-plus-dots header as the
feed.

### People
- A grid of round avatars or letter circles. Requests become a `live` dot
  with a count badge on the header's right, instead of a line of text.
- Tapping a person opens the profile, where `message` and `open on spotify`
  become two large icon buttons (`Note` and `Link`), and "remove
  connection" stays as text inside a confirm sheet.

### You
- Large avatar letter. The radius becomes a visual: concentric rings that
  grow as you drag, with the meters shown only while dragging.
  "log out" and "delete account" move behind a single `⋯` icon, into a sheet.

### Empty states
One hand-drawn line illustration (a figure with headphones in a window,
stroke-drawn by animating its path in), plus at most four words: "nothing
nearby yet".

### Motion system (`src/components/motion.ts`)
Shared spring presets (`press`, `pop`, `settle`), stagger timing, and a
`useHaptic()` wrapper, so every interaction feels the same.

## Dependencies

- `react-native-svg`, for the custom icons and the line illustration.
- `expo-haptics`, for tap feedback.
- Reanimated 4.3 is already installed.

The first two need **one native rebuild**.

## Non-goals

- Pulling a dominant color from the art (that would need another native
  module). Blurred art covers the same job.
- Shared-element transitions between screens. Reanimated 4's version is
  experimental, so the play screen's scale-in approximates it.
- Onboarding and login. They're words by nature, and get a separate pass.
- Any change to backend behavior.

## Risks

- **Discoverability:** with no labels, first-time users may not know what
  the icons mean. Mitigations are accessibility labels, a one-time
  long-press hint on the tab bar, and onboarding (later).
- **Performance:** many animated tiles. Equalizers only run for live
  covers, which are few. Everything else is static once it has entered.
- **The icons have to be good.** That's the craft risk. I'll draw them as
  one set, review them together at 24pt and 48pt, and iterate before
  building screens on top of them.

## Milestones

1. Dependencies and rebuild; the icon set rendered on a dev preview screen
   for review. **Stop here for your feedback on the icons.**
2. Tab bar and the motion system.
3. Nearby crate grid: live equalizer, age fade, entrance and press motion.
4. Play screen: hero art, reaction icons with burst and haptics.
5. Map header, people grid, the "you" radius rings, empty-state illustration.
