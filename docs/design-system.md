# BSJ Hall: design principles and frontend workflows

**Status:** lock before UI build. Not implemented UI.
**Audience:** whoever designs or ships the React Native / Expo client.
**Sources:** `backend/openapi.yaml`, `docs/database.md`, `docs/api.md`, `docs/system-architecture.md`, `reference/prototype/`, `reference/demo/`, proposal phone shots. Emergency screens in the prototype are **out of scope for v1** (see database: emergency alerts are not kept).

This document is opinionated. Prefer clarity over novelty. Prefer fewer decisions over more themes.

---

## 1. Design principles

Inspired by Apple / Jony Ive craft applied to hostel ops: beauty through restraint, function first, magic without clutter.

1. **One job per screen.** Gate scans. Register counts. Approve or reject. Plan an outing. Do not merge unrelated tasks onto one canvas.
2. **Presence is the hero.** Inside / outside / late / pending must be readable at arm’s length in under a second. Status beats chrome.
3. **Night-duty first for gate; restrained dark for everyone.** Gate UI is always the darkest shell: high-contrast, thumb-large. Resident, warden, and provost ship a restrained dark theme (paper/ink inverted carefully) alongside light. Gate stays darkest; do not force one chrome on every role.
4. **Institutional calm, not startup loud.** Forest, paper, gold. No rainbow dashboards. No gamification. No confetti.
5. **Magic is earned.** Permanent hall-pass QR that toggles exit/return; auto late vs on-time; grace copy that names the parent SMS. Prefer small, cute, purposeful micro-animations over spectacle; flair lives in those feedback moments, not in decorative loops.
6. **Type does the branding.** Serif for identity and state. Sans for work. Mono for codes. Icons support; they do not decorate every row.
7. **Words over labels.** Sentence case. Real hall language from the contract (`late-night`, `home going`, `hall pass`, `register`). No inventing product terms the API does not use. **No em dashes (U+2014) in product copy** (or in this document): use commas, periods, or hyphens.
8. **Speed under stress.** Gate: scan → result → next. Register: counts → late → search. Permissions: queue → decide. Reduce taps; never hide the primary action.
9. **Honest emptiness.** Empty, error, and loading states are designed, not afterthoughts. Error copy matches API refusal messages where the contract already provides them.
10. **Do not invent backend behavior.** UI may only express roles and routes that exist. Parents have no login. Guests have no QR. Payment is mark paid/unpaid, not a gateway.

### Anti-patterns (ban list)

- Inter / Roboto / Arial as the face of the product.
- ALL CAPS section labels stacked down a scroll view.
- Title Case On Every Label And Button.
- Purple gradients, neon accents, glassmorphism stacks.
- Card-in-card nesting more than one deep.
- Emoji as icons; Lucide/Heroicons dumped wholesale without a curated set.
- Skeleton screens that shimmer longer than the real fetch.
- Inventing an Emergency tab in v1.
- Em dashes (U+2014) in UI strings, empty/error copy, or docs that define product language. Use commas, periods, or hyphens.

---

## 2. Typography system

Distinctive, readable, hall-native. Builds on the prototype (`Source Serif 4` + `Source Sans 3` + `IBM Plex Mono`) and tightens case/tracking rules so the product does not look “AI default.”

### Font pairing (Expo)

Target client: **React Native / Expo**. Load fonts with `expo-font` (or `@expo-google-fonts/source-serif-4`, `@expo-google-fonts/source-sans-3`, `@expo-google-fonts/ibm-plex-mono`). Reference families by the PostScript / Expo registered names in `Text` `fontFamily` (and `fontWeight` where the package exposes weight files). Do not assume CSS `font-family` stacks or web `@font-face`.

| Role | Family | Why | Expo load |
|---|---|---|---|
| **Display** | **Source Serif 4** (opsz 8–60 where available) | Warm institutional voice; names, state headlines (“Ready to leave”, “Exit recorded”) | `@expo-google-fonts/source-serif-4` (or bundled TTF via `expo-font`) |
| **Text / UI** | **Source Sans 3** | Clean workhorse; forms, lists, buttons, nav | `@expo-google-fonts/source-sans-3` |
| **Mono** | **IBM Plex Mono** | Enrolment numbers, room labels (`B-204`), QR payload hints, audit ids, times in dense tables | `@expo-google-fonts/ibm-plex-mono` |

