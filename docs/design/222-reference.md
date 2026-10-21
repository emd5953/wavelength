# Design reference: 222

A breakdown of the design language of **222 — find your people**
(TwoTwoTwo Inc., App Store id 6450612690, v222.6.13, 4.68★ from 7.2k
ratings). Source: its 7 public App Store screenshots and icon. Colors were
sampled from the image pixels, not guessed.

The goal is to learn *how* 222 makes a social app feel calm and intentional,
then express that in Wavelength's own identity. It is not to clone 222.
222's screenshots are kept out of the repo on purpose.

## Why 222 is a useful reference

The products are close in spirit. Both are about chance encounters with
strangers nearby, IRL over online. 222's copy says it outright: "no profiles,
no DMs, no scrolling, no swiping." Wavelength's anonymous-until-mutual model
has the same instinct. 222's design makes that feel **safe, slow, and
special** instead of like a feed, and Wavelength wants the same feeling.

## The system

### Color: one dark hue, one ink, nothing else

| Role | Sampled | Notes |
|---|---|---|
| Background, deep | `#1A241C` | Bottom of the vertical gradient |
| Background, base | `#212C22` | Most of the screen |
| Background, lift | `#233124` / `#29392E` | Top of the gradient, icon tile |
| Bar / chrome | `#131E1B`, `#1F261F` | Bottom action bar and tab bar, slightly darker than the page |
| Card / row fill | `#202821`; `#40453D` over photos | Reads as roughly 6–10% cream over the background, not a separate hue |
| Primary button | `#3A4F3C` | Muted sage, the only "colored" fill in the app |
| Ink | `#FFFEDF` | Warm cream, never pure white. Secondary text is the same cream at ~60%, labels at ~45% |

There are no accent colors, no reds or blues, no status colors and no emoji.
The only saturated color on screen comes from **photography**.

### Type: all serif, mostly lowercase

- **One family, a humanist book serif**, used for everything: headings, body,
  buttons and tabs. There is no sans anywhere. The closest free equivalents
  are *Alegreya*, *Crimson Pro*, and *Cormorant* (for display); exact
  identification would need the binary, which is out of bounds.
- **Lowercase headings and body**: "dinner & rooftop jazz bar", "madeline
  & abbas", "let us find you your people". It reads like a note, not a UI.
- **Section labels are ITALIC UPPERCASE**, tracked out and dimmed: YOUR PARTY,
  ALSO ATTENDING, NEXT HEAD TO, YOUR TABLE, YOUR DYNAMIC. Each sits on a
  hairline rule that runs to the right edge.
- **Metadata is italic small caps, centered in two columns**: NEW YORK /
  EAST VILLAGE beside WED, JUN 15 / 7:30 PM.
- **Big numbers are light, not bold**: "76.3%" in large light serif, with
  "compatible" in smaller dimmed lowercase under it.
- Rough scale: display ~34pt, title ~28pt, body ~17pt with generous leading
  (~1.5), labels ~15pt italic caps, captions ~13pt.

### Imagery: photos as atmosphere

- Full-bleed photos (flash, grain, motion blur, candid nightlife) sit behind
  almost every screen, **darkened ~65–75%** with a green-black overlay so the
  cream text always wins.
- Text over photos is centered, two lines: a small lowercase lead-in ("let us")
  above a larger line ("curate your night").
- **Single-weight line drawings** (figures in windows) instead of icons or
  emoji, plus a handwritten-signature logomark. They feel human and drawn
  by hand.

### Layout and components

- **Centered headers, left-aligned content.** Wide side margins (~32pt) and
  lots of vertical air.
- **Hairline dividers** in cream at ~15% opacity, under labels and between list
  groups.
- **Cards**: radius ~14pt, translucent cream fill, 1px cream border at ~10%,
  and no shadows anywhere.
- **Tabs**: text only, in italic caps. The selected tab gets a faint pill
  background rather than an underline.
- **Decision bar**: a quiet text button **NO** next to a large sage pill
  **YES** (~75% of the width). The yes is clearly the invited action, and the
  no is never hidden.
- **Bottom tab bar**: text labels ("details" in bold, "people" in regular), with
  small outline icons only at the far ends.
- **Chips**: tiny italic caps in a translucent rounded rectangle ("YOUR +1").

### Voice

Lowercase, warm and slightly literary, with second person and promises
("let us…", "just say yes and explore the chance encounters you'd have never
experienced."). Instructions are plain bullets ("please arrive by 12:30pm").

## What it would mean for Wavelength

Wavelength today is close to the opposite: red gradients, emoji icons, a
bold sans, Spotify green, red LIVE pills. Principles worth taking:

1. **Album art is our photography.** Use the current track's art, blurred and
   darkened, as the atmosphere layer (feed header, play detail, comment
   thread), the way 222 uses nightlife photos. It gives the app color without
   adding colors to the UI.
2. **One hue plus one ink: Tailwind `sky`** (decided 2026-10-21). Drop the
   red. Sky is clearly ours, not 222's forest green and cream, while keeping
   the same structure: a dark ground, a pale ink, and one muted fill for the
   primary action. Tokens below.
3. **A serif voice.** A literary serif with lowercase headings makes "someone
   near you is playing this" feel intimate rather than social-media-like.
   Pair it with italic caps labels and hairline rules.
4. **Swap emoji for line drawings or nothing at all.** That includes the
   reaction bar, the 🤝 and 👤 nav buttons, and the onboarding tiles.
5. **Quiet live state.** Replace the red LIVE pill with something like an
   italic "playing now" and a small pulsing dot in the ink color.
6. **Copy in the same register**, for example: "let us show you what's playing
   around you", "played 12 minutes ago, two tables over".

## Wavelength palette: sky

The roles mirror 222's, with values from Tailwind's `sky` scale. The one
off-scale value is `night`: sky-950 darkened toward black, because 222's
chrome sits *below* its page color and sky has nothing darker than 950.

| Token | Value | 222 role it replaces |
|---|---|---|
| `night` | `#051F33` | Bar / chrome (`#131E1B`) |
| `ground` | sky-950 `#082F49` | Background base (`#212C22`) |
| `ground-lift` | sky-900 `#0C4A6E` | Gradient top / tiles (`#29392E`) |
| `card` | sky-50 at 6% | Card and row fill |
| `rule` | sky-50 at 15% | Hairline dividers |
| `primary` | sky-800 `#075985` | Sage YES button (`#3A4F3C`) |
| `ink` | sky-50 `#F0F9FF` | Cream ink (`#FFFEDF`) |
| `ink-muted` | sky-100 at 65% | Secondary text |
| `ink-dim` | sky-200 at 45% | Labels, metadata |
| `live` | sky-400 `#38BDF8` | *(new)* the "playing now" dot, the only bright pixel |

The ink is cool rather than warm. A cream ink on sky reads as a mistake,
so the whole system stays in one temperature.

## Next step

Use Rivet to generate 2–3 variants of the **nearby feed** that apply these
principles with different hue and serif choices, pick one, then turn it into
Tailwind tokens (`tailwind.config.js`) and roll it out screen by screen.
