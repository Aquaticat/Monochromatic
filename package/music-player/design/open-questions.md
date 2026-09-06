# Open questions

Each entry gives the background, what was already tried, why it failed, what to build,
and how to know it is right. Nothing here has been settled.

---

## 1. The unfolded layout — SETTLED structurally (D16, D17, D18); unf-h is the assembly

Remaining inside it: cover-c still shows the connected button group and the old
left-hugging transport — it needs D1/D18 applied before it is final.

**Round 3 verdict.** unf-d and unf-e rejected: both still listed one folder per row.
"This is the third time I'm saying this." See review-notes.md 5b.

**Now built: unf-f.** Left half = a picker that never scrolls far: a 27-letter rail
(48dp targets) filters to one letter; letters with >24 names split into 2-letter
bucket chips (Ca / Ch–Co / Cr–Cy); names appear as wrapped content-width 48dp chips.
Deck stays right (deck side still unanswered).

*Earlier rounds, kept for history:*

**Round 2 verdict.** unf-b/unf-c were not picked: the 9×3 boxed letter grid "looks
like a keyboard." Deck side was not answered — unf-d/unf-e keep the deck right
(recommendation: deck-left starved the folder list to ~7 rows).

**Now built.** unf-d: single-column folders with letter headers and a 48dp-wide
fast-scroll rail along the list edge (tap or drag; a 56dp bubble shows the letter —
the Android idiom from §8). unf-e: same list, A–Z as plain text under it — invisible
48dp targets, no boxes, only the current letter marked (4 rows at 418dp).

**Background.** The inner display of the Pixel 9 Pro Fold is essentially square
(~852×883dp) with a vertical hinge, giving two ~418dp halves either side of a 16dp
seam gutter. Every layout drawn before this was in a wide landscape frame and was
structurally wrong.

**What was tried.** candidates/unf-a.dc.html: folders + A–Z jump strip in the left
half; folder chip, track list and the full deck (title, seek, transport, volume,
connected mode group) in the right half; a 16dp seam column between them with nothing
interactive crossing it.

**Why it was rejected.** Only ~15 folders were shown. The user: "You forgot the 1k
subdirs rule again." The **structure was not criticised** — only the data scale.

**What to build.** The same structure at ~1,000 folders, using candidates/artists.js:
a scrolling folder list in the left half with a working 27-cell A–Z strip beneath it,
a visible folder count, and the deck in the right half. Consider what the left half
shows when the list is that long — the strip has to be reachable without scrolling to
it.

**Acceptance.** ~1,000 real folder names; jump strip present with all 27 cells at 48dp;
no interactive element within 8dp of the centre line; the layout screenshotted at
852×883 and looked at before it is shown.

**Also unresolved within this.** Whether the deck belongs in the right half under the
tracks (as built) or in the left half under the folders. Earlier candidates fold-f and
fold-g explored exactly this split but at the wrong aspect ratio, so their comparison
is void.

---

## 2. The cover screen — SETTLED: cover-c, volume kept (decisions.md D14)

**Background.** Folded, the device is a tall narrow phone: 411×923dp. Two directions
were built: the whole player, or controls only with the list behind a button.

**What was tried.** candidates/cover-a.dc.html (full player: deck, mode group wrapped
2×2, ~6 track rows) and candidates/cover-b.dc.html (controls only, large targets,
list and mode control behind two buttons at the bottom). Both were produced by
resizing the earlier 370×760 versions (o7-a / o7-b).

**Why they failed.** They were shown without being looked at. A prior bulk edit had
left `margin:0 auto` on the play button, which in a flex row throws prev and next to
the container edges. The user: "This looks very broken, did you even check?" The
margin has since been removed and the transport rows centred, but **the files have not
been verified at 411dp** and should be treated as unbuilt.

**What to build.** Both directions again, at 411×923, verified. Open question inside
this: whether the volume slider belongs on the cover screen at all, and whether the
mode control does.

**Acceptance.** Transport centred and circular; the connected mode group wrapping
correctly at 411dp with flush outer edges; 72dp rows; screenshotted and inspected.

---

## 3. Descending into subfolders — DISSOLVED (decisions.md D5/D6)

Subfolders are headers in one flat list; tracks first, then subfolders by name. desc-d
shows it. desc-a/b/c were built on a wrong reading of D5 and are superseded.

**Background.** Two decisions combine into a genuine unknown: subfolders are shown
above the tracks on one screen (D5), and In order descends into subfolders in name
order (D6). So playback walks into a subfolder while the user is looking at the parent.

**What was tried.** It was asked as a multiple-choice question. The user’s answer:
"What? Show me."

**What to build.** A demo — ideally an interactive one — of playback crossing from the
parent’s tracks into a subfolder’s tracks, in these variants:
- **The list follows.** It navigates into the subfolder; the folder chip becomes a
  breadcrumb that updates.
- **The list stays put**, and only the deck’s subtitle names the subfolder that is
  playing.
- **The list stays put**, but the playing subfolder’s row highlights.

**Consider also.** What "Shuffle folder" means once playback is two levels down, and
what the deck’s subtitle shows when the playing track is not in the visible folder.