**Loading:** block first paint of role shells until `useFonts` / `Font.loadAsync` resolves (splash stays up). Fail closed to system **serif / sans-serif / monospace** only if load fails; never ship Inter as the primary face. On iOS, optional last-resort native faces are New York / SF Pro / SF Mono; on Android, prefer the bundled Source / Plex files over OEM defaults.

**Optional alternate (if Source Serif feels too soft on small phones):** keep Source Sans 3 + IBM Plex Mono; swap display to **Fraunces** soft-optical or **Literata** (still not Inter). Decision: stick with **Source Serif 4** unless usability testing says otherwise.

### Scale (mobile, logical px)

| Token | Size | Weight | Line-height | Use |
|---|---|---|---|---|
| `display.xl` | 34 | Serif 600 | 1.05 | Gate result name; rare hero |
| `display.l` | 28 | Serif 600 | 1.12 | Screen titles (“Need to go out?” style) |
| `display.m` | 22 | Serif 600 | 1.2 | Card titles, resident name on home |
| `title.s` | 17 | Sans 600 | 1.25 | Nav titles, sheet headers |
| `body.l` | 17 | Sans 400/500 | 1.4 | Primary body |
| `body.m` | 15 | Sans 400/500 | 1.4 | Secondary body, list rows |
| `body.s` | 13 | Sans 400/500 | 1.35 | Helper, captions |
| `label` | 13 | Sans 550–600 | 1.25 | Field labels (sentence case) |
| `chip` | 12 | Sans 600 | 1.2 | Status chips |
| `mono.m` | 14 | Mono 500 | 1.3 | Room, enrolment |
| `mono.s` | 12 | Mono 500 | 1.3 | Dense ids, timestamps in lists |
| `num.l` | 40 | Sans or Serif 600 | 1.0 | Register counts |

Tracking (design intent): display slightly tight; body 0; mono slightly open on short codes; chips mildly open. Map to React Native `letterSpacing` (approx -0.5 to -0.8 on display sizes; 0 body; +0.3 to +0.6 on mono/chips). **Never** wide tracking that reads as ALL CAPS scream.

### Case rules (strict)

| Element | Case | Notes |
|---|---|---|
| Screen titles, state headlines | Sentence case | “Ready to leave.” “Exit recorded.” |
| Resident / staff names | As stored (proper names) | Serif |
| Buttons | Sentence case | “Plan outing” “Show hall pass” “Approve” |
| Field labels | Sentence case | “Expected return” not “EXPECTED RETURN” |
| Nav / tab items | Sentence case | “Home” “Register” “Gate” |
| Status chips | Sentence case or short proper | `Inside` `Outside` `Late` `Pending` `Approved`. **Not** `INSIDE` |
| Section headers in lists | Sentence case, sans 600 | “Recent activity” not “RECENT ACTIVITY” |
| Hall product terms | As in contract | late-night, home going, hall pass, register |
| ALL CAPS | **Forbidden** for UI chrome | Exception: none. If a legal SMS template uses caps, that is content, not chrome. |
| Small caps | Rare, optional | Only for a single brand mark (“BSJ”) if drawn as a custom glyph; do not fake small caps with CSS on every label. |
| Title Case Everything | **Forbidden** | |

Italic serif sparingly for emphasis in long lede copy, not on buttons.

---

## 3. Color palette

Restrained. Accessible. Role-tinted without rainbow UI.

### Heritage rationale (Begum Sultan Jahan)

The product is named for **Sultan Jahan Begum of Bhopal** (r. 1901–1926): education reformer, patron of women’s learning, and the first woman Chancellor of Aligarh Muslim University, the namesake of Begum Sultan Jahan Hall. Colour must feel like that lineage, not generic SaaS blue.

| Source | What we take | What we refuse |
|---|---|---|
| **Begum as educator / AMU Chancellor** | Calm institutional green (`forest` / `leaf`): growth, campus shade, seriousness without military camo | Neon campus “spirit” colours; sports-club rainbow |
| **Bhopal Begum architecture (Taj-ul-Masajid)** | Warm **pink sandstone** in sun → soft gold/cream (`gold`, `gold.soft`, `paper`); **white marble** → `surface` / cool paper; dusk warmth → `gate.gold` | Literal pink UI chrome on every screen; marble-texture gimmicks |
| **Night gate / hall security** | Deep garden ink (`gate.bg`, `ink`): lake-city evening, not cyberpunk black | Pure `#000` void, purple neon |
| **Dignity of a Begum’s court** | Sparse gold for attention and “ready” moments only | Gold gradients, foil, luxury-app gloss |

