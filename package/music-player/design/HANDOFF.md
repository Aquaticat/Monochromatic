# Local music player — full project handoff

You are picking this project up with **no prior context**. Everything known about it
is in this folder. Read in this order:

1. **HANDOFF.md** (this file) — what the product is, who it is for, current status,
   what to do next, and how the files work.
2. **review-notes.md** — the mistakes made so far and the standing instructions from
   the user. Read this before you build anything. **Everything in it is binding, not
   advisory** — standing standard 6: rules here are recorded absolutely and are never
   to be softened, hedged, or narrowed to the one candidate that prompted them (5f).
3. **decisions.md** — every settled decision, with the reasoning and what was rejected.
4. **open-questions.md** — what is unresolved, what was already tried, and what to build.
5. **md3-tokens.md** — verified Material Design 3 spec values and how to look up more.
6. **device-metrics.md** — real screen dimensions for the target device.
7. **candidates.md** — inventory of the ~45 exploratory files in candidates/.

---

## 1. What the product is

A **local-file music player** for people with **big local music libraries**, built for:

- **Android** — Jetpack Compose
- **Desktop** — macOS, Windows and Linux, in **Slint** (settled 2026-09-03, A4; the
  cost of hand-porting MD3 components to it was accepted explicitly)

**This is a product with users, not a personal tool.** The user, when an earlier
handoff called it one: "this isn't a one-person project. If it was just for me, I
wouldn't have needed to support 3 desktop platforms." Audience, in their words:
"people with big local music libraries." Read every decision in that light — see the
project-context note at the top of decisions.md for the five consequences that follow
(non-Latin folder names, defaults, accessibility, library sizes, theme).

It must present **one visual identity on every platform** — not a Mac-native look on
Mac and a Material look on Android. The user was explicit about this: parity is the
goal, and where the two platforms disagree the Android constraint wins (for example,
48dp touch targets apply on desktop too).

### What it is NOT

- Not a streaming client.
- Not a library manager. **There is no database and no tag reading.** The filesystem
  is the library: directories are the organising structure, filenames are the titles.
- No playlists. No queue. No "up next" list. No search field yet — Ctrl+F is
  **reserved** for one (D25), and a command bar with a configurable global hotkey is
  settled but undesigned (D21).
- **No album art, ever** (D19 — settled, not an accident; do not propose it again).

### The core loop

1. The user points the app at a **music directory** (one "Open" action).
2. That directory’s **subfolders are artist folders** — roughly **1,000 of them**,
   flat and name-sorted. The user browses them, or jumps by letter.
3. Choosing a folder lists its **tracks** as two-line rows: title on the first line,
   duration and true-peak value on the second.
4. Playback is **loudness-normalised by true peak**, which requires each file to be
   analysed once.
5. The app **restores the session on launch** — folder, track and playback position,
   restored **paused**. Because of this, Open is never a startup action; it is a
   mid-session action.

### The 1,000-folder rule (hard constraint)

~1,000 artist subfolders is the **design scale** (D30); 30 and 20,000 must not break
but are not drawn. Any folder surface MUST **cope** with the scale, never **list** it.
The picker is a filter (D17): a letter rail that adapts to the library's writing
systems (D28), and that letter's names as **plain text, several per line** (D31).

**The three NOs, all learned the hard way (D17, review-notes 5b/5d):**
1. No sub-letter segmentation in any form — no Ca / Ch / Cr, no tabs, no rail accordion.
2. No chip styling on the names — no pill, no fill, no outline. The wrapped
   several-per-line *layout* is right; only the styling was wrong.
3. No one-item-per-row lists — one, two or three columns alike. Rejected 4+ times.

A mock with twelve folders tells you nothing. **candidates/artists.js** has ~1,000
generated folder names, including non-Latin ones; use it.

### The first-run analysis (a real UX problem, not a detail)

True-peak normalisation must measure every file once. For a library this size that is
**about an hour of high CPU** — audible fans. It is pausable, it happens once, and
playback works normally throughout. The design must be honest about this without
making it feel like an error state. There is also a per-track fallback: if background
analysis is off, a track is measured just before it plays (well under a second).

---

## 2. How the work is done here

The user specifies and builds this; they are not the only person who will use it.
Specifics still beat opinions — they know the domain, the hardware and the habits
better than any design rationale does — but "what one person prefers" is no longer a
sufficient argument for a product decision. The working standards below are what the
project holds itself to.

