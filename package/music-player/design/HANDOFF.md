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
  upscale a dp-sized bitmap. Use a measured target-specific frame with opaque chassis,
  bezel, hinge and corner treatment; place the screenshot inside its screen opening;
  never clip it to reveal the questionnaire surface. A chat-only round is not a
  delivered design question (review-notes 5i and standing standard 9).
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
- **current-folder identity** — the right-pane app-bar title and selected plain-text
  target name the active folder. There is no separate left-pane current-folder button.
  `Open` shares the left `Folders` app-bar line and changes the directory.
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
  interactive may cross it**; the expanded layout uses the Material-required 24dp
  spacer down the middle.
- **cover screen** — the outer display, used when the device is folded (411×923dp).
- **tabletop posture** — the device half-folded like a laptop; Compose can detect
  this, desktop toolkits cannot.
- **outlined segmented button** — the mode control's component (D1, reversed from the
  connected button group on 2026-09-03): one non-wrapping Material row with four
  visible options, 40dp visual containers, 48dp targets, hairline dividers, and a
  checkmark plus color for selection.

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
a `1:1 display pixels` control and caps enlargement at the source-to-host pixel ratio
so it cannot voluntarily upscale the raster. Its labels distinguish logical dp, CSS
px, host display px and source px; 100% means one dp maps to one CSS px. A read-only
KWin window probe measured the user's visible questionnaire tab on output `DP-2` at
DPR 2, matching the Helium verification profile. At 100%, the full mock uses
1704×1766 display pixels backed by 2076×2152 source pixels. The new
`render:candidates` mise task reproduced every raster byte-for-byte through Helium CDP
and rebuilt the questionnaire, preserving a durable regeneration path. Before
reopening, the user caught another fidelity defect: real devices have no holes that
reveal what is behind them. The form clips both card and dialog images with CSS border
radii, and all three half-screen rasters place the questionnaire-like `#DED8E0`
capture background in their rounded corner pixels. The red probe names both clipping
selectors and measures those corner pixels as `rgb(221, 215, 223)`. Form-level image
rounding is now removed. `render:candidates` paints solid black device backing behind
rounded source frames; all three half-screen top-left pixels are now `rgb(0, 0, 0)`.
The package contract checks both conditions and is green. The user rejected this black
corner patch as insufficient and asked why the frame itself is not realistic. They
then supplied eight current Pixel 9 Pro Fold reference images in `~/Downloads`: four
JPEG views and four 2000 × 2000 WebP views. All eight were inspected together; the
straight-on unfolded JPEG was also inspected at source size. The images contain no
personal account, path, notification or status-bar data. The JPEGs do carry a visible
publisher watermark, so none of the references is embedded in the questionnaire.
Google's current hardware specification confirms the body and display dimensions;
`device-metrics.md` records the measurement and arithmetic.

The replacement frame is now implemented around all six candidates. At 100%, the
full frame is 907 × 937 CSS px around an exact 852 × 883dp screen opening. The Q2
frame is a 454 × 937 crop from the physical fold centre through the right outer edge;
it has a straight fold-side edge, 8dp of seam-facing display context, the exact
418 × 883dp candidate, and the real right chassis rather than four fake phone corners.
Both forms use an opaque graphite chassis, continuous black bezel, measured screen and
outer corner radii, top and bottom hinge caps, and a top-right 28dp inner-camera cutout.
The Q1 headers now reserve 56dp at the right so their menu buttons do not sit under the
camera. Candidate PNGs are rectangular screen content again; the frame owns all
physical clipping and never reveals the questionnaire surface inside the device.