Primary tokens stay the locked prototype forest/paper/gold set (already in `reference/prototype/styles.css`). Heritage adds **meaning and one optional sandstone accent**, not a second palette.

**Optional ceremonial accent** (headers, brand mark only; never body text):

| Token | Hex | Use |
|---|---|---|
| `sandstone` | `#C4A484` | Rare brand-mark highlight; light-mode favicon warm edge |
| `marble` | `#F7F5F0` | Alternate paper for ceremonial splash / empty brand frames |

Do not invent a “royal purple” or Mughal-pattern wallpaper. Beauty is restraint: Jony Ive reading a Begum’s library, not a theme-park palace.

### Core (light: resident, warden, provost)

| Token | Hex | Role |
|---|---|---|
| `ink` | `#14261F` | Primary text |
| `ink.soft` | `#44554C` | Secondary text |
| `ink.faint` | `#6B7A72` | Tertiary / placeholders |
| `forest` | `#1F4D3A` | Primary actions, key accents |
| `forest.deep` | `#16382B` | Pressed primary |
| `leaf` | `#2A6A4E` | Success / inside emphasis |
| `gold` | `#A68438` | Attention, late, pending warmth (sparingly) |
| `gold.soft` | `#F0E6C9` | Soft pending/late surfaces |
| `paper` | `#F2F4F0` | App background |
| `paper.2` | `#E7EBE4` | Recessed wells |
| `surface` | `#FFFFFF` | Cards |
| `line` | `#D4DBD4` | Borders |
| `line.strong` | `#B7C0B7` | Strong dividers |
| `outside` | `#35506C` | Outside presence |
| `outside.bg` | `#EAF0F6` | Outside soft fill |
| `late` | `#8C4A24` | Late text/icon |
| `late.bg` | `#F6EBE3` | Late soft fill |
| `pending` | `#7A6328` | Pending text |
| `pending.bg` | `#F3EDD8` | Pending soft fill |
| `approved.bg` | `#E5F0EA` | Approved soft fill |
| `danger` | `#6E2430` | Destructive / hard refusal only |
| `danger.bg` | `#F7E8EA` | Error soft fill |

WCAG: `ink` on `paper`/`surface` ≥ 7:1. Primary button: white (`#FFFFFF`) on `forest` ≥ 4.5:1. Never put `gold` text on `gold.soft` for body copy. Use `pending` / `late` ink on soft fills.

### Gate (dark: night duty)

| Token | Hex | Role |
|---|---|---|
| `gate.bg` | `#101C17` | Screen |
| `gate.panel` | `#18261F` | Panels |
| `gate.ink` | `#EEF2EC` | Primary text |
| `gate.muted` | `#9AA89E` | Secondary |
| `gate.gold` | `#D7C48A` | Primary CTA + success accents |
| `gate.danger` | `#C45A64` | Refusal (bright enough on dark) |

### Role tint (chrome only, not content rainbow)

A thin identity cue on home header or tab bar active state. One accent each; content colors stay semantic.

| Role | Tint | Where |
|---|---|---|
| Resident | `forest` | Primary buttons, home accent |
| Gate | `gate.gold` on `gate.bg` | Entire shell |
| Warden | `forest` + quiet `gold` for pending count badges | Register/permissions |
| Provost | `forest.deep` | Office chrome; same components as warden plus settings density |

Do **not** give each role a different full palette. Do **not** color-code every list row by role.

### Light + dark (Expo)

Ship **both** light and a restrained dark theme for **resident / warden / provost**. Drive theme from Expo / RN: `useColorScheme()` plus an in-app override stored locally (follow system by default). Gate is **always** the dedicated gate shell below (darkest); ignore OS light mode on gate screens.

Light tokens are the Core table above. Dark tokens invert paper/ink into a calm forest night, **not** a copy of gate, and **not** pure black.

#### Dark (resident, warden, provost)