- **Every number comes from a source.** Spec figures come from the token files
  (md3-tokens.md); device dimensions come from published hardware specs converted to
  dp (device-metrics.md). A remembered number is not a number.
- **Visual and behavioural questions get built, not described.** If the answer depends
  on how something looks or moves, make two or three real candidates and compare them
  side by side. Prose is for reasoning, not for evaluating layouts.
- **Design calls belong to the designer.** Bring a recommendation and the reasoning
  behind it. Choices that only the owner can make — their library, their hardware,
  their habits, what they find annoying — get asked.
- **Every option carries pros, cons and my own pick, written as a LIST** — in the chat
  message, in the form subtitle, AND in the caption printed inside the candidate file,
  because the user may be reading any of the three (review-notes standing standard 6).
  A flat menu of equally-weighted options is an unfinished presentation.
- **Every question form ends with a free-text field — no exceptions** (review-notes
  standing standard 1, and 5e for the two times it was broken). Options are always a
  partial guess at the problem space. Most of this project's sharpest decisions came
  in as free text, not as a picked option: tabletop-c, true black, the argument against
  a bespoke design system, the Todoist-style undo toast, the four-answer first-run
  prompt, and the correction that "no chips" meant the styling and not the wrapped
  layout. Write that field into the form first, so it cannot be dropped at the end.
- **Every design-question round is one self-contained HTML form opened in Helium.**
  Embed its visual candidates, pros, cons, ranked recommendation and free-text field;
  require no external stylesheet, script, font or server. Render it, inspect it and
  exercise its answer controls before opening it for the user. Every device mock must
  use a raster captured at cited physical panel resolution, display at cited dp size
  at 100%, and show physical px, logical dp, current scale and a reset control. Never
  upscale a dp-sized bitmap. A chat-only round is not a delivered design question
  (review-notes 5i and standing standard 9).
- **Update this handover continuously.** Record every correction, answer, decision,
  candidate and verification result when it happens; never wait for the session end
  (review-notes standing standard 10).
- **Open threads get closed as a set.** Half-answering a list and leaving the rest as
  prose wastes a review cycle.
- **Known defects get flagged, not buried.** Saying "this variant still reflows" costs
  one sentence; letting it be discovered costs the review.
- **Check every candidate against the recorded NOs before showing it.** Five picker
  candidates died to rules already written down (review-notes 5d). A rejection is
  recorded as a general NO, not as a nuance about one presentation.

---

## 3. Glossary

Terms used throughout these docs and in the candidate filenames:

- **transport block** — track title, seek slider, prev / play / next, a volume icon,
  and the mode control. Older notes call it "the deck"; the user did not know the word
  — say "transport block" to them. **Volume is no longer an inline slider row**: it is
  an icon button opening a vertical popover slider (D20).
- **mode control** — the four-way choice for what happens when a track ends:
  Repeat / In order / Shuffle folder / Shuffle all. This single control also defines
  end-of-folder behaviour, so there is no separate "what happens at the end" setting.
- **folder chip** — the pill in the top bar naming the current folder; tapping it
  opens the folder picker.
- **letter rail** — one column of 48dp letter targets, scrolls on its own; tapping a
  letter FILTERS the picker to it. **Generated from the library**, not fixed A–Z: only
  writing systems present get a section (Latin A–Z, Japanese kana rows + 漢, Cyrillic,
  Greek, Hangul, #), hairline-separated (D28). Replaces the earlier "jump strip" (a
  9×3 boxed grid the user rejected as "a keyboard").
- **picker** — the folder chooser: letter rail + that letter's names as **plain text,
  several per line, 48dp targets, nothing truncated** (D31). It never lists all
  folders, and the names are never pills.
- **dBTP** — decibels relative to true peak; the measured value shown per track
  (e.g. −1.2 dBTP).
- **seam / crease** — the fold line on the unfolded foldable display. **Nothing
  interactive may cross it**; a 16dp gutter runs down the middle.
- **cover screen** — the outer display, used when the device is folded (411×923dp).
- **tabletop posture** — the device half-folded like a laptop; Compose can detect
  this, desktop toolkits cannot.
- **outlined segmented button** — the mode control's component (D1, reversed from the
  connected button group on 2026-09-03): one 40dp container, hairline dividers, wraps
  2×2 with flush edges, all four options always visible.