All six candidates were regenerated through Helium at 2076 × 2152px or 1019 × 2152px,
then embedded into the form. Package unit checks pass. At DPR 2, Helium measures the
full dialog frame at 907 × 937 CSS px with an 852 × 883 screen and the right-half frame
at 454 × 937 with an approximately 418.02 × 883.02 candidate area. The scale labels
report 1704 × 1766 and 836 × 1766 display pixels respectively. A matching-scale
side-by-side inspection against the supplied 629 × 650 front reference confirmed the
silhouette, bezel, corner, camera and hinge placement. Three throwaway positive
controls also passed: the validator rejected a transparent chassis, CSS rounding on
the source raster, and the old half-screen inset. Before that verification finished, the user added: “Please do not forget the Android
bars.” The present candidate rasters do not yet show either system bar, so they are not
ready to reopen. Add measured Pixel/Android status and gesture-navigation bars inside
the 852 × 883dp screen coordinate system, keep the app UI and camera cutout out of each
other's safe areas, rerender all six candidates, and repeat verification. No theme
answer has been recorded. The user then supplied
`/var/home/user/Downloads/gsmarena_052.jpg`, a 1024 × 682 JPEG showing the unfolded
inner display head-on enough to verify the system UI. It visibly confirms a left-side
time and notification group, right-side connectivity and battery icons immediately
before the top-right camera, and edge-to-edge content behind that transparent status
area. It is a measurement reference only and carries a visible GSMArena watermark, so
do not embed it. Authoritative Pixel overlays and AOSP resources, not perspective in
the photograph, remain the source for implementation dimensions. The user also has
a working Pixel 9 Pro Fold emulator installed on this system. Exercise that emulator
before implementation and use live screenshots, `wm` metrics, display cutout data and
window-inset probes to validate the overlay-derived system-bar geometry; its unusual
launch path is an environment detail to measure rather than a reason to skip it. The
user then corrected the verification strategy: build the non-functional candidate UI
in Jetpack Compose, install it on the Pixel 9 Pro Fold emulator, and compare the
result there. Do not treat CSS drawings with simulated bars as sufficient. Use native
Compose edge-to-edge layout and live Android window insets, capture each visual option
from the emulator at the panel's 2076 × 2152px resolution, and use those captures in
the questionnaire only after side-by-side inspection. The user explicitly chose the
higher-fidelity delivery path: capture the Compose candidates and embed those emulator
screenshots in the self-contained HTML questionnaire. The old HTML Design Component
rasters are no longer the visual source for this round; keep their candidate files as
history, but point the questionnaire provenance and render pipeline at the Compose
captures. The live emulator is now verified in its unfolded posture: Android 17 API
37 reports a 2076 × 2152 display at 390dpi, a 36dp status-bar resource and frame, a
32dp gesture-navigation inset, and the Pixel overlay's 136px top-right cutout bound.
A 2076 × 2152 Settings capture shows the native large-screen gesture handle and status
icons. It also proves that `screencap` omits the physical camera hole even while Window
Manager reports the cutout, so the measured questionnaire frame must retain its camera
overlay. `device-metrics.md` records the commands, source paths, commit and arithmetic.
A debug-only, non-functional Compose prototype now implements all six candidate keys
in `android-app/app/src/debug/`: `light-a`, `light-b`, `light-c`, `dbtp-a`, `dbtp-b`,
and `dbtp-c`. It uses native `WindowInsets.safeDrawing` inside an edge-to-edge Android
window, so app controls clear the reported camera and system-bar insets while the
screen background continues behind both bars. The prototype is preserved on branch
`prototype/music-player-theme-compose` at commit `69607079b`; its
`prototype:capture` task builds, installs, waits for Compose to replace the Android
launch splash, and captures each key at panel resolution. All six variants installed
and rendered successfully on the unfolded emulator. An initial capture taken directly
after `am start -W` caught the launch splash, proving that activity launch completion
is not first-frame evidence; the task now waits until the UI hierarchy contains
`Camellia` before each screenshot. After the first native Compose captures,
the user said: “There isn't any reason to double-wrap the UI,” then identified the
problem in `/var/home/user/Pictures/Screenshots/Screenshot_20260904_153211.png`. The
annotated screenshot marks the physical screen/window background as wrapper 1 and the
full-height rounded track-pane card as wrapper 2. Remove wrapper 2: the full-height
track surface must fill its allotted right side and continue behind the native status
and navigation bars. Keep rounded containers only for distinct inner groups such as
the picker and transport, not around a pane that already occupies the screen edge.
The Compose prototype now does this for full and right-half candidates. Fresh captures
were inspected individually: the right track surface reaches the top, right and bottom
screen edges; the native status icons and large-screen gesture handle remain visible;
all app controls begin after `WindowInsets.safeDrawing`; and only the local picker and
transport groups retain rounded containers. The six corrected PNGs have been copied to
`questions/render/` for questionnaire integration. The questionnaire now embeds those
six native captures and names their Compose/emulator provenance in each image. Its
camera overlay now follows the overlay-derived 32.41dp cutout rather than the earlier
28dp photograph estimate. The retired Helium-to-PNG renderer is removed, so
`render:candidates` can no longer overwrite native captures with historical HTML
mocks. Package build, lint and unit-contract tasks pass. The contract checks capture
dimensions, opacity, native status and navigation pixels, rendered Compose content,
and the absence of the redundant right-pane wrapper. Three throwaway positive
controls prove those new guards: changing a native status-icon pixel yields
`questions/render/dbtp-a.png is missing the native Android status icons.`; changing
the lower screen-edge pixel yields `questions/render/dbtp-a.png still double-wraps the
full-height track surface.`; and replacing a selected-row pixel yields
`questions/render/dbtp-a.png did not replace the Android launch splash with Compose
content.`. Restoring the untouched fixture passes. Final Helium verification at DPR 2
is complete. At 100%, the full dialog frame is 907 × 937 CSS px around an
852 × 883px screen and a 2076 × 2152px source; the right-half frame is 454 × 937px,
its opening is approximately 426 × 883px, its image is approximately 418 × 883px, and
its source is 1019 × 2152px. The camera overlay measures 32.41dp, centred 36.61dp from
the screen end and 32.81dp from its top, matching the Pixel overlay arithmetic.