| Token | Hex | Role |
|---|---|---|
| `ink` | `#E8EEE9` | Primary text |
| `ink.soft` | `#A8B5AD` | Secondary text |
| `ink.faint` | `#7A8A80` | Tertiary / placeholders |
| `forest` | `#3D8F6E` | Primary actions (brighter for contrast on dark paper) |
| `forest.deep` | `#2F6F56` | Pressed primary |
| `leaf` | `#4CA882` | Success / inside emphasis |
| `gold` | `#D4B56A` | Attention, late, pending warmth (sparingly) |
| `gold.soft` | `#3A3424` | Soft pending/late surfaces |
| `paper` | `#121A16` | App background |
| `paper.2` | `#0E1512` | Recessed wells / inset |
| `surface` | `#1A2420` | Cards |
| `surface.raised` | `#222E28` | Slightly lifted panels |
| `line` | `#2A3830` | Borders |
| `line.strong` | `#3A4A40` | Strong dividers |
| `outside` | `#8AAAC8` | Outside presence |
| `outside.bg` | `#1A2834` | Outside soft fill |
| `late` | `#E0A078` | Late text/icon |
| `late.bg` | `#2E221C` | Late soft fill |
| `pending` | `#D4C08A` | Pending text |
| `pending.bg` | `#2A281C` | Pending soft fill |
| `approved.bg` | `#1C2E26` | Approved soft fill |
| `danger` | `#E0707C` | Destructive / hard refusal only |
| `danger.bg` | `#2E1A1E` | Error soft fill |
| `sandstone` | `#C4A484` | Rare brand-mark highlight (same as light) |
| `marble` | `#1E2620` | Ceremonial dark paper alternate |

WCAG: `ink` on `paper`/`surface` >= 7:1. Primary button: dark ink or white on `forest` >= 4.5:1. Prefer white (`#FFFFFF`) or light `paper` on `forest` for filled primary in dark mode.

#### Theme rules

| Role | Light | Dark |
|---|---|---|
| Resident / warden / provost | Core light tokens (default) | Dark table above; same components, swapped token map |
| Gate | N/A (gate is never light) | Always `gate.*` tokens; **darkest** shell (gold-led, flatter panels than resident dark) |

- Implement as a single token object per scheme (`colors.light`, `colors.dark`, `colors.gate`) consumed by StyleSheet / theme context. No hard-coded hex in screens.
- Semantic colors stay semantic across themes (late stays late-brown/gold family; danger stays maroon/rose family).
- Still no glassmorphism, neon, or purple dark-mode cliches.

---

## 4. Layout, spacing, components

### Spacing scale

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48` (logical px). Default padding in a phone screen: 20 horizontal. Card padding: 16–20. Stack gap between cards: 12–16. Section gap: 24–32.

### Corners

| Token | Radius |
|---|---|
| Control (chip, small button) | 999 (pill) or 12 |
| Button (primary) | 16 |
| Card / sheet | 20–24 |
| Modal / large panel | 28 |
| Icon tile | 12–14 (match card language; not sharp squares) |

### Elevation (React Native)

Allow a **little** more depth than border-only: soft layered shadows (1-2 levels) and subtle inset wells. Still no glassmorphism, neon glow, or heavy Material elevation stacks.

Borders + paper/surface shift remain the primary separation. Shadows are quiet support.

| Level | When | iOS (`shadow*`) | Android (`elevation`) | Notes |
|---|---|---|---|---|
| **0 Flat** | List rows, chips, inline controls | none | 0 | Border `line` only |
| **1 Card** | Home status card, plan summary, settings group | `shadowColor` = ink (`#14261F` light / `#000000` dark), `shadowOffset: {width:0, height:4}`, `shadowOpacity: 0.08` light / `0.35` dark, `shadowRadius: 12` | `elevation: 2` | Pair with `borderWidth: 1`, `borderColor: line` |
| **2 Raised** | Bottom sheets, modals, floating primary bar | same color; `shadowOffset: {width:0, height:8}`, `shadowOpacity: 0.12` light / `0.45` dark, `shadowRadius: 20` | `elevation: 4` | Max depth in product UI |
| **Inset well** | Recessed count strip cells, search field, `paper.2` troughs | no shadow; fill `paper.2`, inner border `line` | 0 | Simulate inset with fill + border, not web-only inset shadows |

