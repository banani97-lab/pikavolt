# Pikavolt Brand Spec (v2 — informed by the real mascot logo)

## The mascot

The official logo is a full-color cartoon mascot: a golden-amber, Pikachu-esque
electrician critter (chipmunk/mouse hybrid) wearing a black baseball cap, holding
blue-handled linesman pliers and a red-handled screwdriver, with a black tool belt
across the chest that reads "PIKAVOLT LLC" in volt-yellow type. It has a
lightning-bolt tail, set against a deep electric-teal background crackling with
yellow and cyan lightning.

Asset status: DELIVERED. Files in `apps/web/public/`:
- `mascot.png` — full art, 690×1028 (border-trimmed)
- `mascot-face.png` — 512×512 square face crop → chat button, avatars (round with CSS)
- `icon-512.png`, `icon-192.png`, `apple-touch-icon.png`, `favicon-32.png` — face crop at icon sizes
- `logo.svg` — simple geometric bolt glyph for nav/footer/compact contexts
Flutter should copy `mascot.png` + `mascot-face.png` into `apps/mobile/assets/` and
use the face crop for app icons (flutter_launcher_icons) later.

## Palette (mascot-derived — replaces the v1 pure-black/yellow scheme)

Colors sampled from the delivered art (bg `#2A5E73`→`#295462`, fur `#DB9C38`,
bolt gold `#ECC647`, cap `#20262C`):

| Token | Hex | Use |
|---|---|---|
| `storm` | `#081A21` | page background — near-black with deep teal cast |
| `surface` | `#0E2A33` | cards, panels — dark teal |
| `teal` | `#2A5E73` | brand field color (exact mascot backdrop), section washes, gradients |
| `teal-deep` | `#1B4254` | gradient partner, hovers on teal |
| `volt` | `#FFE600` | primary accent — CTAs, highlights (brighter than mascot bolt for UI pop) |
| `amber` | `#DB9C38` | secondary accent — exact mascot fur gold; warm highlights, icons |
| `arc` | `#22D3EE` | electric cyan — lightning accents (matches art's cyan crackle) |
| `emergency` | `#FF3B30` | 24/7 emergency elements only |
| text | `#F8FAFC` / `#9FB8C2` | primary / muted (muted tinted toward teal) |

Gradients: `teal → storm` for section backgrounds; `volt → amber` for glowing CTA
borders; lightning strokes in `volt` with `arc` glow.

Dark theme only. The vibe: **"beasty" but friendly** — the mascot is playful, the
craft is serious. Heavy display type (Anton) in white/volt over teal-storm
backgrounds, electric arcs and bolt motifs, mascot appears as a character (hero,
chat button, empty states, 404) — not plastered on everything.

## Application notes

- Web tokens live in `apps/web/src/app/globals.css` (@theme) + `packages/config`.
  Update `--color-storm #071A20`, `--color-surface #0C2830`, add `--color-teal
  #136F83`, `--color-amber #F2A33C`; keep `--color-volt #FFE600`, `--color-arc
  #22D3EE`, `--color-emergency #FF3B30`.
- Flutter theme mirrors the same values in `apps/mobile/lib/core/theme.dart`
  (scaffold #071A20, surface #0C2830, primary #FFE600, secondary #136F83,
  tertiary #F2A33C).
- Chat widget button: circular, mascot face crop with volt ring + pulse.