All six previews open with the correct title, frame kind and natural raster dimensions.
Zoom in, Zoom out, Fit, `1:1 display pixels`, 100% reset, stage scrolling and Close
work; both full and half sources stop at their sharp 1:1 display-pixel limit rather
than upscaling. At 1280 × 800, both three-option comparisons remain one row and the
page has no horizontal overflow. At 390 × 844, both remain one row inside independent
horizontal scrollers with a 316px viewport and 848px content, each traversing 532px,
while the page itself
stays 390px wide. The blank-form validation path focuses Q1 and keeps output hidden;
every radio path selects exactly one item per group. Prepare, copy, download and clear
all produce and then clear the synthetic `Q1 1c / Q2 3b / Q3 None.` result. The
browser accepted the clipboard write and a function-boundary probe received the exact
answer; the downloaded text file matched it byte for byte.

Offline reload leaves all six embedded images complete at the expected natural sizes
and issues only the local `file://` document request. Forced host dark mode leaves the
questionnaire's light scheme and surface colours unchanged. Helium reports no page
console errors. axe-core 4.13.0 reports zero WCAG A/AA violations and zero incomplete
checks for both the page and open dialog; labels, accessible button names, alternative
text, unique IDs, visible 48px control minima and initial dialog focus were also
checked directly. A final 629 × 650 matching-scale comparison against the supplied
front reference confirms the updated silhouette, bezel, hinge and exact camera
position. The isolated verification page was cleared and is ready to close; the
questionnaire was then opened through the Helium desktop entry in the user's normal
session. KWin reports a non-minimized `Music player design: grilling round 1 - Helium`
window at 1080 × 1880 on output `DP-2`; a one-shot KWin activation targeted that exact
window. The form is blank and ready for the user's real theme answers. No theme answer
has been recorded yet. The user then reported that the double-wrap defect remains on
the left side. The prior correction was too narrow: keeping rounded picker and
transport containers still places app-level wrappers inside the already bounded device
screen. Remove those left-side outer card shapes and surrounding screen margins too.
Picker and transport may retain their internal component shapes, but their section
surfaces must meet the left-half and screen boundaries without a second rounded frame.
Re-capture, re-embed, re-verify, and reopen the blank questionnaire before asking for
theme answers. Prototype commit `6e8f248c5` removes the left-side rounded surfaces and
outer inset: picker background now reaches the top and left screen edges, transport
background reaches the left and bottom screen edges behind the native navigation bar,
and only the settled 16dp inter-section and centre-seam gaps expose the window surface.
The background stays full bleed while its potential controls begin after the emulator's
73px, approximately 30dp, left and right back-gesture insets. All six corrected
candidates assemble, install and capture successfully. Individual inspection confirms
square section boundaries at every screen edge, one 39px inter-section gap, one 39px
centre seam, native status and gesture-navigation bars, and no remaining app-level
rounded wrapper. The corrected captures are copied into `questions/render/`, embedded
into the rebuilt form, and accepted by package lint and unit checks. Two fresh
throwaway positive controls prove the left-side guards: changing the top-left picker
pixel to the window colour yields `questions/render/light-c.png still double-wraps one
or more full-height screen sections.`; extending the window-coloured inter-section gap
by one pixel yields `questions/render/light-c.png must keep exactly one 39px
inter-section gap without outer margins.`. The restored fixture passes. Post-correction
Helium verification at DPR 2 is complete. Full-dialog screenshots at the top and bottom
of the 907 × 937px device show picker and transport meeting the left screen edge,
picker meeting the top, transport continuing behind the gesture-navigation area to the
bottom, and no rounded section wrapper on either side. The 39px inter-section gap and
39px centre seam remain deliberate separators rather than outer frames.