---

## 4. Current status (updated 2026-09-04, resumed session 5)

**Continuation log.** The supplied archive now lives as the active
`package/music-player/design` workspace package. No new product decision has landed
in session 5 yet. The first grilling round was incorrectly sent as chat text; the user
required one self-contained HTML rendering opened in Helium instead. That correction
is now standing rule 9 in review-notes.md. The user also required this handover to be
updated as work proceeds; that is standing rule 10. The immediate next action is to
build, verify and open the self-contained light-theme questionnaire in Helium.
Imported screenshots and uploads were inspected for visible account, path and status-bar
identifiers; none were present. Their metadata was stripped before the package import
was committed. The self-contained grilling form now exists at
`questions/current.html`; package lint and unit-contract tasks confirm that its answer
fields are present and that it references no external stylesheet, script, font or
server. User-boundary verification rendered the form at 1280px and 390px with no
horizontal overflow or external resource request. A collapsed title/supporting-line
defect in the true-peak miniatures was fixed and re-rendered. Every radio, validation,
free-text, prepare, copy, download and clear path was exercised; the prepared and
downloaded answer matched `Q1 1c / Q2 3b / Q3 None.`. The light page stayed light
under a forced dark host. Axe reported zero WCAG A/AA violations; its remaining
incomplete result is contrast automation unable to resolve overlapping miniature
content, not a reported failure. The verified form was then opened through the Helium
desktop entry at its repository `file://` URL; the launch command returned success and
the Helium process is active. The user then reported that the nested HTML mockups in
the visible Helium form were not rendering correctly. The prior verification therefore
did not prove the user-visible nested layouts were complete; diagnosis is in progress
against Helium 0.15.6.1 (Chromium 151.0.7922.169). No theme answer has been recorded.
A CDP probe against the real Helium engine at its 1012×676 viewport reproduced and
measured the defects: both comparisons wrapped to two rows; each foldable used the
wrong 852:620 ratio instead of 852:883; each clipped seven descendants; and all six
visuals were hand-redrawn approximations rather than verified candidate renders. This
rules out a Helium-specific cause. Replace every nested mock with an exact candidate
render, keep each three-way comparison together, then rerun the same red probe. The
user added a standing requirement: every device mock in a questionnaire must be
zoomable to its cited target measurements. For this round, full unfolded candidates
must expose an 852×883dp view and half-screen detail studies must expose a 418×883dp
view, with current scale and reset controls visible. The six replacement renders now
come from `light-a/b/c` at 852×883 and `dbtp-a/b/c` reflowed to the measured 418×883
half-screen. They were captured through Helium, stripped of metadata and inspected in
two three-up contact sheets. `questions/current.template.html` owns the form;
`mise run //package/music-player/design:build` embeds those six PNGs into the
self-contained `questions/current.html`. Static lint and unit-contract tasks pass.
Re-verification in actual Helium at 1012×676 made the original red probe green: both
three-way comparisons stay on one row; all source images retain their exact 852×883 or
418×883 dimensions and aspect ratios; no nested mock markup, page overflow, or external
resource remains. At 390×844 both comparisons stay one row inside explicit horizontal
scrollers. All six preview buttons open; actual zoom measures exactly 852×883 or
418×883; Zoom in, Zoom out, Fit, Reset to actual, scrolling and Close work. Form
validation, every radio, free text, answer preparation, copy, download and clear also
work in Helium. Axe reports zero violations and zero incomplete checks for both the
page and open zoom dialog. The page remains light under a forced dark host. A
throwaway-worktree positive control replaced an 852×883 render with a 418×883 file;
the dimension guard rejected it with the expected diagnostic, while the unchanged
fixture passed. The corrected form was reopened through the Helium desktop entry at
its repository `file://` URL; the existing Helium session accepted the launch and its
process remains active. The user then reported that the reopened candidates look
blurry and correctly noted that the Pixel 9 Pro Fold is not a low-resolution device.
The prior capture conflated dp with source pixels: full candidates are only 852×883px
instead of the panel's 2076×2152px; half-screen studies are only 418×883px instead of
approximately 1019×2152px. A repeated PNG-header probe reproduces all six failures.
The package unit contract now asserts those physical source dimensions and fails on
the existing 852×883 file as intended. The question template exposes source px beside
logical dp and identifies rendered zoom size as CSS px. Re-render every source at
physical pixel density, preserve 852×883dp or 418×883dp as the 100% display size, then
rerun the Helium probe. All six source candidates have now been rerendered through
Helium at the panel scale `2076 / 852`: full renders are 2076×2152px and half-screen
renders are 1019×2152px. Metadata was stripped, the self-contained form was rebuilt,
and the physical-dimension regression is green. Both three-up contact sheets were
inspected and retain the intended candidate differences. The zoom dialog now exposes
a Native source control and caps enlargement at the source-to-host pixel ratio so it
cannot voluntarily upscale the raster. User-boundary Helium verification remains
before reopening. No theme answer has been
recorded.

