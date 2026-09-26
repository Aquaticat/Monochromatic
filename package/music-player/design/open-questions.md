# Open questions

Each entry gives the background,
 what was already tried,
 why it failed,
 what to build,
and how to know it is right.

## 0. How to read this file (2026-09-17)

Section headings carry the status:
 **SETTLED** cites the decision that closed it,
**DISSOLVED** means the question disappeared,
 and an unmarked heading is still open.
 Settled
sections are history for the next round,
 not live questions.
 Rejected patterns live
only in the NO lists of `decisions.md`;
 they never reappear here as candidates.
**PROVISIONAL** marks a usable design baseline with a stated revisit point, not a final
choice.
 **DEVELOPER-OWNED** marks work the user assigned to developers instead of design
rounds (2026-09-17):
 feasibility and porting studies,
 and implementation of settled designs.

## 0b. Live design backlog (2026-09-23)

- **PROVISIONAL: folded-cover picker P4 (D46).**
  The app-bar folder title and caret
  open the picker in the list slot while the deck remains visible.
  The P comparison
  originally captured P4 only in dark at 100% text.
  Post-decision native captures now
  show P4 in dark at 200% and L3 light at 100% and 200% (D46 follow-up).
  The 200% mode
  group border remains visible, and L3's two seams remain distinct from the folder
  selection cue.
  An interactive debug-only P4 study at 200% subsequently verified title open/close,
  Android Back, same-folder selection dismissal, and keyboard focus retained on the
  trigger after Back (see D46 and the interaction evidence JSON).
  Touch dismissal
  leaves keyboard focus unset in touch mode.
  TalkBack accessibility focus remains
  unmeasured; do not infer it from the keyboard-focus check or static captures.
  The cover panel is 1080 × 2424 physical px,
  approximately 443 × 994dp
  at this AVD's measured 390dpi,
  with D41/D42 dark structure and D45
  light seams.
  Selection does not authorize production work.
- **OPEN: revisit the folded-cover picker before 1.x (D46).**
  The user chose P4 while
  believing a better solution exists.
  Explore alternatives at a future design round,
  without assuming an improved replacement must be found or adopted.
  P1 to P3 were not
  chosen as the working baseline, not banned from exploration.
  K1's discouraging back
  navigation and K3's non-local sheet remain rejected.