- **Gate:** no drop shadows. Rely on `gate.panel` fills and gold strokes.
- Do not nest elevated cards inside elevated cards.
- Prefer one shadow level per surface; never stack level 1 and 2 on the same view.

### Lists vs cards

| Pattern | When |
|---|---|
| **Plain list** | Register rows, history, gate activity, audit, SMS log: dense, scannable |
| **Card** | Home status, permission review, guest review, plan summary, settings groups |
| **Count strip** | Register summary (Inside / Outside / Late / Waiting): large numerals, not four fat cards |

Never wrap every list row in its own elevated card.

### Actions

| Kind | Look |
|---|---|
| Primary | Filled `forest` (or `gate.gold` on gate); one per screen |
| Secondary | Stroke `line.strong` + `ink`; or quiet text button |
| Destructive | `danger` text or outline; confirm on irreversible (reissue pass, suspend) |
| Approve / Reject | Pair on decision screens: Approve = primary forest; Reject = secondary or danger outline. Equal visual weight, distinct meaning. |

Thumb zone: primary action pinned bottom-safe-area on mobile flows (plan, decide, scan).

### States

| State | Treatment |
|---|---|
| Loading | Quiet inline spinner or opacity pulse on content; prefer partial content. No branded Lottie loop. |
| Empty | One sentence + optional secondary action (“No pending permissions.”) |
| Error | Soft `danger.bg` banner or full-screen gate refusal; use API `message` when present |
| Success | Brief confirmation (serif headline + one detail); gate auto-returns to scan-ready after ~1.5–2s |
| Disabled | Lower opacity; never rely on color alone |

### Forms

Large tap targets (≥44pt). Destination picker = horizontal pills from `/api/v1/destinations`, “Other” last. Times: 12-hour India clock per contract. Dates: `05 September 2026` style when shown in prose.

---

## 5. Iconography and favicons (HD, no slop)

Icons are part of the hall’s face. Treat them like type: few, custom, high-res, optically consistent. **Do not** ship a generic emoji set or an uncurated Lucide dump. In Expo, prefer SVG via `react-native-svg` (or a single curated icon component map). Raster `@2x`/`@3x` PNG only when SVG is impractical. App icons / adaptive icons are native assets in Expo app config, not web favicons alone.

### Style rules

| Rule | Spec |
|---|---|
| Construction | Custom SVG (or PDF/SVG exported from a single master file). One family only. |
| Stroke | 1.75–2px at 24×24 viewBox; rounded caps/joins; optical balance so thin icons don’t gray-out on paper |
| Corner language | Soft terminals; inner corners ≈ UI radius language (slightly rounded, not sharp geometric) |
| Grid | 24×24 keyline; 2px padding; align to 1px grid; companion 20 and 28 optical sizes for dense vs hero |
| Fill | Mostly stroke. Solid fills only for status glyphs on gate result (exit arrow, return check, refusal mark) |
| Color | Inherit currentColor. Semantic color applied by the component (`forest`, `gold`, `danger`, `gate.gold`). Icons themselves stay mono |
| Perspective | Flat, frontal. No skeuomorphism, no 3D tiles, no duotone gradients |
| Metaphor | Literal hostel ops: hall pass / QR frame, gate scan brackets, arrow-exit, check-return, register book, key/room, guest/bed, shield-permission, clock-late |

### Required custom set (minimum)

Ship these as named assets (example names): `scan`, `hall-pass`, `exit`, `return`, `inside`, `outside`, `late`, `pending`, `approved`, `rejected`, `register`, `permission`, `guest`, `settings`, `search`, `chevron`, `close`, `warning`, `check`. Add only when a screen needs a new metaphor. Do not prerender 200 icons.

### Export sizes

| Use | Sizes (px) | Format |
|---|---|---|
| In-app UI glyph | 20, 24, 28, 32 (@1x); also @2x/@3x raster if not pure SVG | SVG preferred; PNG fall back |
| App icon (iOS) | 20, 29, 40, 60, 76, 83.5, **1024** | PNG, no alpha on App Store 1024 |
| App icon (Android) | 48, 72, 96, 144, 192 + adaptive foreground 432 | PNG / WebP |
| Expo app icon / adaptive | Per Expo / store requirements (incl. 1024) | PNG; configured in app config |
| Favicon / PWA (only if a web shell exists) | **16, 32, 48**, 180 (apple-touch), 192, 512 | ICO (16+32) + PNG |
| Gate result hero mark | 64, 96, 128 | SVG or PNG @2x/@3x |