---

## 3b. Scrollbars — SETTLED (D22): desktop bar always visible, letter rail has none.
The per-surface table in candidate scroll-a stands otherwise. Original note kept:

### (history) SPEC PROPOSED, awaiting verdict (candidate scroll-a)

The user: "We need to actually specify how scrollbars work/look. We don't get the
privilege of running in Chromium only." Proposed rule: touch input → Material's
non-interactive fading 4dp bar (verified values, md3-tokens.md); pointer input → the
same bar, always visible and draggable with a 12dp grab zone. Chosen by last input,
not by OS; never the OS-native scrollbar. Per-surface table is in the candidate.
Open: whether the desktop bar should fade too, and whether the letter rail gets one.

## 3c. Reviewer feedback, 2026-09-03 — decided, now needing build

- **Volume icon + vertical popover** — SETTLED (D20). Built into unf-i; the cover
  screen and the keyboard map's ↑/↓ still need updating to match.
- **Command bar** — SETTLED as a configurable global hotkey, off by default (D21).
  The surface itself has never been designed: what it searches (folders? tracks?
  commands?), and what it does once search exists (D25) are both unbuilt.
- **Picker names not as a wall of chips** — unanswered; candidates pk-a / pk-b / pk-c
  are built and awaiting a verdict against the current chips.

## 4. Desktop toolkit — SETTLED: Slint, hand-porting accepted (D19 section, A4)

What is left is not a decision but work: the list of MD3 components that actually have
to be ported, and whether any of them (the segmented button's wrap behaviour, the
44px slider handle, the state-layer mechanism) are impractical in Slint. Worth a
feasibility pass before more desktop surfaces are drawn.

---

## 5. Album art — SETTLED: never (D19)

---

## 6. The keyboard map — partially settled (D25), needs an IntelliJ pass