- **SETTLED: Fold Search A with result heading and measured IME exceptions (D47 to D54).**
  D47 chooses a Search
  button opening a separate page;
  D48 puts Back,
  query and Clear in one header.
  D49 makes the Pixel 9 Pro Fold's cover (1080 × 2424px) and unfolded inner
  (2076 × 2152px) panels the visual source for all platforms.
  This AVD's
  measured 390dpi gives the cover approximately 443 × 994dp,
  not the old
  published-ppi estimate of 411 × 923dp.
  The desktop-width
  Slint screenshots in `questions/render/search-page-*` are historical experiments,
  not a live review or a basis for desktop-specific design.
  The first unfolded Compose Search draft spanned the centered 24dp region
  with header and row surfaces;
  its capture run was stopped under an
  overbroad reading of E2.
  The user clarified that only **informational material** such as text must
  avoid the visible physical dent,
  approximately x `[983,1093)` at this
  2076px panel width.
  Surfaces,
  dividers and hit regions may cross;
  do not
  preserve the superseded fixed `[414,438)`dp assumption.
  The second
  debug-only Compose study kept the whole region visually empty,
  but put the
  entire header over a blank left body and confined all results or empty-state
  instructions to the right body.
  The user rejected the composition.
  Its
  captures,
  hierarchy XML and role records remain historical evidence;
  the withdrawn artifact is archived in
  `questions/archive/search-rejected-fold-review.html`.
  That mechanical validator did not establish a coherent query/result
  relationship.
  The resulting three-way keyboard-visible comparison is archived at
  `questions/archive/search-three-way-before-a.html`.
  The user selected A:
  query and results together on the right,
  with a bottom-left deck that lifts
  above the keyboard (D51).
  D52 removes the redundant `Results for “cam”`
  heading from positive results on both panels;
  the no-results state keeps
  its explanation.
  The selected-only `questions/current.html` is design
  evidence,
  not a production implementation.
  A user-opened YouTube
  screenshot places thumbnail time and video title lettering near the crease;
  at the corrected 7.5mm width their edges fall in the approximate dent band,
  so treat that as a negative text-clearance example,
  not an endorsement.
  D50 additionally requires the unfolded playback/control deck to remain
  visible throughout Search,
  except for real floating-Gboard overlap (D53) and the brief measured
  Gboard font-update banner (D54).
  The first coherent-layout studies still hid
  it (the docked overlay covered it;
  both full-width variants replaced its
  parent screen),
  so their captures are rejected and not a review matrix.
  D51's chosen A was recaptured in light and dark on both physical panels
  at 100% and 200% text.
  An actual system-managed 300dp **debug-only** IME
  kept the unfolded controls visible while typing,
  with folder and track
  results starting directly below the one header.
  A later real Gboard probe found a floating keyboard by invoking
  `Show on-screen keyboard` from its physical-keyboard side-toolbar menu.
  A key tap changed Search's query, but at 200% text the floating key
  surface obscured part of the deck title.
  Dragging it lower obscured more controls rather than docking it.
  On the folded cover, real Gboard key taps produced `cam`, while the
  floating keyboard completely covered both matching result labels.
  D53 accepts the measured floating-Gboard overlap with the unfolded deck.
  Cover result visibility remains unmet in its measured floating mode;
  A remains the selected design,
  and the original observations remain evidence.
  the 300dp bottom-IME capture is bounded evidence.
  A disposable Fold AVD booted after user authorization raised its container
  cap to 6 GiB.
  Its `hw.keyboard=no` config did not remove the runtime physical keyboard.
  Real Gboard split keys on the inner panel and full-width keys on the cover
  entered `cam` at 100% and 200% text.
  Settled IME tops were y `1352` inner and y `1605` cover;
  the inner final mode ended at y `1313` at 200%,
  and both cover result labels stayed above its keyboard.
  Light and dark 200% captures support those **bounded passing modes**.
  The original AVD's active Gboard was updated versionCode `175981944`,
  not its preloaded `175753756`;
  updating the disposable Gboard to the same build did not change its
  split/full-width geometry.
  A transient Gboard font-update banner on the disposable inner panel
  raised its IME to y `1140` and clipped the last mode until `OK` was tapped.
  D53 permits real floating Gboard to obscure the unfolded deck;
  D54 separately accepts that brief measured font-update banner clipping.
  Ordinary docked and split-keyboard typing still requires the full deck.
  The user clarified that Search keeps its **actual folder browser** in
  the upper-left area while typing.
  Do not blank it or replace it with a `Current folder` caption;
  the user rejected that substitute as useless.
  The viewport may shorten without changing browser content.
  The user accepts a little clipping even around the Open button;
  this does not imply that the off-screen folder rows are accessible during
  a banner-height keyboard.
  The user liked the refreshed A-only review on 2026-09-25;
  the retained browser composition is settled,
  not the separate tall-IME reflow.
  D54 accepts the observed brief banner clipping without adopting
  that reflow.
  The full Open parent is `[621,148][953,279]` with the keyboard closed,
  while UI Automator sees only `[621,132][953,245]` in the short viewport.
  Those are visible accessibility bounds,
  not an intrinsic layout-size measurement.
  No below-48dp layout target has been deliberately introduced.
  Do not take space from the complete deck under ordinary docked or split
  keyboards or put meaning on the crease.
  D53 and D54 permit only their measured floating and font-update-banner
  exceptions,
  respectively.
  A 415dp debug-only system IME reproduced the banner-height clipping at
  y `1141` in unchanged A.
  An **unaccepted** inline title/transport study keeps the original
  folder browser in its shortened upper-left viewport;
  at 200% text the `Folders`/Open header is visible,
  the off-screen folder rows are not,
  and the complete final mode is `[73,990][965,1121]`.
  The last transport glyph ends at x `965`;
  its 48dp clickable parent is `[877,298][994,415]`,
  so only the hit region may cross the approximate crease start x `983`.
  Title ink starts at x `58` in this synthetic stress capture,
  but its UI Automator text bounds begin at x `73` because the scroll
  viewport clips accessibility geometry.
  The screenshot shows the complete painted title;
  TalkBack focus bounds for this **unaccepted** tall-IME reflow remain untested.
  With settled real split Gboard,
  the same debug-only candidate retained that browser header and showed
  final mode `[73,1201][965,1332]` before its y `1352` keyboard.
  Real key taps re-entered `cam` after Clear with both result labels visible.
  Earlier blank and caption substitutions are rejected.
  The stress trigger is fixed at 1000px;
  no real-banner recurrence or continuous animation fit has been verified.
  This is not a complete D50 response.
  App-side logging measured docked IME insets and a bounding rectangle.
  A later corrected-prototype test switched **real disposable Gboard**
  from full-width to floating keys at 200% text.
  The app logged `visible=true`,
  `platformBottom=0`,
  and `boundingRects=[]`,
  while privileged Window Manager reported keys overlapping the deck's
  `4:35` duration.
  That first visit's exact debug variant was not recorded.
  A separate explicit `search-deck-right-lift-retain-results-light` visit
  showed real floating keys obscuring the vertical A deck's title and
  other controls;
  a real key tap changed the query from `cam` to `cadm`.
  Its private screenshot,
  UI Automator bounds and privileged touch region prove visual overlap,
  but its public-insets log did not retain a noninitial sample.
  The first visit received no floating-key rectangle through the tested
  app APIs;
  animation continuity remains unverified.
  A debug-only app panel painted above real floating Gboard,
  but an uncovered key entered `m` while a key beneath the panel did not.
  `InputDispatcher` reported a dropped touch due to app-window occlusion.
  The panel also remained over the deck after Back in the sampled state.
  Reject this layering probe;
  it is not approval to obscure keyboard keys or the folder browser.
  A later debug-only keep-clear probe registered
  `[0,717][1038,2152]` with Window Manager,
  yet floating Gboard still covered the deck.
  Manual drags moved the reported key region rightward (still overlapping
  the area by 13px) and then back to a larger overlap;
  that validates region detection,
  not automatic keep-clear cooperation.
  A real key entered `d` while the title was still obscured.
  Reject this best-effort request on the tested Gboard fixture,
  not every possible keyboard configuration.
  The Android 17 AOSP release source traces submitted keep-clear areas
  through Window Manager to a PiP placement consumer;
  it does not establish that Gboard's internal floating keys subscribe.
  A PiP move was not tested,
  and the reason Gboard kept overlapping remains unproven.
  A bounded real-banner recurrence attempt changed the disposable font
  scale from 200% to 100% and back while the floating keyboard was open.
  The activity was recreated;
  after refocus at 200%,
  docked split Gboard began at y `1352` with the complete final mode
  ending at y `1332` and **no** font-update banner.
  This does not test a continuously focused scale transition or prove
  that the original banner cannot recur.
  Sanitized real-keyboard captures and whitelisted geometry records are
  indexed in `package/music-player/design/evidence/gboard-geometry.md`.
  The user explicitly accepted that real floating Gboard still obscures
  the unfolded deck (D53).
  The user also accepted the **brief** font-update-banner clip (D54).
  Neither choice accepts the separate cover result-label occlusion or waives
  complete deck visibility under ordinary settled docked/split keyboards.
  Other keyboard heights and distinct or persistent banner behavior remain
  unverified.
  A 200% long query remained in the right input region without hiding
  the deck under the debug IME.
  Long **result** names and result-list scrolling are still open.