All six previews decode to the expected 2076 × 2152px or 1019 × 2152px source before
measurement. Full and half frame, screen, image and 32.41dp camera geometry are
unchanged and exact at 100%. Zoom in/out, Fit, sharp 1:1 display pixels, reset, stage
scrolling and Close pass again. Desktop and mobile one-row comparisons, page overflow,
independent mobile scrollers, offline loading, forced-light presentation, every radio,
blank validation, free text, prepare, copy, download and clear pass again. The copy and
download paths both receive `Q1 1c / Q2 3b / Q3 None.` in the synthetic probe, then
the form is cleared. axe-core 4.13.0 again reports zero WCAG A/AA violations and zero
incomplete checks on both page and dialog; direct label, accessible-name, alt, unique-ID
and visible-target checks pass. Helium page errors and console output are empty. A fresh
629 × 650 crop-based side-by-side comparison with the supplied front reference confirms
the complete frame after the left-side correction. The corrected blank form was then
reopened through the Helium desktop entry. KWin reports its new non-minimized
`Music player design: grilling round 1 - Helium` window at 1080 × 1880 on `DP-3`;
a one-shot activation targeted that exact window. It is ready for real theme answers,
and no theme answer has been recorded yet. The user then rejected the entire corrected
set because none of its designs follows all applicable Android, Google, and Material
Design 3 guidance. They supplied a local SingleFile archive rooted at
`/var/home/user/Downloads/m3.material.io/` as the required source. Treat this as a
cross-candidate compliance correction, not another visual-preference fork: audit the
archive, map the applicable rules to the current Compose implementation, rebuild every
candidate so each option is guideline-compliant, then recapture, re-embed, re-verify,
and reopen a blank questionnaire. Do not ask the user to choose among any knowingly
non-compliant designs. The archive audit is complete in
`material-3-compliance.md`. It identifies concrete cross-candidate failures: 16dp
instead of the expanded-layout 24dp pane spacer; no real app bars or page titles;
hand-built 56dp top rows; a single chip-like folder trigger; Unicode stand-ins instead
of Material icons; passive surfaces instead of icon buttons and selectable list items;
a two-row segmented control despite the explicit no-wrap rule; an unlabeled slider
without elapsed and duration anchors; mismatched selected-container color roles;
important dividers using `outline` instead of `outlineVariant`; manual typography;
fixed text heights and unexposed truncation; and a fixed baseline palette instead of
the settled Android dynamic scheme. The compliance boundary preserves baseline M3,
the full-bleed section correction, and all compatible product decisions while replacing
non-compliant construction with real Compose Material 3 components. Prototype branch
commit `978033ce5` implements the audit: Android dynamic light color with baseline
fallback; only named Material role mappings; two equal 414dp panes around the required
24dp expanded spacer; real default-height `TopAppBar`, buttons, icons, icon buttons,
interactive `ListItem`, `Slider`, and one non-wrapping
`SingleChoiceSegmentedButtonRow`; elapsed and duration anchors; selected-list
`primaryContainer` / `onPrimaryContainer` pairing; `outlineVariant` dividers;
Material typography; flexible list-item heights; official selection semantics; and a
trailing-text Q2 candidate that keeps every true-peak value instead of suppressing
most of them. Section backgrounds remain full bleed and actionable content retains the
measured Android safety insets. The prototype build and Android lint both pass with no
warnings. Independent review caught and corrected three pre-capture issues. The new
interactive `ListItem` overload was an accidental Expressive component, so latest
prototype commit `1eb5643e1` restores the baseline `ListItem` and scopes its deprecation
suppression to the A2 baseline decision. Material icons are debug-only rather than
inflating release builds. Transport targets now use the archived 8dp spacing guidance.
The right-half study is also corrected to the physical 426dp half: 12dp of the centred
spacer plus the 414dp detail pane, captured at 1038 × 2152px. The archive's baseline
list color figure explicitly enumerates `primary container` followed by
`on primary container`, confirming that selected pair. Before capture, record the
emulator's wallpaper-derived theme state; during inspection, measure all segmented
labels and verify selected-role pixels rather than inferring them from a successful
build. First capture exposed `Shuffle folder` clipping inside the one-row segmented
control. Prototype commit `12e99097d` changes its visible label to the untruncated
`Shuffle` while retaining `Shuffle current folder` as its accessibility label; the
other accessible labels also state their complete behavior. A second build and native
capture pass succeeded. UI Automator measures every button, letter, folder, track, and
segment action at 117px, exactly 48dp at 390dpi; the slider target is 107px, about
44dp high. All four mode labels are present within their segment bounds. Individual
and contact-sheet inspection confirms real app bars and icons, readable source actions,
one-row mode selection with checkmark and color, slider time anchors, full-bleed square
section surfaces, the 24dp centre spacer, and all three complete true-peak treatments.
The recapture task now rejects non-stock theme customization or a dark host, and it
requires every app bar, source action, transport action, mode label, and complete
accessibility label in the UI hierarchy before taking a screenshot. A repeated capture
changed only the native clock region; comparison below the 136px top system area found
zero changed pixels in all six images. The first captured set is integrated into the
rebuilt self-contained questionnaire. Package build, lint, and unit contracts pass.

The validator now checks 2076 × 2152px full sources and 1038 × 2152px physical-half
sources, opacity, region-based native status and navigation evidence, the pinned dynamic
role colors, selected `primaryContainer`, every full-bleed edge role, the exact 39px
inter-section gap, the exact centered 59px pane spacer, the 30px half-spacer crop,
outer-edge track fill, and Q2c's trailing true-peak values. Fresh throwaway positive
controls proved each new boundary: removing the selected role, one central-spacer
pixel, one half-spacer pixel, the trailing-value region, the status-icon region, or one
inter-section gap pixel produces its specific diagnostic. Restoring the captures
passes. Full Helium verification remains. During verification, the user added a fresh
accessibility correction: never communicate state through color alone, and explicitly
check color contrast. Re-audit every selected, playing, current, checked, and emphasized
state across all six captures. Add an unmistakable non-color cue wherever one is
missing, then calculate the resolved dynamic role-pair contrast rather than assuming
that use of a Material token proves the rendered combination. The user then corrected
the picker geometry: the letter rail must sit flush against the physical device edge,
matching Nova Launcher's rail, rather than beginning after the left system-gesture
inset. Move only the rail to the edge; keep other actionable picker content on its
Material and system safety rulers. Verify the Android gesture interaction rather than
assuming a visual move is sufficient. The accessibility re-audit found one real
failure: at 200% system font scale, all four one-row mode labels clipped. Prototype
commit `d1545e525` switches to four full-label Material radio rows at font scale 1.5 or
greater and makes the transport vertically scrollable within a 440dp maximum; a second
200% emulator capture shows `Repeat track`, `Play in order`, `Shuffle current folder`,
and `Shuffle all folders` completely. It also restores D31's underline on selected
`Camellia`, so that state now uses color, weight, and underline. Existing non-color
cues remain: play icon for the current track, checkmark for the selected default-scale
mode, circle for the selected rail letter, radio mark at enlarged type, and handle
position for slider value.

