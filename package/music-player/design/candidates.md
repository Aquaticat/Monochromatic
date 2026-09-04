# Candidate inventory

66 files in **candidates/**. Every one is a standalone Design Component (.dc.html)
that opens in a browser at its declared preview size. Each demonstrates exactly one
question. Verdicts come from the user unless marked otherwise.

All candidates were retro-fitted with verified MD3 values (72dp two-line rows, 40dp
segmented buttons, 4×44 slider handles on 16px tracks, circular transport buttons,
max-content segmented controls) **except** md1, md2, md3-expressive and the id-* files,
which were left as historical style comparisons.

---

## Support files (not designs)

- **artists.js** — ~1,218 generated folder names plus helpers (`bucketOf`, `LETTERS`,
  `scriptOf`, `SCRIPT_LABEL`, `grouped`). Now includes **non-Latin names** (Japanese,
  Cyrillic, Greek, Hangul) — real libraries are not Latin-only. **Use this in every
  folder demo.** Forgetting the scale rule has caused six rejections.
- **buckets.js** — `railFor(names)` builds the adaptive rail (D28): only writing
  systems present get a section; cells are single letters / kana rows. It deliberately
  does **no** sub-letter splitting — that was killed (D17).
- **support.js** — generated Design Component runtime. Never edit.

---

## CHOSEN — these define the product

| File | Size | What it shows |
|---|---|---|
| **mode-d** | 860×620 | The mode control question settled: connected button group (56px, 2px gaps, pill outer ends, 8px inner corners, selected inner corners 50%) in one row and wrapped to a grid, with the outlined segmented button (40px) shown beneath for comparison. All at real token values. |
| **light-c** | 852×fill | D34 light baseline: tonal panes on a surface-dim ground, with one white rail-seam divider. |
| **dbtp-a** | 426×883 | D35 default supporting line: duration and true peak share `onSurfaceVariant`; custom display templating will own optional emphasis. |
| **sub-a** | 860×600 | A folder containing subfolders: subfolders in a labelled section above the folder’s own tracks, one screen, mixed content. |
| **ctx-b** | 860×600 | Track context menu, eight items in three groups, headed by the track name, dB value inline, Re-analyse, Move to trash. |
| **err-b** | 860×520 | Missing file drops out of the list with a dismissible bar explaining it; folder renamed mid-playback changes nothing visible. |
| **empty-a** | 860×600 | Nothing open: explains the hour-long first analysis up front, with Open a folder and Settings. |
| **settings-a** | 860×600 | Three flat switch rows; says out loud that the pane is short. |
| **tabletop-c** | 860×600 | Tabletop posture: the track list stays continuous and only the crease row moves. The user’s own proposal. |

---

## Conventions added in session 4

- **Every option candidate prints its own PROS / CONS / MY READ** in the caption bar
  at the bottom of the frame (review-notes standing standard 6). The same text goes in
  the form's question subtitle and in chat — the user may be reading any of the three.
- **A theme study pins its colour scheme inline on its own root element** and links the
  token sheets from `candidates/_ds/…` (copied there), never `../_ds/…`. The host sets
  `data-theme="dark"` on `<html>`; inheriting it silently inverts a light design
  (review-notes 5g).
- **Light studies sit on a light desk**, dark studies on a dark one, and frames fill
  the viewport height rather than floating in dead space.

## ROUND 9 — theme work (all built on the bound MD3 bundle)

| File | Size | What it shows |
|---|---|---|
| **light-a** | 852×fill | Light theme, all-tonal: surface ground and tracks, surface-container-low picker, surface-container transport, surface-container-high rail. No dividers. |
| **light-b** | 852×fill | Light theme, one surface role plus 1dp outline-variant dividers at pane, rail, and row boundaries. |
| **light-c** | 852×fill | **CHOSEN (D34), revised:** surface-container panes on a surface-dim ground, with one white rail-seam divider. |
| **light-abc** | 3-up | All three side by side for comparison. |
| **dark-a** | 418×fill | REJECTED — MD3's own dark container ramp above #000; the panes read as grey cards floating on black. |
| **dark-b** | 418×fill | **CHOSEN (D32)** — the project's own ramp measured down from black: #000 / #0A0A0D / #121216 / #1A1A1F / #22222A. |
| **dark-ab** | 2-up | Both, plus a swatch comparison of the two ramps. |
| **dbtp-a/b/c** | 426×883 | **3a CHOSEN (D35):** one on-surface-variant line, because planned display templating will provide user-selected emphasis. 3b strengthens true peak; 3c moves it to the trailing slot. |
| **light-a/b/c** | 852×fill | **1c CHOSEN (D34), revised with a white rail-seam divider.** |
| **candidates/_ds/** | — | Copied MD3 token sheets (palette, color, fonts, typography, shape, elevation, spacing, state) so candidate files resolve them without `../`. |

All light-side files are presented on a light desk with a light caption bar
(review-notes 5g); the dark pair keeps a dark one. For the active questionnaire, the
six `.dc.html` files are now historical design records rather than screenshot sources.
Branch `prototype/music-player-theme-compose` rebuilds the same six keys in native
Compose and captures them from the unfolded Pixel 9 Pro Fold emulator with Android
system bars. Prototype commit `8ec92ff7f` rebuilds them against the user-supplied
Material archive with Android dynamic color, role-mapped surfaces, two 414dp panes and
a 24dp spacer, baseline Material list items, real app bars, buttons, icons, slider and
one-row segmented control. It also retains 30dp edge-gesture insets inside full-bleed
section backgrounds. The left app bar now places `Open` beside `Folders` and removes
the redundant current-folder control; the right `Camellia` title supplies current
folder identity. The visible segmented labels are `Repeat`, `In order`, `Shuffle`,
and `Shuffle all`; accessibility labels expand each mode's full meaning. Native
1038 × 2152px right-half captures now include 12dp of pane spacer and the 414dp detail
pane. The letter rail begins at the physical start edge, while the app bar, source
actions, and transport retain their measured system-gesture insets. Selected folder
state uses primary text, medium weight, and a separate 2dp MD1-style indicator spanning
the bottom of the whole target; the text itself is not underlined. At 200% font scale,
the mode
control changes from one non-wrapping segmented row to four full-label Material radio
rows rather than clipping text. The latest comparison captures are integrated into the questionnaire. The user's
settled baseline combines `light-c` with a white rail-seam divider and `dbtp-a`; that
combined result must be recaptured after D34 and D35 are applied.

## ROUND 8 — verdicts in

| File | Size | What it shows |
|---|---|---|
| **unf-j** | 852×883 | **Current best unfolded screen.** unf-i + D31 names (plain text, several per line, primary + underline on the selection) and the D28 adaptive rail built from buckets.js. Every session-3 decision applied. Supersedes unf-h and unf-i. |
| **pk-h** | 418×883 | Rejected: 14px with middot separators (2.0 screens vs 2.2). Denser, but reads as running text rather than a set of targets. |
| **pk-g** | 418×883 | **CHOSEN (D31).** | **The picker presentation proposal (D31).** Plain 16px text, several names per line at natural width, 24dp gaps, 48dp targets, nothing truncated, selection = primary colour + 2dp underline. No pill, no fill, no outline. This is unf-i's layout with the chip styling removed. Extent counter is measured off the DOM (C = 2.2 screens, worst letter S = 2.5), not estimated. |

## ROUND 7 — verdicts in

| File | Size | Status |
|---|---|---|
| **scan-ef** | 2×411×923 | **scan-F CHOSEN (D26)** — right frame: 56dp bar, count + always-rendered fixed-width Pause, no reflow. scan-E (left, 2dp bottom-edge line, no text or control) rejected as too little for an hour-long job. |
| **first-run-a** | 411×923 | **Settled behaviour (D27).** Auto-opens the system music library and asks before analysing: Scan once / Always scan / Dismiss once / Dismiss forever, all 48dp. Interactive — walks into the scan-F bar, the dismissed state and always-scan. |
| **toast-a** | 411×923 | **Settled behaviour (D29).** Undo as a content-width toast floating above the error bar, both visible; it lifts and drops with the bar. Tap rows to trash, × to dismiss the bar. |
| **unf-i** | 852×883 | Superseded by unf-j. unf-h + D20 volume popover, D23, D24 — but still chip-styled names. |
| **pk-a** | 418×883 | REJECTED — one name per 48dp row, single column. The long-scroll failure again. |
| **pk-b** | 418×883 | REJECTED — two columns of one-name rows. Same failure, halved. |
| **pk-c** | 418×883 | REJECTED — same column with hairline dividers. Same failure. |
| **pk-d** | 418×883 | VOID — bounded the extent by re-introducing prefix ranges (Ca / Ch / Cr) as a rail accordion, which D17 had already killed, and kept chip styling. Do not build on it. |
| **pk-e** | 418×883 | REJECTED — three columns of one-name rows, plus truncation. |
| **pk-f** | 418×883 | REJECTED — one full-width column bounded by a type-to-narrow field. Rows again; the field also pre-empts the reserved search (D25). |

## ROUND 6 — awaiting verdict

| File | Size | What it shows |
|---|---|---|
| **scroll-a** | 1100×640 | Scrollbar spec: A = Compose M3 nonInteractiveScrollbar exactly (fades); B = same look, interactive, always on (desktop); C = which surface gets which. Both lists live. |

## ROUND 5 — verdicts in

| File | Size | Status |
|---|---|---|
| **unf-g** | 852×883 | CHOSEN over unf-f: transport left under the picker, tracks right. |
| **unf-h** | 852×883 | unf-g + desc-f's outlined segmented control + desc-g's rebalanced transport; bucket chips removed on request. **Current best unfolded screen.** |
| **desc-f** | 418×883 | CHOSEN over desc-e: outlined segmented button, all four always visible. Called "un-balanced" → desc-g. |
| **desc-g** | 418×883 | desc-f rebalanced (D18). |
| **desc-e** | 418×883 | Rejected: connected button group. |
| **unf-f** | 852×883 | Rejected side (transport right); picker itself accepted. |

## ROUND 4

| File | Size | What it shows |
|---|---|---|
| **unf-f** | 852×883 | Picker that copes with 1,218 folders without listing them: letter rail → optional 2-letter bucket chips → wrapped content-width chips, ~one screen max. Interactive. Deck right. |

## ROUND 3 — rejected (unf-d/unf-e still one folder per row)

| File | Size | What it shows |
|---|---|---|
| **unf-d** | 852×883 | Folders in one column with letter headers; 48dp fast-scroll RAIL with drag bubble; deck right. |
| **unf-e** | 852×883 | Same, A–Z as borderless text index under the list (48dp invisible targets). |
| **desc-d** | 418×883 | Subfolders as headers in one flat list; ▶| walks playback down it. Implements D5/D6 as clarified. |
| **cover-c** | 411×923 | CHOSEN (D14). Reframed at fixed device size. |

## ROUND 2 — verdicts in

| File | Size | What it shows |
|---|---|---|
| **unf-b** | 852×883 | REJECTED — letter grid reads as a keyboard. Unfolded, deck RIGHT. ~1,218 folders (artists.js) in two columns of 48dp rows with letter headers + counts; 27-cell A–Z strip (48dp) pinned at the bottom of the left half, tap to jump; total folder count in the header; tracks + deck right; 16dp seam. Interactive. |
| **unf-c** | 852×883 | REJECTED (same grid). Same file, deck LEFT under the folders and strip; tracks take the whole right half. Known cost: at 883dp the folder list gets ~340dp (≈7 rows) before scrolling. |
| **cover-c** | 411×923 | Cover screen, full player: chip + Open top, track list, deck at the bottom (thumb reach), volume inline, mode group 2×2. Verified at 411 wide. |
| **cover-d** | 411×923 | REJECTED. Cover screen, controls only: 88dp play, 64dp prev/next, mode group, no volume (hardware keys), list behind one 72dp "Tracks" row. Verified at 411 wide. |
| **desc-a** | 418×883 | SUPERSEDED by desc-d (wrong model of subfolders). Descend demo, interactive (▶| steps playback): the list FOLLOWS into the subfolder; chip becomes a breadcrumb; "Up to Camellia" row. |
| **desc-b** | 418×883 | SUPERSEDED. Same demo: the list STAYS; only the deck subtitle names the subfolder ("Live · 1 of 3"). |
| **desc-c** | 418×883 | SUPERSEDED. Same demo: the list STAYS; the playing subfolder row takes the highlight with "Playing · track" beneath. |

All seven use the verified colour roles (md3-tokens.md): outline #938F99,
on-secondary-container #E8DEF8. The descend demos assume parent tracks play before
subfolders (unconfirmed — see open-questions.md #3).

## REJECTED or UNRESOLVED — needs rebuilding

| File | Size | Status |
|---|---|---|
| **unf-a** | 852×883 | Rejected (15 folders). Superseded by unf-b / unf-c. |
| **cover-a**, **cover-b** | 411×923 | Shown while broken, never verified. Superseded by cover-c / cover-d. |
| **keys-a** | 900×560 | Keyboard map draft. Never reviewed. |
| **scan-b** | 860×~540 | Scan indicator, reflow-free version — half of the intended behaviour. |
| **scan-d** | 860×~540 | Scan indicator, the other half (non-permanent). The settled version has never been built. |

---

## SUPERSEDED — keep for reference, do not build on

### Wrong-aspect fold layouts (all drawn in a landscape frame; the inner display is square)
- **fold-a** — single-column folder sidebar; contradicted the wrapped-target decision.
- **fold-b** — early split with a tweakable ratio.
- **fold-c** — deck spanning the full width (put the play button on the crease).
- **fold-d**, **fold-e** — interactive fold-state demos with props.
- **fold-f** — seam gutter introduced, controls left / tracks right, quiet left half.
- **fold-g** — folder grid fills the left half, deck moved bottom-right.
  fold-f and fold-g were the real O2 comparison and that comparison is void at the
  wrong aspect; the question (which half holds the deck) is still open.

### Cover screen at an invented size
- **o7-a**, **o7-b** — 370×760, a size with no source. cover-a/cover-b are their
  resized descendants.

### Moot — the question was already answered elsewhere
- **o6-a** — end of folder: playback stops, Play again / Pick another folder.
- **o6-b** — end of folder: rolls into the next folder with a NEXT chip.
  Both moot: the mode control (Repeat / In order / Shuffle folder / Shuffle all)
  already determines end-of-folder behaviour.

### Mode control explorations
- **mode-a** — detached pills, wrapping.
- **mode-b** — alternative detached treatment.
- **mode-c** — outlined segmented button built to match uploads/segmented buttons.png
  exactly (one container, content-width segments, wraps to a grid with flush rounded
  outer edges). **Keep: this is the fallback if the connected button group is dropped.**

### Folder picker explorations (the A–Z jump strip won)
- **picker-a** — letter section rows.
- **picker-b** — the jump strip (the direction that won).
- **picker-c** — persistent sidebar.
- **picker-d**, **picker-e**, **picker-f** — built at ~1,000 folders with real 48dp
  targets; **picker-f is interactive**. These are the best existing reference for
  handling the real folder count — read them before rebuilding unf-a.

### Row treatments (two-line won)
- **rows-a** — single line. **rows-b** — columnar. **rows-c** — two line (won).

### Design-generation comparison (MD3 baseline won)
- **md1** — Material 1 era. **md2** — Material 2. **md3** — MD3 baseline (won).
- **md3-expressive** — MD3 Expressive: asymmetric radii, heavier type, larger
  controls. Rejected for spending vertical space on personality.
- **md3-hybrid** — MD3 baseline with selected Expressive touches.

### Identity explorations (MD3 won)
- **id-fluent** — Fluent-flavoured. **id-protool** — pro-audio tool aesthetic.
- **id-own** — a bespoke in-house identity. Rejected on the user’s own argument: an
  in-house system means designing and maintaining every state by hand.

### Scan indicator explorations
- **scan-a** — known defect: the Pause button appears and disappears, so it is not
  reflow-free. **scan-c** — alternative treatment.

### Tabletop explorations
- **tabletop-a** — split at the hinge, list above / controls below.
- **tabletop-b** — posture-agnostic.

### Error handling
- **err-a** — errors in place: the dead row keeps its position, turns error-coloured
  and explains itself; the folder chip carries its own failure state. Rejected in
  favour of err-b’s cleaner list.

### Other paired alternatives and revised choices
- **o1-a** — originally chosen with Open beside a folder chip; superseded by D4's
  removal of that chip and placement of Open on the `Folders` app-bar line.
- **o1-b** — Open in the overflow menu.
- **sub-b** — drill-in navigation with breadcrumb and Up.
- **ctx-a** — four-item minimal context menu.
- **empty-b** — bare empty state, scan line in the bottom bar behind "Why?".
- **settings-b** — grouped cards with headers, plus the analysis-status row and
  Re-analyse. Worth revisiting only if decision D12 (status lives nowhere) changes.

---

## Reading order if you are new

1. **picker-f** — how ~1,000 folders and the jump strip actually behave.
2. **mode-d** — the component the whole UI hinges on, at real token values.
3. **sub-a**, **ctx-b**, **err-b**, **empty-a**, **settings-a** — the settled surfaces.
4. **unf-a** — the rejected unfolded layout, to see the structure being kept.
5. **uploads/music-player-mockup.html** — the user’s original proposal, which is the
   baseline this all started from.