- **OPEN: remaining Search behavior after D51/D52.**
  Keep positive results,
  no-results/unavailable states and open/back behavior distinct;
  do not
  treat static captures as proof of activation,
  keyboard focus restoration
  or TalkBack.
  Baseline M3 Search evidence is in
  `material-3-compliance.md`.
  Search targets and result effects/ranking remain open;
  D21's global command hotkey and Settings row
  do not transfer to Search.
  D25 still reserves Ctrl+F for search and Ctrl+O for the
  picker,
  pending the whole keyboard map.
  Cover-specific accessibility remains open;
  D39/D40 settled only the unfolded
  screen.
- **OPEN: player information clearance across the crease (E2).**
  The user
  corrected the fixed 24dp unpainted gap:
  keep opposing **informational
  material** apart by `max(min_padding, crease_width)` in physical units.
  The
  visible dent is about 7.5mm (superseding an initial 10mm estimate),
  approximately 110 panel pixels at 2076px unfolded width.
  It is about
  45dp **only at this AVD's present 390dpi**;
  the dp value changes with
  Android display scaling while the physical 7.5mm does not.
  The
  zero-width emulator hinge-area sensor is an occlusion model,
  not the
  visible dent.
  The numeric `min_padding` for this boundary remains open;
  the 12dp mode-button text rule is unrelated.
  Borders,
  paddings,
  input/row
  surfaces and hit regions may cross.
  Compare native player arrangements
  with information clear of the dent,
  preserve D34/D41 color treatments,
  and do not silently retain fixed 414dp content panes or a blank 24dp stripe.