Master at **1024** for the brand mark; downscale with a human pass at 16 and 32 (do not trust naive scaling for the “B”/hall mark).

### Brand mark / favicon content

- Prefer a **simple monogram or hall mark** derived from BSJ / forest seal: not a QR, not a generic house emoji, not a white label “hostel” clipart.
- Light: forest mark on paper/transparent.
- Dark / gate: light mark on `gate.bg`, or gold monoline variant.
- Maskable Android: keep critical ink inside the safe 80% circle.

### Dark / light icon variants

| Context | Variant |
|---|---|
| Paper UI | Forest/ink stroke on clear |
| Gate UI | Light/`gate.gold` stroke on clear |
| Favicon | Dual: light-capable PNG; optional `media="(prefers-color-scheme: dark)"` SVG |
| Tab bar | Active = forest (or gold on gate); inactive = `ink.faint` (token from active scheme) |
| Scheme | Same SVG; tint / color from light, dark, or gate token map |

### “No slop” ban list (icons)

- Emoji used as UI icons (📱🚪✅❌🏠).
- Unmodified Lucide / Heroicons / Feather / Material Symbols sprinkled inconsistently.
- Gradient blob app icons, 3D isometric houses, AI-generated “logo soup.”
- Mismatched stroke weights across one screen.
- Icons on every list row when type + status chip already communicate.
- Using maroon/danger icons for ordinary permissions or late state (late uses gold/late tokens; danger is refusal/destructive only).
- Embedding the wordmark in the 16×16 favicon (illegible). Use monogram only at tiny sizes.

### When a library icon is allowed

Only as a **temporary** stub during early layout, behind a feature flag or `TODO(icons)`, replaced before release. Prefer drawing the twelve required glyphs first.

---

## 6. Motion and micro-interactions

Subtle. Purposeful. Mostly short. Prefer **small, cute, purposeful micro-animations** over spectacle. Motion should confirm a result or guide attention; it should never decorate for its own sake.

### Budget (navigation and feedback)

| Allowed | Spec |
|---|---|
| Screen push | 250–300ms ease-out |
| Bottom sheet | 280ms spring soft |
| Gate result enter | 180ms fade + 4px rise; hold; auto-dismiss |
| Button press | 80ms opacity/scale 0.98 |
| Presence chip change | Cross-fade 150ms |

### Cute micro-interactions (hostel ops)

Keep them restrained and institutional: a soft settle, a brief check mark, a gentle opacity lift. Not childish bounce, not neon/circuit glow, not game UX.

| Moment | Intent | Spec (default) |
|---|---|---|
| Permission card appear | New request or decision lands calmly | Fade + 6–8px rise, 180–220ms ease-out |
| Gate scan success | Confirm exit/return without delaying the next scan | Check or gold flash on result panel, ≤180ms; auto-dismiss per gate flow |
| List item enter | Queue, register row, or history row arrives ordered | Fade + 4px rise, 150–200ms ease-out; **stagger** when many |
| Toggle | Preference or paid/unpaid flips clearly | Thumb/track 120–160ms ease-out; optional 1-frame overshoot ≤2% |
| Toast / banner | Soft success or refusal notice | Slide or fade from edge, 200ms ease-out; hold; exit faster than enter |

Reuse the same timing curve across roles so resident, gate, warden, and provost feel like one product. Gate stays fastest: never let motion delay a scan result.

### Stagger rule (do not skip)

When many elements animate (list rows, chip groups, stacked cards, staggered toasts), **stagger entrances and exits**. Short delays (about **30–60ms** between siblings) keep the UI ordered. Simultaneous motion on a long list feels chaotic; a cascade feels calm. Cap total stagger so the last item still finishes within ~400–500ms of the first. Do not stagger primary gate scan feedback.

### Timing and accessibility

- Default curve: short **ease-out** (or a soft spring only for sheets). Prefer 80–300ms for feedback; longer only for screen transitions.
- One motion job per interaction. Do not stack fade, scale, rotate, and color shift on the same control.
- **Respect reduce-motion / reduced-motion:** instant cuts, no stagger delays, no decorative enter animations. Still show the final state clearly (chip, toast copy, gate result).