**Phase: theme work. Decisions are nearly all closed; two theme picks and a large
amount of light-theme drawing remain.**

**A Material Design 3 design system is now formally bound to the project** at
`_ds/material-design-3-design-system-…/`. Its token sheets are also copied to
`candidates/_ds/…` so candidate files can link them without `../` traversal. Three
things a new session must know about it:

1. **It is authoritative for every role except the dark surfaces.** True black (#000)
   is a standing rule and beats MD3's dark `surface` role (#141218); the five
   surface-container values are this project's own (D32).
2. **Its dark scheme lives under `[data-theme="dark"]`, and the HOST sets that
   attribute on `<html>`.** Custom properties inherit, so a light design built on
   `var(--md-sys-color-…)` renders dark on a dark-mode host. Every design must pin its
   scheme inline on its own root element (review-notes 5g).
3. **Only the surviving candidates get rebuilt on it** (D33): unf-j, pk-g, first-run-a,
   toast-a, scan-ef, plus everything new. The other ~60 keep their hand-inlined values.

Settled in session 4: dark ramp = the project's own, measured down from black (D32);
retrofit scope (D33); true black restated as a standing rule (B1, review-notes 6).

**Open and waiting on the user — built, nothing implemented:**
- **Light theme separation:** `light-a` / `light-b` / `light-c`. My read: 1c.
- **Secondary text in light:** `dbtp-a` / `dbtp-b` / `dbtp-c`. My read: 3b.
- **Order of remaining work.** My recommendation: cover screen, then accessibility,
  then the command bar.
See open-questions.md #11 for the full pros/cons of each.

**Biggest unbuilt area is still the light theme**, and it is bigger than the two picks
above: only the unfolded screen and track list exist in light. The cover screen, error
bar, undo toast, settings pane, context menu, first-run prompt and scan bar all
hard-code dark values (open-questions 11d).

**Best current files:** `candidates/unf-j.dc.html` (assembled unfolded screen, every
session-3 decision applied), `candidates/pk-g.dc.html` (picker presentation, D31),
`candidates/dark-b.dc.html` (the chosen dark ramp), `candidates/light-abc.dc.html` and
`candidates/dbtp-abc.dc.html` (the two open picks, three-up), `first-run-a`, `toast-a`,
`scan-ef`.

**How session 4 went, and what to do differently.** Nine forms, five re-asked, none
because the user changed their mind — three were failures of checking rather than of
design (review-notes 5h has the tally and the three pre-flight checks that would have
caught them). The user's closing note: "I think we both might not be feeling well
today, given how many mistakes we made." Read review-notes 5d–5h before building
anything: rejected patterns kept returning because rejections had been recorded as
nuances instead of as absolute NOs.

---

## 4b. Previous status (end of session 3)

**Phase: decisions largely closed; the light theme is the big unbuilt area.**

Settled in session 3 (decisions.md D19–D31, A4, B1 revised, D8 revised):
- No album art, ever (D19). Volume = icon + vertical popover everywhere (D20,
  revises D18/D14). Command bar: configurable global hotkey, off by default (D21).
- Desktop scrollbar always visible, letter rail has none (D22). No folder counts (D23).
- Track order = tag track number, filename fallback (D24). Ctrl+F reserved for search,
  Ctrl+O opens the picker (D25) — the whole map still needs an IntelliJ-alignment pass.
- Scan indicator = scan-F: 56dp bar, count + always-rendered fixed-width Pause (D26).
- First run opens the system music library (MediaStore / XDG_MUSIC_DIR) and **asks
  before analysing**, four answers: Scan once / Always scan / Dismiss once / Dismiss
  forever (D27).
- Picker rail adapts to the library's writing systems (D28); names are plain text,
  several per line, no chip styling (D31).
- Undo is a compact Todoist-style toast that floats above the error bar (D8, D29).
- Theme follows the OS; dark stays true black (B1 revised). Desktop toolkit = Slint (A4).
- Design scale ~1k folders; small/huge degrade gracefully, undrawn (D30).

**Best current files:** `candidates/unf-j.dc.html` (the assembled unfolded screen,
every session-3 decision applied — start here), `candidates/pk-g.dc.html` (the chosen
picker presentation, D31), `candidates/first-run-a.dc.html`
(first-run prompt + the chosen scan bar), `candidates/toast-a.dc.html` (undo toast over
the error bar), `candidates/scan-ef.dc.html` (scan E vs F — F chosen).

**Biggest unbuilt area: the light theme.** "Follow the OS" means a light scheme is
required, and not one light surface exists in this project. The true-black scheme leans
on outlines where lightness would normally separate surfaces, so it does not translate
by swapping tokens.

**Also open:** command bar surface; keyboard map IntelliJ pass; accessibility pass
(focus order, screen-reader labels, reduced motion); Android media notification;
MD3-on-Slint feasibility; cover screen still needs D1/D18/D20/D31 applied; the
reviewer-sharing question (bundles) was never answered.

---

## 4c. Previous status (end of session 2, kept for history)

**Phase: exploration nearly closed; assembly begun. One assembled surface exists.**

Settled this session (all in decisions.md, D1 and D5–D18):
- Picker = filter, never a list (D17). Letter rail one column, scrolling; no
  sub-buckets ("we don't need this as tabs").
- Subfolders = header rows inside one flat list; parent's tracks first (D5/D6).
- Mode control = outlined segmented button, always four visible (D1 reversed).
- Transport block LEFT under the picker; tracks fill the right half (D16).
- Transport block centred/balanced layout (D18).
- Cover screen = full player, volume kept (D14).
- Colour roles verified against the design-system token files; three hexes fixed
  (md3-tokens.md).

**Best current files:** `candidates/unf-h.dc.html` (assembled unfolded screen),
`candidates/cover-c.dc.html` (cover — still carries the OLD connected group and
left-hugging transport; needs D1/D18 applied), `candidates/desc-g.dc.html`
(one-half flat list + transport, the reference for the transport block),
`candidates/scroll-a.dc.html` (scrollbar proposal, unanswered).

**Unanswered when the session ended:**
1. Scrollbar spec (open-questions.md 3b) — form was posted; the user closed it to ask
   about sharing instead. Re-ask by showing scroll-a, not in words.
2. Sharing with an outside reviewer (a professor; email blocks zips, Crowdcast is
   screen-share only). Proposed: self-contained single-file HTML bundles of unf-h,
   cover-c, desc-g, scroll-a, Decisions.dc.html — or one stacked review page. **The
   user has not yet said which.** Use the "Save as standalone HTML" skill
   (`super_inline_html`; each file needs a `<template id="__bundler_thumbnail">`).
   Warn that some mail filters strip .html too; Drive/Dropbox link is the fallback.

**Reviewer feedback (a professor, 2026-09-03) — NOT yet built, NOT yet accepted by
the user as decisions; treat as strong input and build candidates for each:**
1. **Volume → icon, vertical popover.** The volume slider leaves the transport block;
   a speaker icon opens a vertical slider only when clicked (YouTube's model). Reopens
   D18's transport layout and D14 ("volume kept" on the cover — the question there
   becomes whether the popover is enough).
2. **Command bar (⌘/Ctrl-Shift-style, "dshift").** A type-to-act bar over the app —
   jump to folder, switch mode, seek, settings. Must be **configurable to trigger
   globally** (system-wide hotkey when the app is in the background). Desktop-first;
   check what Slint/Compose allow for global hotkeys before promising it on Android.
   Interacts with F1 (keyboard map) and D3/D17 (the picker) — a command bar may be the
   better way to reach 1k folders on desktop.
3. **Sub-dir names must not be a wall of chips** — the wrapped-chip picker (unf-h)
   was called overwhelming. D17's *filter* principle stands; its *presentation* is
   reopened. Try: a plain single column within the filtered letter (only ~20–70
   names, so a column is fine here — the objection to columns was to listing all
   1,000), two columns, or a denser 40dp list. Build 2–3 and show them.

**Lessons this session (all in review-notes.md 5b/5c, read them):**
- "Handle 1k folders" means COPE, never LIST. Cost four rejected candidates.
- Device candidates must render in a fixed device-size frame scaled to fit (pattern in
  unf-h / cover-c / desc-g). The preview otherwise stretches them.
- Ask by demo, never by prose, for anything visual — the user sent back a whole
  question round with "I'm not seeing any visual demos?"
- Look critically, not just look: desc-f was screenshotted and still shipped unbalanced.
- html-to-image screenshots don't show scroll position or React-driven state changes
  from injected scripts; probe with console.log instead.
- Don't use project shorthand with the user ("deck" → "What is deck?").

---

## 5. What to do next, in order

0. **Get the two open picks** (light separation, secondary text) — both are built and
   waiting; do not start light-theme work on the other surfaces until 11a is answered,
   because it decides how every one of them separates its panes.
1. **Apply D1 + D18 + D20 + D31 to cover-c** → cover-e. It still carries the old
   connected button group and the left-hugging transport. (unf-j is done.) It still carries the old
   connected button group and the left-hugging transport.
2. **Draw the light theme.** Start with one surface (the unfolded screen), because the
   outline-carries-separation trick has to be re-solved, not re-tokenised. Then the
   picker, the error bar and the toast, whose colours are all dark-specific.
3. **Design the command bar** (D21): what it searches, how it relates to the reserved
   Ctrl+F search, and the Settings row for the global hotkey (Settings goes to four
   rows — check that D11's "the pane is short" claim still reads honestly).
4. **Keyboard map, one IntelliJ-aligned pass** (D25) — bring back a single revised
   map, not binding-by-binding questions.
5. **Accessibility pass** — focus order, screen-reader labels for the transport, rail
   and popover, reduced motion.
6. **Assemble the rest** from locked decisions: empty state (empty-a, now narrower in
   scope after D27), settings (settings-a + the hotkey row), context menu (ctx-b),
   error bar (err-b), then a desktop window (ask the size first).
7. **Android media notification** — never designed.

### Suggested skills for the next session
- **Save as standalone HTML** — for the reviewer bundles.
- **Hi-fi design** / **Options** — when assembling the remaining surfaces.
- **Make tweakable** — only if the user asks for switches in the assembled screens.
- **Web research** — for any further spec value not in md3-tokens.md (Compose
  Material3 source on GitHub: androidx/androidx, `compose/material3/material3/src/
  commonMain/kotlin/androidx/compose/material3/`).

## 6. How the files work

- Designs are **Design Components**: single `Name.dc.html` files that open directly in
  a browser and can be imported by other DCs. Everything in candidates/ is one.
- **Styling is inline only.** No stylesheets, no CSS classes. The only thing allowed in
  a `<helmet><style>` block is what cannot be inline: font `@font-face`/`<link>`,
  `@keyframes`, and body resets.
- **Layout pattern that works** (and the bug that bit this project): the root uses
  `height:100vh` with `display:flex; flex-direction:column`, and every scrolling child
  gets `flex:1 1 auto; min-height:0; overflow:auto`. Using `height:100%` on the root
  silently collapses the layout because nothing above it has a height.
- **candidates/artists.js** exports ~1,000 artist folder names plus helpers. Use it
  through the logic class rather than hand-typing folder lists.
- **candidates/support.js** is generated runtime plumbing. Never edit it.
- Fonts: Roboto (400/500) via Google Fonts, matching MD3’s default typeface.
- Preview sizes are declared per file in its props as `$preview: {width, height}`.
  For device layouts these are set to the real dp figures.

## 7. File map

```
HANDOFF.md            this file
review-notes.md       mistakes made + standing instructions from the user
decisions.md          settled decisions, with rationale and rejected options
open-questions.md     unresolved threads, with what to build
md3-tokens.md         verified MD3 spec values + how to read more from the repo
device-metrics.md     Pixel 9 Pro Fold real dimensions and layout implications
candidates.md         inventory of candidates/ with verdicts
Decisions.dc.html     visual decision summary shown to the user
candidates/           ~45 exploratory Design Components
candidates/artists.js ~1,000 generated artist folder names (USE THIS)
uploads/              the user’s own mockup, screenshots and reference images
```