- **OPEN: keyboard map revision (section 6):**
  one revised IntelliJ-aligned map,
  including what ↑/↓ does after D43 removed the volume popover.
- **OPEN: Android media notification.**
- **OPEN: light surfaces not yet drawn (11d):**
  error bar,
  undo toast,
  settings pane,
 context menu,
  first-run prompt,
  scan bar.
- **OPEN: D10 empty state redrawn for the no-system-library case (8b).**
- **DEVELOPER-OWNED: desktop window default size (11c, D49).**
  Choose an
  implementation window frame around the Fold-derived treatments;
  do not use it as
  a separate visual design target.
- **OPEN: custom display templating round (11e).**
- **DEVELOPER-OWNED: MD3-on-Slint feasibility (A4).**
  The user assigned feasibility and
 porting studies to developers on 2026-09-17;
  design rounds settle user-facing treatments.

---

## 1. The unfolded layout — SETTLED structurally (D16, D17, D18); unf-h is the assembly

Remaining inside it:
 cover-c still shows the connected button group and the old
left-hugging transport — it needs D1/D18 applied before it is final.

**Round 3 verdict.**
 unf-d and unf-e rejected:
 both still listed one folder per row.
"This is the third time I'm saying this."
 See review-notes.md 5b.

**Now built:
 unf-f.**
 Left half = a picker that never scrolls far:
 a 27-letter rail
(48dp targets) filters to one letter;
 letters with >24 names split into 2-letter
bucket chips (Ca / Ch–Co / Cr–Cy);
 names appear as wrapped content-width 48dp chips.
Deck stays right (deck side still unanswered).

*Earlier rounds,
 kept for history:*

**Round 2 verdict.**
 unf-b/unf-c were not picked:
 the 9×3 boxed letter grid "looks
like a keyboard."
 Deck side was not answered — unf-d/unf-e keep the deck right
(recommendation:
 deck-left starved the folder list to ~7 rows).

**Now built.**
 unf-d:
 single-column folders with letter headers and a 48dp-wide
fast-scroll rail along the list edge (tap or drag;
 a 56dp bubble shows the letter —
the Android idiom from §8).
 unf-e:
 same list,
 A–Z as plain text under it — invisible
48dp targets,
 no boxes,
 only the current letter marked (4 rows at 418dp).

**Background.**
 The inner display of the Pixel 9 Pro Fold is essentially square
(~852×883dp) with a vertical hinge,
 giving two ~418dp halves either side of a 16dp
seam gutter.
 Every layout drawn before this was in a wide landscape frame and was
structurally wrong.

**What was tried.**
 candidates/unf-a.dc.html:
 folders + A–Z jump strip in the left
half;
 folder chip,
 track list and the full deck (title,
 seek,
 transport,
 volume,
connected mode group) in the right half;
 a 16dp seam column between them with nothing
interactive crossing it.

**Why it was rejected.**
 Only ~15 folders were shown.
 The user:
 "You forgot the 1k
subdirs rule again."
 The **structure was not criticised** — only the data scale.

**What to build.**
 The same structure at ~1,000 folders,
 using candidates/artists.js:
a scrolling folder list in the left half with a working 27-cell A–Z strip beneath it,
a visible folder count,
 and the deck in the right half.
 Consider what the left half
shows when the list is that long — the strip has to be reachable without scrolling to
it.

**Acceptance.**
 ~1,000 real folder names;
 jump strip present with all 27 cells at 48dp;
no interactive element within 8dp of the centre line;
 the layout screenshotted at
852×883 and looked at before it is shown.

**Also unresolved within this.**
 Whether the deck belongs in the right half under the
tracks (as built) or in the left half under the folders.
 Earlier candidates fold-f and
fold-g explored exactly this split but at the wrong aspect ratio,
 so their comparison
is void.

---

## 2. The cover screen — SETTLED: cover-c, volume kept (decisions.md D14)

**Background.**
 Folded,
 the device is a tall narrow phone:
 411×923dp.
 Two directions
were built:
 the whole player,
 or controls only with the list behind a button.

**What was tried.**
 candidates/cover-a.dc.html (full player:
 deck,
 mode group wrapped
2×2,
 ~6 track rows) and candidates/cover-b.dc.html (controls only,
 large targets,
list and mode control behind two buttons at the bottom).
 Both were produced by