**Forbidden:** parallax hero headers; looping Lottie on home; confetti on approve; continuous shimmer; neon or circuit-board motion; childish overshoot on institutional screens; motion that delays a gate result.

---

## 7. User workflows to design next

Mapped from the live contract (`openapi.yaml` / `docs/api.md` / `docs/database.md`) and confirmed against `reference/demo/` + prototype shots. Actors: **resident**, **gate**, **warden**, **provost**. Emergency is **not** a v1 workflow.

### 7.1 Auth

| | |
|---|---|
| **Actors** | Anyone with a hall-issued account |
| **Goal** | Sign in, stay signed in, change password, sign out |
| **API** | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`, `POST /auth/change-password` |
| **Screens / steps** | 1) Username + password (resident username = enrolment number). 2) Route by `role` from `/auth/me`. 3) Change password (settings or forced after provost reset). 4) Sign out revokes refresh. |
| **Critical states** | Wrong password; unknown user; suspended account; expired session → re-auth; temporary password after reset |
| **Success** | Correct shell for role with valid tokens; no public sign-up |

### 7.2 Homepage / home (by role)

| Role | Goal | Key screens | Critical states | Success |
|---|---|---|---|---|
| **Resident** | Know presence; start outing / permission / guest; open hall pass or history | `GET /me/home` hub: name, room, presence chip, open outing or active permission summary, CTAs: Plan outing, Request permission, Guest stay; tiles: Hall pass, History | Inside idle; planned ready to leave; outside with expected return + grace; pending permission; approved usable; suspended (read-only messaging) | One glance answers “where am I?” and the next action |
| **Gate** | Ready to scan; see recent activity | Dark home: primary Scan; list from `GET /gate/activity`; entry to guests | Idle; last result flash | Thumb on Scan in <1s |
| **Warden** | Hall pulse | Register summary counts; shortcuts to Late, Permissions waiting, Guest stays waiting | Quiet night vs busy late list | Counts match `/register/summary` |
| **Provost** | Same as warden + office entry | Warden home + Hall office | (none) | Office reachable without burying register |

### 7.3 Permissions (resident + staff)

| | |
|---|---|
| **Actors** | Resident requests; warden or provost decide |
| **Goal** | Late-night or home going approved before exit |
| **API** | Resident: `/me/permissions*`. Staff: `/permissions`, `/permissions/{id}`, `/permissions/{id}/decision` |
| **Resident steps** | List own → Request (type, place, reason, departure, expected return) → Pending detail → Approved (show when usable) / Rejected / Cancel (pending or approved unused only) |
| **Staff steps** | Queue (default pending) → Detail → Approve or Reject with reason if required by API |
| **Critical states** | Pending; approved unused; `in_use` (cancel forbidden); expired unused; rejected; permission_required when ordinary plan is past hours |
| **Success** | No exit on permission until approved + gate scan inside use window (`permission_early_minutes`) |

### 7.4 Register / attendance board

| | |
|---|---|
| **Actors** | Warden, provost |
| **Goal** | Who is inside, outside, late; drill into a resident |
| **API** | `/register/summary`, `/register/residents`, `/register/residents/{id}`, `/register/late` |
| **Screens** | Summary counts (hall + per block) → Filterable list (search name/room, block) → Late list → Resident record (open outing detail when outside: place, exit, expected return, grace, type, guardian told) |
| **Critical states** | Empty late; heavy late; outside within grace vs late; suspended excluded from presence counts |
| **Success** | Duty warden can answer “is she in?” and “who is late?” without spreadsheets |

### 7.5 Guest stays

| | |
|---|---|
| **Actors** | Resident hosts; warden/provost review + payment; gate arrival/departure |
| **Goal** | Paid guest in hall for dining/register without a hall pass |
| **API** | Resident `/me/guest-stays*`; staff `/guest-stays*` + payment; gate `/gate/guests*` |
| **Resident steps** | Apply (≥ `guest_min_lead_days`, ≤ `guest_max_inclusive_days`) → Pending → Approved / Rejected → Cancel before arrival |
| **Staff steps** | Queue → Decide → Mark paid/unpaid |
| **Gate steps** | Expected list → Record arrival → In-hall list → Record departure |
| **Critical states** | Waiting; approved unpaid (gate must not admit per contract: approved **and** paid); in hall; should-have-left; departed |
| **Success** | Dining/register guest counts move only on gate arrival/departure |

### 7.6 Gate: hall-pass scanning

| | |
|---|---|
| **Actors** | Gate (also warden/provost may scan) |
| **Goal** | Record exit or return from permanent QR; never double-undo |
| **API** | `POST /gate/scans`, `GET /gate/activity` |
| **Screens** | Scan CTA → Camera / viewfinder (no confirm button) → Full-screen result (exit / return / refusal) → Auto back to ready; activity list |
| **Critical states** | Exit recorded; return recorded; already outside (duplicate window); no plan / outside ordinary hours / permission not usable; resident suspended; pass unknown |
| **Copy** | Prefer API `message` (e.g. already outside; present same pass on return) |
| **Success** | Correct presence flip; second scan inside `scan_duplicate_window_seconds` refused; resident uses same QR both ways |

**Resident side of the same loop:** Plan ordinary outing (`POST /me/outings`) → Ready → `GET /me/hall-pass` QR → Gate scan → Home shows outside → Return scan → History lines.

### 7.7 Admin / hall office (provost)

| | |
|---|---|
| **Actors** | Provost only |
| **Goal** | Keep the hall’s people, places, and settings accurate |
| **API** | `/admin/settings`, `/admin/blocks`, `/admin/rooms`, `/admin/destinations`, `/admin/residents`, `/admin/staff`, password reset, hall-pass reissue, `/admin/register/export`, `/admin/sms`, `/admin/audit` |
| **Screens** | Settings (hours, grace, seasons, guest rules, SMS templates; show 12-hour + day-month as contract) → Blocks/rooms → Destinations → Residents (create/edit, suspend, reissue pass) → Staff → Password reset → SMS log → Audit → CSV export |
| **Critical states** | Destructive confirms (reissue pass invalidates old QR; reset revokes sessions); inactive destinations hidden from resident catalog but visible in admin |
| **Success** | Provost can run the hall without DB tools; export downloads; audit/SMS readable |

### 7.8 Explicitly not designing for v1

- Emergency alert flows (prototype wf6 / proposal only).
- Parent/guardian app.
- Payment gateway / amounts.
- Push notification product design (guardian SMS is backend; client local notifications optional later).
- Multi-role users.

---

## 8. Cross-cutting UI rules from the contract

- **Clock:** Asia/Kolkata, 12-hour, unpadded hour, two-digit minutes (`7:00 PM`).
- **Dates:** day + month name + year (`18 September 2026`); day zero-padded in formal date form per database doc.
- **Presence ≠ login.** Home shows hall presence from records, not “online.”
- **Ordinary outing** needs destination + expected return before exit scan; no warden approval.
- **Grace** copy should mention parent notify when still outside after grace. Do not invent SMS timing beyond settings.
- **One primary CTA** reflecting the state machine (plan vs show pass vs waiting vs outside).

---

## 9. Prototype inheritance

Keep from `reference/prototype` + `reference/demo`:

- Forest / paper / gold / night-gate split; extend with restrained resident dark tokens.
- Serif state headlines + sans work UI + mono codes.
- Permanent QR, gate full-screen results, register count strip.

Change vs prototype screenshots:

- Drop ALL CAPS chrome; use sentence case chips and headers.
- Drop Emergency workflow from the build plan.
- Curate HD icons/favicons per §5 instead of ad-hoc SVGs/emoji.
- Align every label and empty/error string with OpenAPI messages and database vocabulary.

---

## 10. Lock checklist

Before UI implementation starts, agree:

- [ ] Font trio via expo-font / Expo Google Fonts + case rules (§2)
- [ ] Palette tokens: light + resident/warden/provost dark + gate dark shell (§3)
- [ ] Spacing / radius / list-vs-card / RN elevation 0-2 (§4)
- [ ] Custom icon set + Expo app icon sizes (§5)
- [ ] Motion / micro-interactions budget + stagger rule (§6)
- [ ] No em dashes (U+2014) in product copy or this doc
- [ ] Workflow priority order for first sprint (recommended: Auth → Resident home/outing/hall pass → Gate scan → Register → Permissions → Guests → Office)

*End of design lock document.*