Runtime Android resource lookups and WCAG calculations are recorded in
`material-3-compliance.md`. Every actual text-role pairing is at least 4.532:1; the
lowest important non-text boundary is 3.868:1. The validator recalculates the full
role-pair set. Prototype commit `f54fc145d` then moves the 48dp rail targets to x=0
while leaving app-bar, source-action, and transport controls inset. An emulator vertical
swipe from x=20px, inside the 73px Back region, scrolls the rail from A-I to I-Q without
closing the activity, so no broad system-gesture exclusion is needed. Fresh standard
captures show the edge-flush rail and underlined folder selection. They are embedded
in the rebuilt questionnaire and package checks pass; repeat Helium verification on
this final capture set before reopening it. Fresh guard positive controls are complete:
moving one rail-edge pixel back to picker color triggers the flush-edge diagnostic;
erasing the underline triggers the non-color-state diagnostic; and substituting the
low-contrast `#AAAAAA` foreground makes all six `onSurfaceVariant` checks fail. The
restored package passes build, lint, and unit contracts.

Final Helium verification at DPR 2 is complete on the `f54fc145d` capture set. All six
previews decode to 2076 × 2152px or 1038 × 2152px. Full frames measure 907 × 937 CSS
px around 852 × 883px screens; physical-half frames measure 454 × 937px around
426 × 883px screens. Camera geometry remains 32.41dp. Zoom in, out, Fit, sharp 1:1
display pixels, reset, stage scrolling, and Close pass. Both comparisons remain one
row at 1280 × 800; at 390 × 844 each independent 316px scroller traverses its 848px
row by 532px while the page remains 390px wide. Offline loading retains all six images;
forced host dark mode leaves the form light. Blank validation, every radio, free text,
prepare, copy, download, and clear pass with the synthetic `Q1 1c / Q2 3b / Q3 None.`
result and finish cleared.

Axe-core 4.13.0 reports no WCAG A/AA violations and no incomplete checks on the closed
page. The modal reports no violations and one `color-contrast` incomplete group for
eight toolbar nodes because axe cannot resolve a top-layer background; the source trace
and manual-review procedure are in `doc/troubleshooting/axe-modal-dialog-contrast.md`.
Resolved computed pairs range from 6.44:1 to 17.07:1 for those nodes. Labels, names,
alternative text, unique IDs, 48px visible targets, and initial dialog focus pass direct
checks. Helium page errors and console output are empty. A fresh 629 × 650
matching-scale crop against the supplied front reference confirms the final frame and
edge-flush rail. The isolated form is blank and its dialog is closed. Reopen this exact
file in the normal Helium session before accepting answers. One verification delta is
unexplained: an earlier axe run on the older form reported no dialog incomplete checks,
while the final form's otherwise identical 19 passing dialog checks include eight
contrast incompletes. The current source trace and direct computed-color measurements
are the evidence to trust; do not silently reconcile the older result. Two raster
guards deliberately stay tied to the pinned AVD: status icons measure 2063 black pixels
against a 1500 minimum, and Q2c trailing values measure 4214 dark pixels against a 4000
minimum. Rebase them if the recorded AVD state changes. The `dbtp-*` files were freshly
captured after `f54fc145d`, but their app pixels below the changing native clock match
the prior capture because the rail correction affects only the full-screen candidates.
The isolated Helium browser and emulator are stopped. The final blank questionnaire was
opened through the Helium desktop entry. KWin reports its exact new
`Music player design: grilling round 1 - Helium` window at 1080 × 1880 on `DP-2`;
it is non-minimized and a one-shot activation targeted that window. No theme answer has
been recorded. The user then rejected the selected `Camellia` text underline because
underlined text communicates a web link. Their requested replacement is an MD1-style
tab treatment on that folder target, not a change to the edge-flush letter rail. Use a
separate tab indicator belonging to the whole 48dp target rather than decorating the
label glyphs; keep color plus the spatial indicator as redundant selected-state cues.
Recapture and reopen before accepting answers. Google's archived MD1 tab specification
confirms a 48dp target, accent-colored active text, and a separate 2dp accent indicator
at the target bottom: `https://m1.material.io/components/tabs.html`. Apply that visual
state treatment without changing folder-target radio semantics or turning the wrapped
folder choices into semantic top-level tabs.