resizing the earlier 370×760 versions (o7-a / o7-b).

**Why they failed.**
 They were shown without being looked at.
 A prior bulk edit had
left `margin:0 auto` on the play button,
 which in a flex row throws prev and next to
the container edges.
 The user:
 "This looks very broken,
 did you even check?"
 The
margin has since been removed and the transport rows centred,
 but **the files have not
been verified at 411dp** and should be treated as unbuilt.

**What to build.**
 Both directions again,
 at 411×923,
 verified.
 Open question inside
this:
 whether the volume slider belongs on the cover screen at all,
 and whether the
mode control does.

**Acceptance.**
 Transport centred and circular;
 the connected mode group wrapping
correctly at 411dp with flush outer edges;
 72dp rows;
 screenshotted and inspected.

---

## 3. Descending into subfolders — DISSOLVED (decisions.md D5/D6)

Subfolders are headers in one flat list;
 tracks first,
 then subfolders by name.
 desc-d
shows it.
 desc-a/b/c were built on a wrong reading of D5 and are superseded.

**Background.**
 Two decisions combine into a genuine unknown:
 subfolders are shown
above the tracks on one screen (D5),
 and In order descends into subfolders in name
order (D6).
 So playback walks into a subfolder while the user is looking at the parent.

**What was tried.**
 It was asked as a multiple-choice question.
 The user’s answer:
"What?
 Show me."

**What to build.**
 A demo — ideally an interactive one — of playback crossing from the
parent’s tracks into a subfolder’s tracks,
 in these variants:
- **The list follows.**
   It navigates into the subfolder;
   the folder chip becomes a
  breadcrumb that updates.
- **The list stays put**,
   and only the deck’s subtitle names the subfolder that is
  playing.
- **The list stays put**,
   but the playing subfolder’s row highlights.

**Consider also.**
 What "Shuffle folder" means once playback is two levels down,
 and
what the deck’s subtitle shows when the playing track is not in the visible folder.

---

## 3b. Scrollbars — SETTLED (D22): desktop bar always visible, letter rail has none
The per-surface table in candidate scroll-a stands otherwise.
 Original note kept:

### (history) SPEC PROPOSED, awaiting verdict (candidate scroll-a)

The user:
 "We need to actually specify how scrollbars work/look.
 We don't get the
privilege of running in Chromium only."
 Proposed rule:
 touch input → Material's
non-interactive fading 4dp bar (verified values,
 md3-tokens.md);
 pointer input → the
same bar,
 always visible and draggable with a 12dp grab zone.
 Chosen by last input,
not by OS;
 never the OS-native scrollbar.
 Per-surface table is in the candidate.
Open:
 whether the desktop bar should fade too,
 and whether the letter rail gets one.

## 3c. Reviewer feedback, 2026-09-03 — decided, now needing build

- **Volume icon + vertical popover** — historical D20 treatment, superseded by D43.
   No in-app volume control remains; the ↑/↓ keyboard question remains open in section 6.
- **Command bar** — historical D21 decision superseded by D47's Search button and
  separate page.
  Do not carry the old global hotkey or Settings row onto Search
  without a new decision;
  see section 0b.
- **Picker names not as a wall of chips** — settled by D31: wrapped plain-text names,
  with the current folder marked by primary color and a bottom-edge indicator.

## 4. Desktop toolkit — SETTLED: Slint, hand-porting accepted (D19 section, A4)

What is left is not a decision but work:
 the list of MD3 components that actually have
to be ported,
 and whether any of them (the segmented button's wrap behaviour,
 the
44px slider handle,
 the state-layer mechanism) are impractical in Slint.
 Worth a
feasibility pass before more desktop surfaces are drawn.

---

## 5. Album art — SETTLED: never (D19)

---

## 6. The keyboard map — partially settled (D25), needs an IntelliJ pass

Settled:
 Ctrl+F reserved for search,
 Ctrl+O opens the picker.
 Left to do:
 **one pass