Settled: Ctrl+F reserved for search, Ctrl+O opens the picker. Left to do: **one pass
aligning the whole map with IntelliJ IDEA conventions** (the user's instruction) —
which will move more than the two bindings above, and should be brought back as a
single revised map rather than binding-by-binding questions. Also still open: ↑/↓ now
control a popover slider (D20), not an inline one — decide whether they open it; and
the Android media notification has never been designed.

---

## 7. The scan indicator — SETTLED: scan-F (D26)

### (history) The scan indicator, final form

Non-permanence is settled (D13). The exact treatment is not. Constraints gathered so
far: it must not cause reflow when it appears or leaves (this ruled out scan-a, whose
Pause button appears and disappears), and it should live at the bottom edge without
being a permanent fixture. scan-b and scan-d each demonstrate half of the intent, so
the settled version is genuinely unbuilt.

---

## 8. Rendering fidelity — FIXED this round
The file-options preview stretched 411×923 / 852×883 layouts to fill a large window,
so the user judged a distorted render ("they don't look alright"). Device candidates
now render inside a fixed device-size frame scaled to fit (cover-c, unf-d, unf-e,
desc-d). **Every new device candidate must use this frame.** Also: html-to-image
screenshots do not show scroll position — verify scroll with a console probe.

## 8b. Consequences of "this is a product, not a personal tool" (2026-09-03) — NEW

None of these are built or decided; all follow from the project-context note at the top
of decisions.md.

- **Non-Latin folder names.** SETTLED: adaptive per-script rail (D28), built in pk-d.
- **Light theme.** SETTLED: follow the OS (B1 revised) — but **no light surface has
  ever been drawn**. The true-black scheme leans on outlines for separation, which does
  not translate; every candidate in this project is dark-only. This is now the largest
  unbuilt area in the project.
- **Small and huge libraries.** SETTLED as "degrade gracefully, undrawn" (D30).
- **Accessibility pass.** Focus order, screen-reader labels for the transport and the
  rail, reduced-motion behaviour for the popover and the scan indicator.
- **First-run analysis cost** — answered by D27 (auto-open the system library, ask
  before analysing, four answers). Left over: D10's empty state now only applies when
  there is no system library, and has not been redrawn for that narrower case.

## 9. Smaller loose ends

- **Fast-scroller drag bubble.** Probably moot: the picker is a filter, not a scrolling
  list (D17), so there is nothing to fast-scroll. Confirm and delete.
- **Undo vs error bar collision.** SETTLED: toast floats above the bar (D29).
- **Folder count display.** SETTLED: none (D23).
- **Sort order.** SETTLED: tag track number, filename fallback (D24).
- **Command bar surface.** Unbuilt — see 3c.

---

## 10. Open after round 4 (2026-09-03)

- **Light-theme pass.** See 8b. Nothing drawn.
- **Picker presentation within a letter — STILL OPEN, and the constraint box is tight.**
  Ruled out so far: wrapped chips (unf-f/g/h/i), one name per 48dp row in one column
  (pk-a, pk-c), two columns of chips (pk-b), and any sub-letter segmentation including
  pk-d's rail accordion. What is left to satisfy simultaneously: plain-text names,
  48dp targets, no segmentation, and a scroll extent that stays modest for a letter
  holding 70–100 names. Candidates pk-e and pk-f attack it two different ways.
- **Command bar surface** (D21) — hotkey settled, the surface itself never designed.
- **Keyboard map / IntelliJ alignment pass** (D25).
- **Accessibility pass** — focus order, screen-reader labels, reduced motion.
- **Android media notification** — never designed.
- **MD3-on-Slint feasibility** — which components genuinely port (A4).


---

## 11. Theme work after session 4 (2026-09-04)

### 11a. Light theme separation — SETTLED (D34)

**Verdict.** The user chose `1c`, then clarification option D2. Keep the 1dp letter-rail
line in `outlineVariant`; make the 24dp vertical center spacer white. In the annotated
screenshot `Screenshot_20260904_191909.png`, the user also marked the 16dp horizontal
strip between the folder picker and transport, so that divider is white too.
Candidates `light-a` / `light-b` / `light-c` (and `light-abc`, all three side by side).
Each prints its own pros, cons and my read in the caption bar.

- **1a — tonal ramp, no outlines**
  - PROS · purest MD3; separation by tonal surface is the mechanism M3 specifies;
    calmest screen; nothing extra to maintain.
  - CONS · the four steps run #FFF → #F7F2FA → #F3EDF7 → #ECE6F0, within ~4% of each
    other; on a poor panel or at low brightness the panes may not read as separate.
  - MY READ · third choice.
- **1b — one flat surface + 1dp hairlines** (direct translation of the dark design)
  - PROS · unambiguous at any brightness or panel quality; one structural model shared
    with dark; rail seam and pane edges stay legible.
  - CONS · many 1dp marks in an already high-contrast theme; row dividers on 72dp rows
    add noise; least MD3-idiomatic.
  - MY READ · fallback — robust rather than elegant.
- **1c — ramp on a dimmed window, hairline only at the rail seam**
  - PROS · tonal as MD3 intends, with a hairline exactly where tone alone fails; panes
    read as raised with no shadow; least ink for the separation achieved.
  - CONS · two mechanisms instead of one; the surface-dim desk is a heavier look.
  - MY READ · my pick.

### 11b. Secondary text in light — SETTLED (D35)

**Verdict.** The user chose `3a`. Duration and true peak use one neutral
`onSurfaceVariant` line because planned custom display templating will let users
choose other content and emphasis.

Candidates `dbtp-a` / `dbtp-b` / `dbtp-c` (and `dbtp-abc`).

- **3a — same as dark, on-surface-variant throughout**
  - PROS · one rule for both themes; contrast is fine (#49454F on near-white ≈ 7:1);
    sub-line stays subordinate.
  - CONS · duration and true peak share a tone, so nothing is emphasised.
  - MY READ · second choice.
- **3b — split line: duration quiet, true peak at on-surface 500**
  - PROS · the true-peak number is the app's reason to exist and becomes scannable
    down the column.
  - CONS · two tones per sub-line; 12px at 500 can look heavy in light (400 is a
    one-value change).
  - MY READ · my pick.
- **3c — dB only on the playing row**
  - PROS · least ink; removes ~90% of the numbers.
  - CONS · peaks cannot be compared across a folder if only one row shows one.
  - MY READ · reject.

### 11c. Order of the remaining work — not chosen
My recommended order, twice offered and not answered: cover screen (the last stale
survivor, blocks nothing), then the accessibility pass (focus order changes markup and
is cheaper before more surfaces exist), then the command bar surface. Also waiting:
keyboard map IntelliJ pass, desktop window (needs a size), Android media notification,
error bar + settings in light.

### 11d. Light-theme work not yet drawn at all
The theme decision only covers the unfolded screen and the track list. Untouched in
light: the cover screen, the error bar, the undo toast, the settings pane, the context
menu, the first-run prompt and the scan bar. Every one of them currently hard-codes
dark values.

### 11e. Custom display templating — stated, not designed
The product will allow users to set a custom display through templating. That is the
reason D35 keeps the default supporting line neutral. The user's statement does not
yet settle template scope, available fields, syntax, editing surface, preview,
validation, fallback behavior, or whether templates apply beyond track rows. Do not
invent those details or narrow the requirement without a dedicated design round.

## 12. Existing-screen refinement, awaiting verdict

The active round stays within the accepted screenshot. Centering and seek-value
consistency are corrections, not choices: the old transport axis was 15dp toward the
fold despite D18, and `1:06` of `4:35` requires 24% rather than 16%.

The separable choices are:

- 8dp, 12dp, or 16dp spacing between the existing transport groups.
- Standard, outlined, or tonal baseline Material styles on the existing previous and
  next buttons, with pause remaining filled.

No absent control or future feature is part of this round. The command bar, cover
screen, notification, custom display templating, and every other unbuilt item remain
outside the active form.

Production accessibility verification must confirm the large-text vertical segmented
stack is announced as one mutually exclusive group. The pinned Compose artifact has no
vertical segmented wrapper, so the debug prototype composes row-scoped segment elements
vertically and cannot settle assistive-technology grouping by raster inspection.