The first implementation at prototype commit `764718845` used intrinsic-width columns.
Its native capture visibly broke D31: long labels wrapped into narrow multi-line columns
and the several-natural-width-names-per-line flow disappeared. It was rejected before
questionnaire integration. Prototype commit `88374ace0` instead keeps the existing
natural-width `Box` target and draws the 2dp indicator on a match-parent Canvas, which
does not participate in measurement. The corrected capture restores the original flow,
keeps `Camellia` itself free of text decoration, and draws a separate 182 × 4px
indicator across its 182 × 117px selectable target, approximately 75 × 48dp at 390dpi.
All six native captures completed under the pinned state. They are embedded in the
rebuilt questionnaire with provenance `88374ace0`; package build, lint, and unit
contracts pass. Two throwaway positive controls prove the revised state boundary:
erasing the target-width indicator yields `must show the 2dp selected-folder tab
indicator across the target`; adding a glyph-width line at the former underline
position yields `must not underline selected folder text like a web link`. The restored
capture passes. Final Helium verification is next. Before verification finished, the
user removed another redundancy: delete the left-pane `Camellia` control and place
`Open` on the same app-bar line as `Folders`. The right-pane `Camellia` title remains
the current-folder identity. Do not retain an empty source-action row; give its
vertical space back to the folder picker, then recapture and restart verification.
Prototype commit `8ec92ff7f` does so with one Material `TextButton` action in the
`TopAppBar`. UI Automator measures its action boundary at 203 × 117px, about 83 × 48dp.
The old row is gone, the selected target and 2dp indicator move upward intact, and the
picker shows more names. All six recaptures completed and are embedded. A throwaway
positive control painting the old button's former interior triggers `must not restore
the redundant left current-folder control`; restoring it passes.

Final Helium verification at DPR 2 passes again. All source and frame dimensions,
camera geometry, zoom controls, desktop and mobile one-row comparisons, independent
scrollers, blank validation, every radio, prepare, copy, download, clear, offline
loading, forced-light rendering, and direct accessibility checks remain green. The
closed page has no axe WCAG A/AA violation or incomplete result. The open dialog has no
violation and the same eight manually resolved contrast incompletes documented in
`doc/troubleshooting/axe-modal-dialog-contrast.md`. Helium page errors and console
output are empty. A fresh matching-scale hardware comparison confirms `Open` shares
the `Folders` line, the letter rail remains edge-flush, and the selected folder uses a
separate target-width indicator rather than text decoration. The isolated browser and
emulator are stopped. The exact final blank form was reopened through the Helium
desktop entry. KWin reports its non-minimized 1080 × 1880 window on `DP-2`, and a
one-shot activation targeted that exact window.

The user then settled both theme questions. For Q1 they chose `1c`, with one explicit
change: the light-theme rail-seam divider must be white rather than
`outlineVariant`. For Q2 they chose `3a`: duration and true peak use one
`onSurfaceVariant` supporting line. Their rationale is that the product will allow
users to customize the display with templating, so the default should stay neutral
rather than hard-code true-peak emphasis. Record these as decisions D34 and D35,
apply them to the native prototype, recapture the settled baseline, and do not treat
the earlier synthetic `1c / 3b` verification output as an answer. Custom display
templating is now a stated product requirement, but its scope, grammar, editor,
preview, validation, and fallback behavior are not designed; `open-questions.md` 11e
records that boundary rather than inventing it.

Prototype commit `5cff61514` applies D34 literally: `light-c`'s only 1dp rail-seam
line is `Color.White`; the other candidates retain their comparison colors. D35 needed
no source change because the full `light-c` study already composes `dbtp-a`. Six fresh
captures completed under the pinned dynamic palette and are embedded with the new
provenance. At the selected seam, x=115, 117, and 119 at y=1000 all resolve to white;
the white line therefore visually merges with the white rail and picker surfaces,
which is the literal rendered result of the user's correction. A throwaway positive
control painting x=117 back to the old outline color triggers `must render the chosen
rail seam white`; restoring the capture passes. Build, lint, and unit contracts pass.
Final Helium verification at DPR 2 passes. All six images decode to their cited source
sizes and all six dialog frames retain exact logical and body geometry. Zoom in, out,
Fit, native display pixels, reset, and Close pass. At 390 × 844, each comparison stays
on one 848px row inside its independently traversable 316px scroller; the page stays
390px wide. Blank validation, all radio paths, the real `1c / 3a` answer, copy,
download, and clear pass, then remain cleared. Offline loading has no external URL and
all six candidate images decode; forced dark host media leaves the questionnaire
light. Axe reports no WCAG A/AA violation or incomplete result on the closed page. The
open dialog reports no violation and the same eight manually resolved top-layer
contrast incompletes. Direct labels, names, alternatives, IDs, focus, and target-size
checks pass. Browser errors and console output are empty. The fresh matching-scale
hardware comparison confirms the white rail seam visually merges into its adjacent
white surfaces while the 24dp center spacer remains the tonal expanded-layout spacer.
The selected baseline still uses one neutral duration-plus-true-peak line. Stop the
isolated browser and emulator, then reopen this cleared final artifact in normal
Helium. That cleanup is complete. The earlier normal questionnaire window was closed
because it contained the pre-decision artifact. The updated cleared file was reopened
through the Helium desktop entry, and KWin confirms its exact non-minimized
1080 × 1880 window on `HDMI-A-1`. A one-shot activation targeted that window. The page
labels `1c` and `3a` as chosen while leaving all form inputs clear.

The user correctly reported that they still did not see "the updated baseline." Retract
the preceding delivery claim: activating the questionnaire window exposed the form,
not the requested selected baseline state. The exact `1c` full-frame preview remained
behind its Open preview action. Rule VPH now records that a visual handoff completes
only when the requested artifact state itself is visible. The questionnaire supports
`#chosen-baseline`, which opens the selected full-frame modal as the page loads. Verify
that hash path, replace the form-only normal window with it, and activate its exact
non-minimized KWin window before asking any next-round question. The hash path is now
verified in isolated Helium at DPR 2: the dialog is open immediately, its title is
`1c: Tonal panes with one white rail divider`, its image is 2076 × 2152px, initial
focus is Zoom out, and all form answers remain clear. The form-only normal window was
closed and the same hash path was launched through the normal Helium desktop entry.
Its exact replacement KWin window is `{25fcb5c8-6f0f-4554-afb2-a45f1473592c}` at
1080 × 1880 on `DP-2`. Make activation of that window the final operation so a later
tool call does not return focus to the agent terminal. Await visible corrections; do
not ask for next-work ordering yet.