aligning the whole map with IntelliJ IDEA conventions** (the user's instruction) —
which will move more than the two bindings above,
 and should be brought back as a
single revised map rather than binding-by-binding questions.
 Also still open:
 the ↑/↓ popover question dissolved when D43 removed in-app
volume;
 decide what ↑/↓ does instead (system volume session, or nothing);
 and the
Android media notification has never been designed.
**Status (2026-09-17):**
 the design deliverable is a single revised map brought back as a
whole;
 implementing it is developer work.
 The media notification is tracked in the
0b backlog.

---

## 7. The scan indicator — SETTLED: scan-F (D26)

### (history) The scan indicator, final form

Non-permanence is settled (D13).
 The exact treatment is not.
 Constraints gathered so
far:
 it must not cause reflow when it appears or leaves (this ruled out scan-a,
 whose
Pause button appears and disappears),
 and it should live at the bottom edge without
being a permanent fixture.
 scan-b and scan-d each demonstrate half of the intent,
 so
the settled version is genuinely unbuilt.

---

## 8. Rendering fidelity — FIXED this round
The file-options preview stretched 411×923 / 852×883 layouts to fill a large window,
so the user judged a distorted render ("they don't look alright").
 Device candidates
now render inside a fixed device-size frame scaled to fit (cover-c,
 unf-d,
 unf-e,
desc-d).
 **Every new device candidate must use this frame.**
 Also:
 html-to-image
screenshots do not show scroll position — verify scroll with a console probe.

## 8b. Consequences of "this is a product, not a personal tool" (2026-09-03) — NEW

None of these are built or decided;
 all follow from the project-context note at the top
of decisions.md.

- **Non-Latin folder names.**
   SETTLED:
   adaptive per-script rail (D28),
   built in pk-d.
- **Light theme.**
   SETTLED:
   follow the OS (B1 revised);
   the unfolded separation is
  D34,
   and the unfolded light surface has been drawn and settled.
   Every other
  surface still hard-codes dark values (11d),
   which is now the largest unbuilt area
  in the project.
- **Small and huge libraries.**
   SETTLED as "degrade gracefully,
   undrawn" (D30).
- **Accessibility pass.**
   Focus order,
   screen-reader labels for the transport and the
  rail,
   reduced-motion behaviour for the popover and the scan indicator.
- **First-run analysis cost** — answered by D27 (auto-open the system library,
   ask
  before analysing,
   four answers).
   Left over:
   D10's empty state now only applies when
  there is no system library,
   and has not been redrawn for that narrower case.

## 9. Smaller loose ends

- **Undo vs error bar collision.**
   SETTLED:
   toast floats above the bar (D29).
- **Folder count display.**
   SETTLED:
   none (D23).
- **Sort order.**
   SETTLED:
   tag track number,
   filename fallback (D24).
- **Command bar surface.**
   D47 supersedes it with a Search page;
   see section 0b.

---

## 10. Open after round 4 (2026-09-03)

- **Light-theme pass — SETTLED for the unfolded separation (D34).**
   The undrawn light
  surfaces are listed in 11d.
- **Picker presentation within a letter — SETTLED (D31,
   candidate pk-g).**
  Plain-text
  names at natural width,
   several per 48dp line,
   no segmentation,
   nothing truncated;
  selection is primary colour plus a 2dp bottom-edge indicator on the whole target.
  Measured extent at 100% text:
   2.2 screens for a 72-name letter,
   2.5 for the worst
  90-name letter.
   The native unfolded captures show the same wrapping presentation at
  48dp row pitch (four names share the y=883 row in the dark evidence hierarchies),
  so the Android target carries D31.
   pk-e and pk-f are rejected rows-again patterns
  (review-notes 5d),
   not live candidates.
- **Command bar surface** (D21) — superseded by D47;
   the Search page is active in
   section 0b.
- **Keyboard map / IntelliJ alignment pass** (D25):
   see section 6;
   one revised map is the
  design deliverable.
- **Accessibility pass — SETTLED for the unfolded screen (D39, D40).**
   Other surfaces
  get their accessibility treatment inside their own rounds.
- **Android media notification** — never designed.
- **MD3-on-Slint feasibility (A4) — DEVELOPER-OWNED.**
   Feasibility and porting studies are
  developer work per user instruction 2026-09-17;
   not a design round.


---

## 11. Theme work after session 4 (2026-09-04)

### 11a. Light theme separation — SETTLED (D34)

**Verdict.**
 The user chose `1c`,
 then clarification option D2.
 Keep the 1dp letter-rail
line in `outlineVariant`;
 make the 24dp vertical center spacer white.
 In the annotated
screenshot `Screenshot_20260904_191909.png`,
 the user also marked the 16dp horizontal
strip between the folder picker and transport,
 so that divider is white too.
Candidates `light-a` / `light-b` / `light-c` (and `light-abc`,
 all three side by side).
Each prints its own pros,
 cons and my read in the caption bar.

- **1a — tonal ramp,
   no outlines**
  - PROS · purest MD3;
     separation by tonal surface is the mechanism M3 specifies;
    calmest screen;
     nothing extra to maintain.
  - CONS · the four steps run #FFF → #F7F2FA → #F3EDF7 → #ECE6F0,
     within ~4% of each
    other;
     on a poor panel or at low brightness the panes may not read as separate.
  - MY READ · third choice.
- **1b — one flat surface + 1dp hairlines** (direct translation of the dark design)
  - PROS · unambiguous at any brightness or panel quality;
     one structural model shared
    with dark;
     rail seam and pane edges stay legible.
  - CONS · many 1dp marks in an already high-contrast theme;
     row dividers on 72dp rows
    add noise;
     least MD3-idiomatic.
  - MY READ · fallback — robust rather than elegant.
- **1c — ramp on a dimmed window,
   hairline only at the rail seam**
  - PROS · tonal as MD3 intends,
     with a hairline exactly where tone alone fails;
     panes
    read as raised with no shadow;
     least ink for the separation achieved.
  - CONS · two mechanisms instead of one;
     the surface-dim desk is a heavier look.
  - MY READ · my pick.

### 11b. Secondary text in light — SETTLED (D35)

**Verdict.**
 The user chose `3a`.
 Duration and true peak use one neutral
`onSurfaceVariant` line because planned custom display templating will let users
choose other content and emphasis.

Candidates `dbtp-a` / `dbtp-b` / `dbtp-c` (and `dbtp-abc`).

- **3a — same as dark,
   on-surface-variant throughout**
  - PROS · one rule for both themes;
     contrast is fine (#49454F on near-white ≈ 7:1);
    sub-line stays subordinate.
  - CONS · duration and true peak share a tone,
     so nothing is emphasised.
  - MY READ · second choice.
- **3b — split line:
   duration quiet,
   true peak at on-surface 500**
  - PROS · the true-peak number is the app's reason to exist and becomes scannable
    down the column.
  - CONS · two tones per sub-line;
     12px at 500 can look heavy in light (400 is a
    one-value change).
  - MY READ · my pick.
- **3c — dB only on the playing row**
  - PROS · least ink;
     removes ~90% of the numbers.
  - CONS · peaks cannot be compared across a folder if only one row shows one.
  - MY READ · reject.

### 11c. Order of the remaining work — recommendation, not a user decision
The earlier recommendation was cover screen,
 accessibility pass,
 then command bar.
Cover structure and unfolded-screen accessibility now have D41 to D45 and D39/D40
respectively;
 D46
sets a provisional cover picker baseline with 200% and L3 captures;
 TalkBack focus
remains unmeasured.
 The command-bar recommendation led to rejected I/G/R prototypes;
 D47 replaces that
surface with a Search button and page.
 The page design is now active in section 0b.
 Reconsidering the picker
remains a separate pre-1.x question, not a promise to replace it;
 the keyboard-map pass,
 Android media notification,
 and undrawn light surfaces remain open;
  desktop
  window sizing follows the Fold design as developer-owned work (D49).

### 11d. Light-theme surfaces remaining to be drawn
D45 settles the cover's flat L3 surface with hairlines at both seams, and the P2 picker
was captured in that scheme.
 P4, the provisional D46 choice, now has its own L3
captures at 100% and 200% text.
 The error bar, undo toast, settings pane, context menu, first-run prompt and
scan bar remain undrawn in light; do not credit the cover decision as evidence for them.

### 11e. Custom display templating — stated, not designed
The product will allow users to set a custom display through templating.
 That is the
reason D35 keeps the default supporting line neutral.
 The user's statement does not
yet settle template scope,
 available fields,
 syntax,
 editing surface,
 preview,
validation,
 fallback behavior,
 or whether templates apply beyond track rows.
 Do not
invent those details or narrow the requirement without a dedicated design round.

## 12. Existing-screen refinement, 3B settled and accepted

The active round stays within the accepted screenshot.
 Centering and seek-value
consistency are corrections,
 not choices:
 the old transport axis was 15dp toward the
fold despite D18,
 and `1:06` of `4:35` requires 24% rather than 16%.

The user chose matrix option 1B:
 8dp spacing between playback groups plus outlined
Previous and Next icon buttons,
 with Pause remaining filled.

The user chose matrix option 3B.
 The current track uses a soft neutral
`surfaceContainerLow` row plus a bold title.
 Every row retains full title width with no
play icon or reserved leading slot.
 The existing folder `Open` action uses a tonal
Material button while retaining its folder icon and explicit label.
 Decisions D36 and
D38 record these independent treatments.

The completed matrix was the cross-product of four consequential current-track
treatments and four consequential Open treatments.
 Matrix size was not capped to an
example count.
 No consequential visual decision remains on this screen.

The user accepted the final strict-12dp adaptive review on 2026-09-08.
 No visual
question remains in this round.

No absent control or future feature is part of this round.
 The Search page (formerly the command-bar frontier),
 cover screen,
 notification,
 custom display templating,
 and every other unbuilt item remain
outside the active form.

Exact accepted 3B is now captured at every font scale exposed by the target's Android
Settings UI:
 0.85,
 1.0,
 1.15,
 1.30,
 1.50,
 1.80,
 and 2.0.
 Measured overflow produces one connected content-sized row at 85%,
 connected 2×2 at
100%,
 115%,
 and 130%,
 then four connected vertical rows at 150%,
 180%,
 and
200%.
 Every segment retains at least 12dp horizontal content padding;
 overflow adds
rows rather than reducing that floor.
 Every state shows `Shuffle Camellia`,
 uses no horizontal mode
scrolling,
 and clears the navigation inset.
 Longer names retain the full `Shuffle`
prefix and middle-ellipsize only the subdirectory at rendered `Camellia` width;
semantics retain the unshortened name.
 Shell-injected 50% and 75%
captures are historical diagnostics,
 not user-facing Android presets.

Production accessibility verification must confirm every adaptive arrangement is
announced as one mutually exclusive group.
 The pinned Compose artifact has no multi-row
segmented wrapper,
 so UI Automator and raster inspection cannot settle
assistive-technology grouping.
 UI Automator exposes
`Current track: Another Xronixle`,
 but production assistive technology must also
confirm that current-state announcement.

## 13. Unfolded accessibility pass, settled (D39 and D40)

The user selected F1 and S1.
 TalkBack traverses the folder area,
 playback deck,
 then
track pane.
 The current row uses structured state speech:
 `Current track. Another
Xronixle. 4:35 · −1.2 dBTP. Button.`
 Decisions D39 and D40 record the accepted
behavior and rejected alternatives.

Adaptive mode grouping remains a fixed requirement.
 The repaired prototype uses direct
Material-style radio segments inside one selectable group at every arrangement;
 TalkBack
announces accepted option order as one four-item list.
 Reduced motion also remains fixed:
the screen adds no autonomous or decorative motion.
 No accessibility design question
remains on the unfolded screen.

## 14. Unfolded dark dynamic color, settled (D41 and D42)

The next design-only round applies the standing true-black dark requirement while
following Android dynamic color.
 Preserve accepted layout 3B,
 transport 1B,
 current-row
treatment T3,
 tonal Open O2,
 adaptive mode behavior,
 and accessibility decisions
D39 and D40.

The native 2 × 3 matrix is built across six Android palette environments.
 Wallpaper is
uncontrolled user input,
 not a choice to settle:
 Android users can and likely will
change it.
 Every candidate retains pure black for the center spacer and track canvas,
uses Android-generated component roles,
 and keeps the current row soft-neutral plus bold.

Two separable decisions remain:

- Structural surface reach:
  R1 stable black structure,
  R2 generated rail and deck,
  or
  R3 generated folder canvas,
  rail,
  and deck.
- Current-row neutral source:
  C1 fixed `#0A0A0D` or C2 generated
  `surfaceContainerLow`.

Personal rankings are R1 > R2 > R3 and C1 > C2.
 The active form shows every
cross-product under the measured wallpaper seed,
 coral Tonal Spot,
 green Tonal Spot,
gold Vibrant,
 magenta Expressive at medium contrast,
 and Monochromatic at high
contrast.
 These environment rows are evidence,
 not user options.

Resolution (2026-09-09):
 the user answered R1 and C2 in chat.
 Decisions D41 and D42 record
the settled policy and the rejected alternatives.
 The accepted appearance is the captured
`stable-dynamic` column across all six palette environments.
 No dark-color design question
remains on the unfolded screen.
 Production implementation stays unauthorized:
 design
acceptance alone does not authorize production source changes,
 and issue #508 tracks the
proposed durable rule.