That handoff still failed. The user saw an unexplained image and reasonably asked what
`baseline` and `full-frame` meant, what action was expected, and how to continue. Those
were agent-internal terms, not instructions. Here, `baseline` meant the combined
working design after applying `1c` and `3a`; `full-frame` meant the whole unfolded
Pixel 9 Pro Fold image rather than Q2's right-half crop. The intended task was to
inspect that combined design and report remaining visual errors, but neither the modal
nor the response told the user that. The confusing normal Helium window was closed.
Answer in plain language and ask only the real unresolved clarification: whether
`divider` meant the 1dp line between the letter rail and folder names, or the visible
24dp center spacer between panes. The implementation currently changes the former to
white, where it visually merges into adjacent white surfaces. Do not reopen anything
until the user's meaning and remaining corrections are known. The user rejected a
chat-only clarification and explicitly required the proper updated `.html` form.
Build one self-contained Helium questionnaire that defines every visible element,
shows native full-device alternatives for the plausible divider readings, includes
pros, cons, ranked recommendation, answer controls, and free corrections, and states
exactly how to respond. Do not ask again in chat or reopen the prior theme-pick form.
Prototype commit `89a9f7033` now provides three native full-device keys while keeping
`1c` surfaces and `3a` metadata fixed: `divider-a` makes the 1dp rail line white,
`divider-b` makes the 24dp center spacer white while retaining the gray rail line, and
`divider-c` makes both white. The new form defines those elements in ordinary language,
asks one radio question, requires all remaining corrections or `None`, and generates an
explicit paste-back answer. Native capture, integration, verification, and Helium
opening remain. All nine prototype captures then completed, including three new
2076 × 2152px divider alternatives. The clarification trio was copied into the main
worktree and embedded in the rebuilt form. Pixel probes confirm: D1 has a white rail
line and tonal center; D2 has an `outlineVariant` rail line and white center; D3 has
both white. Three independent throwaway positive controls each alter one defining
pixel and trigger the candidate-specific guard; restored captures pass. Package build,
lint, and unit contracts pass.

Helium verification at DPR 2 now passes for the proper clarification form. Its first
viewport states the purpose, a numbered procedure, plain-language definitions of the
rail line and center spacer, and the exact copy-back path before any option. All three
native images decode at 2076 × 2152px and remain in one row. D2's modal measures
907 × 937 CSS px around an 852 × 883px screen at 100%; Zoom in, out, Fit, native pixels,
reset, scroll, and `Close preview and answer` pass. At 390 × 844, the cards stay on one
992px row in a 316px independent scroller that traverses 676px while the page stays
390px wide. Blank validation focuses the divider radio. Every radio path, free text,
prepare, immediate copy, download, and clear pass with synthetic output
`Divider center-white / Other corrections: None`, then remain cleared. The original
smooth scroll made an immediate Copy click miss its moving target; changing it to
non-animated scrolling fixed the user path and the repeated immediate probe copies the
exact prepared text. Offline loading has no external URL and all three images decode;
forced host dark mode leaves the form light.

The closed page has no axe WCAG A/AA violations or incomplete checks. The first modal
run correctly found `scrollable-region-focusable` on `#zoom-stage` and an
`aria-prohibited-attr` incomplete after its first label-only repair. Making the region
focusable and assigning `role="region"` fixes both. The final modal has no violation
and only six known `bgOverlap` contrast incompletes. Direct computed ratios are
17.075:1 and 6.441:1; the updated troubleshooting document records this variant.
Labels, names, alternatives, unique IDs, initial modal focus, and 48px targets pass.
Browser errors and console output are empty. Close the isolated browser and emulator,
then open this exact cleared form through normal Helium with the instructional page,
not a preview modal, visible first. The isolated browser and emulator are stopped. The
cleared form was opened through the Helium desktop entry without a preview hash. KWin
reports the exact `Music player design: white divider clarification - Helium` window
as non-minimized at 1080 × 1880 on `HDMI-A-1`, internal ID
`{a5f30058-687c-4d2a-940a-e9db0e6a0c30}`. Activate that exact window as the final
operation, then wait for the form answer. The user answered with
`/var/home/user/Pictures/Screenshots/Screenshot_20260904_191909.png`: choose D2, and
make the divider marked with red callout `1` white. The mark is unambiguous at the
center of the horizontal 16dp strip between the folder picker and transport section,
not the 1dp rail line. Final D34 therefore combines: `outlineVariant` rail line, white
24dp vertical center spacer, and white 16dp horizontal picker/transport divider. Apply
that exact combination, recapture it natively, and show it in an actionable updated
HTML correction form before moving on. Before that recapture, the user added two track
list corrections: remove agent-invented ordinal numbers because they can be confused
with actual track-number metadata; replace the saturated blue current-row undertone,
which the user identifies as inaccessible and not MD3. Retain the play icon as the
non-color current-track cue. Re-check the supplied Material guidance for an appropriate
baseline current-row treatment, apply both corrections to every new candidate, and
include them in the next native HTML evidence. The supplied list specification says
baseline items use standard colors and reserves the selection mapping for selected
list items; current playback is not a user list selection. Its accessibility page
explicitly accepts a leading icon as the non-color state cue. Prototype commit
`49d6568ed` therefore removes generated ordinals, removes the custom current-row fill,
keeps every row on standard `onSurface` / `onSurfaceVariant` colors, reserves the
24dp leading slot for alignment, and draws the play icon only on the current track.
It also implements final D34: visible `outlineVariant` rail line, white vertical center
spacer, and white horizontal picker/transport divider. Native recapture and an updated
before/after HTML review remain. Ten native captures completed under the pinned state.
The new `divider-final` image is 2076 × 2152px and resolves the rail line to
`outlineVariant`, both requested pane spacers to white, and the former selected-row
sample to white. Its noncurrent leading column has zero dark ordinal pixels while the
current-track leading region retains 416 exact-primary play-icon pixels. The updated
self-contained HTML compares the exact annotated D2 before-state against revised D2,
lists all four changes, asks which version to continue from, and requires every further
correction or `None`. Four throwaway positive controls independently prove the before
reference, white marked divider, ordinal removal, and play-icon guards. Restored build,
lint, and unit contracts pass. Helium verification at DPR 2 now passes. The opening viewport explains all four
changes and the exact answer path before the before/after comparison. Both native
images decode at 2076 × 2152px. Revised D2 opens in a 907 × 937 CSS px frame around an
852 × 883px screen at 100%; all zoom, Fit, native-pixel, reset, scroll, and close paths
pass. At 390 × 844 the two cards remain on one 688px row in a 316px scroller that
traverses 372px while the page stays 390px wide. Blank validation focuses the review
radio. Both radio paths, free text, prepare, immediate copy, download, and clear pass
with synthetic `Continue from d2-revised / Other corrections: None`, then remain
cleared. Offline loading has no external URL and both images decode; forced host dark
mode leaves the form light. The closed page has no axe violation or incomplete result.
The modal has no violations and the familiar eight manually resolved `bgOverlap`
contrast incompletes. Direct labels, names, alternatives, IDs, focus, and 48px targets
pass. Browser errors and console output are empty. A matching-scale hardware comparison
confirms the corrected pane geometry, white spacers, neutral rows, absent ordinals, and
play-icon current cue. Stop isolated processes and replace the earlier clarification
page in normal Helium with this cleared correction review. The isolated browser and
emulator are stopped. The exact updated file was launched through the normal Helium
desktop entry. KWin reports `Music player design: revised D2 correction review -
Helium` active and non-minimized at 1080 × 1880 on `HDMI-A-1`, internal ID
`{a5f30058-687c-4d2a-940a-e9db0e6a0c30}`. Leave it visible and wait for the review
answer. The user rejected that review structure: once a design is discarded, do not
show it again merely as before-state evidence. The active HTML must show only the
current revised D2 design. Keep rejected captures in durable records and regression
guards, not in the user-facing review. Replace the comparison with one current-design
preview plus clear `Continue` / `Needs another correction` controls and free text, then
verify and reopen it.

**Phase: theme work. The two theme picks are closed; a large amount of light-theme
drawing remains.**

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

**Theme answers received, pending implementation:**
- **Light theme separation:** `1c`, but the rail-seam divider is white (D34).
- **Secondary text in light:** `3a`; custom display templating will let users choose
  other emphasis, so the default remains neutral (D35).

**Open and waiting on the user:** the order of remaining work. My recommendation is
cover screen, then accessibility, then the command bar. See `open-questions.md` 11c.

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
