# Settled decisions

## Project context (stated 2026-09-03)

**This is a product with users,
 not a personal tool.**
 The user:
 "this isn't a
one-person project.
 If it was just for me,
 I wouldn't have needed to support 3 desktop
platforms."
 Read every decision below in that light — the library,
 hardware and habits
behind them are a design target,
 not one person's setup.
 Practical consequences that
now apply to all future work:

- **Audience (stated 2026-09-03):**
   "People with big local music libraries."
   Big local
  libraries is the defining trait — not audiophiles,
   not DJs,
   not people who want a
  media-library app.
- **No "my library" reasoning.**
   ~1,000 folders is a representative scale,
   not the
  scale.
   Surfaces must hold up at 50 folders and at 20,000;
   a filter (D17) does,
   a
  list does not.
- **Folder names are not Latin-only.**
   The 27-cell A–Z + # rail assumes they are.
  Japanese,
   Cyrillic and Greek names all bucket into "#" today,
   which is wrong for
  users whose whole library is in one of them.
   Open question.
- **Single-theme,
   true-black (B1) was chosen for one person's OLED.**
   It may still be
  right,
   but it is now a product decision affecting people on LCD panels and people
  who need a light theme for contrast reasons.
   Flagged,
   not reopened.
- **Defaults matter more than affordances.**
   D11's three switches were sized for one
  person who knows what they do;
   each default is now a decision about strangers.
- **Accessibility is not optional.**
   Screen-reader labels,
   focus order and reduced
  motion have never been designed and are not covered by "MD3 gives it for free."

Every entry below was decided by the user,
 in most cases by choosing between built
candidates.
 Each has the decision,
 why it was chosen,
 what was rejected,
 and enough
implementation detail to rebuild it.
 **Do not re-open these without being asked.**

---

## A. Platform and design system

### A1. Material Design 3 is the shared spec, on both platforms
**Why.**
 Compose gives MD3 for free on Android — theme,
 motion,
 touch targets,
 dynamic
colour.
 Adopting anything else means hand-porting a system to Android as well as to
desktop.
 MD3 is also a complete system:
 every state,
 disabled variant and focus ring
is already specified,
 which an in-house system would have to invent.
**Rejected.**
 Adobe Spectrum 2 (deliberately supplies platform-specific variants — the
opposite of one identity — and is Adobe brand identity,
 not a neutral system);
Fluent 2;
 a "pro audio tool" aesthetic;
 a bespoke in-house system.
 The user’s own
argument killed the in-house option:
 every state would have to be designed and
maintained by hand.

### A2. MD3 baseline, not MD3 Expressive
**Why.**
 Expressive’s asymmetric radii,
 heavier type and larger controls spend
vertical space on personality that a dense track list cannot afford.
**Note.**
 Both are free in Compose;
 the other identities explored were not.

### A3. One visual identity across Android, macOS, Windows and Linux
No per-platform look.
 Both platforms follow the **OS accent colour** where one is
exposed (Android dynamic colour;
 desktop system accent) — the user pointed out that
desktops expose an accent too,
 so this is not an Android-only feature.

### A4. Desktop toolkit = Slint (settled 2026-09-03)
The hand-porting cost of MD3 components to Slint was accepted explicitly.
 Consequence:
every component used on desktop must be portable by hand — prefer the small set already
in use (outlined segmented button,
 icon button,
 slider,
 list row,
 snackbar/toast,
 menu)
over reaching for more of the MD3 catalogue.
 A3 (one identity) and C1 (48dp targets on
desktop) still hold,
 and the desktop build owns its own scrollbar (D22).

---

## B. Theme and colour

### B1. Theme follows the OS; dark is TRUE BLACK — standing rule (revised 2026-09-04)
The app follows the system light/dark setting.
 **The dark scheme's background is #000
and this is a standing rule,
 not a preference** — the user,
 when it was re-offered as a
question:
 "true black is a standing rule!"
 It is never to be re-asked.

**Where the bound MD3 design system conflicts,
 MD3 loses.**
 MD3's dark `surface` role
is neutral6 (#141218) with a five-step container ramp above it;
 this project overrides
those roles rather than the rule.
 Everything else in the dark scheme — the primary,
secondary-container,
 outline and on-surface roles — comes from MD3 unchanged.
 A light scheme is therefore now required — MD3 supplies one,
but this project has never drawn a single light surface,
 so the light side of every
component (outlines carrying separation on black do not translate) is unbuilt work.
The original entry,
 which was argued from one person's OLED,
 follows:

### B1 (superseded). A single theme: MD3 dark, true black
**Why.**
 OLED.
 The user raised true black as a constraint that had not been asked
about.
 There is **no light theme** — one theme only.

### B2. True-black surface ladder
MD3’s dark surface levels are remapped so the base is pure black,
 and **outlines carry
the separation that lightness normally provides**:
```text
surface            #000000
surface container  #0A0A0D   (bars, grouped cards)
                   #121216   (hairline dividers inside groups)
container high     #1A1A1F   (icon buttons, menus)
container highest  #22222A   (inactive slider track)
```

### B3. Palette in use
```text
on-surface              #E6E0E9   primary text
on-surface-variant      #CAC4D0   secondary text, icons
outline                 #938F99   1px outlines (verified; older candidates use #6F6A78)
divider (strong)        #26262E
divider (inside group)  #121216
primary                 #D0BCFF   play button fill, active slider track, accents
on-primary              #381E72   icon inside the play button
secondary-container     #4A4458   selected segment / selected mode
on-secondary-container  #E8DEF8   text on the selected segment (verified; older candidates use #EADDFF)
row selected            #332F3F   the currently playing row
error                   #F2B8B5   error text/icons (verified; older candidates use #FFB4AB)
error dim               #F2B8B5   error supporting text
error surface           #2A1416   error row/bar background
error surface line      #4E2A2C
muted                   #8E8894   annotations (6.2:1 on black — passes AA)
disabled                #5A5561   track numbers, inert glyphs
```
**Accuracy caveat.**
 These are MD3 baseline dark values as applied in the candidates.
They resolve in the spec through `md-ref-palette`,
 which has not been read directly.
One likely correction:
 MD3’s `on-secondary-container` in the baseline dark scheme is
**#E8DEF8** (secondary90);
 **#EADDFF** is primary90.
 Verify against the palette file
before treating these hexes as canonical.
 Also note that with dynamic/OS accent colour
(A3) these hexes are only the fallback scheme.

### B4. Contrast rule
Annotation and secondary text must pass AA on pure black.
 #8E8894 was chosen for this
reason after a contrast failure was flagged;
 do not go lighter-dark than it for text.

---

## C. Density, targets and type

### C1. 48dp minimum touch target everywhere, including desktop
**Why.**
 It is a hard Android constraint,
 and parity is the goal.
 The user accepted
the desktop density cost explicitly.

### C2. Track rows are two-line, 72dp
Per the MD3 list spec (one-line 56,
 two-line 72,
 three-line 88).
 Line one is the track
title;
 line two is `duration · true-peak` (e.g. `4:35 · −1.2 dBTP`),
 tabular numerals.
**Rejected.**
 Single-line rows (rows-a) and a columnar table layout (rows-b).

### C3. One spacing scale for both platforms
No separate dense desktop scale.

### C4. Type
Roboto 400/500.
 Sizes follow MD3 typescale roles (see md3-tokens.md):
 body-large 16px
for row titles,
 body-medium 14px,
 body-small 12px for the supporting line,
label-large 14px/500 for buttons and segments.
 Annotation labels use 11–12px with
wide letter-spacing in a monospace face — but note that in the candidates,
 monospace
is used only for **demo annotations**,
 not for product UI.

---

## D. Components and behaviour

### D1. Mode control = OUTLINED SEGMENTED BUTTON (revised 2026-09-04)
The user reversed the earlier connected-button-group pick:
 "the segmented buttons
should always remain as segmented buttons."
 Shown both side by side (desc-e connected,
desc-f outlined),
 they chose outlined.
 The 2026-09-04 requirement that every presented
design follow the supplied Material guidance corrects its geometry:
 all four options
occupy one non-wrapping `SingleChoiceSegmentedButtonRow`,
 never a 2×2 arrangement.
Use the real Compose component so it supplies the 40dp visual container,
 48dp target,
1dp outline,
 full outer shape,
 checkmark,
 role,
 and states.
 Visible labels are
`Repeat`,
 `In order`,
 `Shuffle`,
 and `Shuffle all`;
 `Shuffle` means the current folder
and carries the complete accessibility label `Shuffle current folder`.
 All labels
remain visible at the default font scale.
 At a system font scale of 1.5 or greater,
the same choices become one purely vertical segmented control:
 four connected,
full-label segments stacked top to bottom.
 Retain the segmented outline,
 selected fill,
checkmark,
 and single-select radio semantics.
 Never substitute plain radio rows,
 add
horizontal scrolling,
 or collapse the control to a single chip.
 The connected-group
note below is history.
 The archive source is `components/segmented-buttons/` under the
user-supplied `m3.material.io` archive.

### D1 (superseded). Mode control = connected button group (candidate mode-d)
Four options:
 **Repeat / In order / Shuffle folder / Shuffle all**.
**Why this component.**
 M3 marks the segmented button as no longer recommended and
directs you to the connected button group.
 Verified token values:
```text
container-height        56px   (medium size)
between-space            2px
container shape          corner-full  (pill outer ends)
inner-corner             8px   (corner-small)
selected inner-corner    50%
pressed inner-corner     4px   (corner-extra-small)
```
It **wraps to a grid on narrow screens**,
 and when it wraps only the four outer corners
round — the block keeps flush sides.
 This wrapping behaviour was specified by the user
via uploads/segmented buttons.png.
**Rejected.**
 Detached pills (mode-a/mode-b:
 read as four unrelated buttons);
the outlined segmented button (mode-c) — kept as the fallback if the connected group
proves impractical,
 and it is the one that matches the user’s reference image exactly.

### D2. The mode control also defines end-of-folder behaviour
**In order** = play to the end of the folder and stop.
 **Shuffle all** = cross folder
boundaries.
 **Repeat** = repeat.
 There is no separate end-of-folder setting and no
"continue into the next folder?"
 prompt.
 Candidates o6-a and o6-b explored this as a
separate question and are moot.

### D3. Folder picker = A–Z jump strip over a flat name-sorted grid
~1,000 artist folders,
 flat (no nesting in the picker),
 sorted by name.
 A 27-cell
strip (A–Z plus #) jumps within it.
 Cells and folder rows are **wrapped 48dp targets**,
not a single narrow column.
**Rejected.**
 A thin iOS-style fast-scroller (too small for the 48dp rule);
 letter
section headers alone (picker-a);
 a persistent sidebar (picker-c).
 Note the Android
fast-scroller drag-bubble idiom was discussed as a possible addition — a large bubble
showing the current letter while dragging — but was not settled.

### D4. Open shares the Folders app-bar line (revised 2026-09-04)
`Open` changes the directory.
 It is a visible Material text-button action with the
folder-open icon on the left pane's `Folders` app bar.
 There is no separate
current-folder control on the left.
 The right-pane `Camellia` app-bar title and the
selected folder target already communicate current-folder identity.
**Why.**
 Session restore makes Open a mid-session action,
 so it does not need a
separate high-emphasis row.
 Removing the duplicate current-folder control gives the
picker more vertical space while Open remains one tap away.
**Rejected.**
 Open in the overflow menu next to Settings (o1-b);
 a lone current-folder
chip;
 a second `Camellia` button above the picker.

### D5. Subfolders are headers inside one flat list — not a layer (confirmed on desc-d, 2026-09-03)
A folder containing subfolders shows **one flat list**:
 its own tracks first,
 then each
subfolder as a **header row** (name + count) followed by that subfolder's tracks.
Subfolders "don't create another layer of interaction" (user's words) — nothing to
enter or leave,
 no breadcrumb,
 no Up.
 Candidate desc-d shows it.
**Rejected.**
 Drill-in navigation with breadcrumb and Up (sub-b,
 desc-a);
 subfolders
as tappable rows above the tracks (sub-a as first read,
 desc-b,
 desc-c).

### D6. In order plays the parent's tracks first, then subfolders in name order
Confirmed 2026-09-03 ("Tracks first",
 not interleaved by name).
 Because of D5 the
"does the list follow?"
 question dissolves:
 playback walks down the flat list and the
highlight follows.
 Deck subtitle counts across the whole folder ("6 of 10").

### D7. Track context menu = candidate ctx-b
Eight items in three groups,
 headed by the track name:
```text
Play
Start shuffle from here
—
File details            (with the dB value shown inline, e.g. −0.8 dBTP)
Re-analyse true peak
—
Show in file manager
Copy filename
Move to trash           (destructive, error colour)
```
**Rejected.**
 A four-item minimal menu (ctx-a).

### D8. Move to trash = delete immediately, offer Undo (revised 2026-09-03)
No confirmation dialog.
 Undo is a **compact toast,
 not a full-width snackbar** — the
Todoist model:
 a small dark pill floating over the list near the bottom edge,
 content
width,
 "Moved to trash · Undo",
 auto-dismissing after a few seconds.
 It does not span
the window and does not push anything.
 Collision with the error bar (D9) is still open.

### D9. Missing files and renamed folders = candidate err-b
The list stays clean:
 a file that has vanished **drops out of the list**,
 and a
dismissible bar explains what happened.
 When several files fail at once the bar
**collapses to a count** rather than stacking one bar per file.
 A folder renamed while
playing changes nothing visible — the open file keeps playing and the folder list
refreshes on the next read.
**Rejected.**
 Errors in place (err-a),
 where the dead row kept its position,
 turned
error-coloured and explained itself,
 and the folder chip carried its own failure state.

### D10. Empty state = candidate empty-a
When nothing is open,
 the screen explains the **first-run analysis up front** — an
hour at high CPU,
 once,
 pausable,
 playback works throughout — alongside a primary
"Open a folder" button and Settings.
**Why.**
 There is room here and nothing to interrupt;
 explaining it later means
explaining it during.
**Rejected.**
 A bare empty state with one line in the bottom bar and detail behind a
"Why?"
 chip (empty-b).

### D11. Settings = candidate settings-a
Three flat switch rows,
 and the pane says out loud that it is short:
```text
Strip common prefixes from filenames      ON
Resume where I left off                   ON
Analyse true peak in the background       OFF in the mock
```
"Strip common prefixes" shows `Another Xronixle` instead of
`かめりあ(Camellia) - Another Xronixle.flac` and is **on by default**.
"Resume where I left off" restores folder,
 track and position,
 **paused**.
"Analyse in the background" off means each track is measured just before it plays.
**Rejected.**
 Grouped cards with section headers and an analysis-status row
(settings-b).

### D12. Analysis status lives nowhere after the first run
The user chose this explicitly:
 once analysis is done it never needs to be seen again.
Consequence:
 the "10,412 of 10,412 analysed" row from settings-b is gone,
 and
**Re-analyse on the track context menu is the only remaining entry point**.

### D13. The scan indicator is not permanent
It appears while analysing and leaves afterwards.
 Final visual form unsettled
(scan-b and scan-d each show half of the intended behaviour).
 One known defect worth
remembering:
 in scan-a the Pause button appears and disappears,
 so that variant is not
reflow-free;
 scan-b was the only one that never changes size.

---

### D16. Unfolded screen: picker + transport LEFT, tracks RIGHT (candidate unf-g → unf-h)
Chosen over transport-right (unf-f).
 unf-h is the assembled version with D1 applied.

### D17. Folder picker = filter, never a list (candidate unf-f/unf-g)
One-column letter rail (27 × 48dp,
 scrolls on its own — user asked for one column).
The rule the picker must obey:
 **cope with 1k folders,
 never list 1k rows**
(review-notes 5b).

**Two hard NOs inside this,
 both stated by the user and both violated since — read them
before touching the picker:**
1. **No sub-letter segmentation,
    in any form.**
    The CA / CH / CL–CO split is dead —
   "we don't really need this as tabs" killed the *segmentation*,
    not just its
   presentation as tabs.
    A rail accordion (pk-d) is the same idea wearing a different
   hat and is equally out.
2. **No chip STYLING on the names** — but the wrapped,
    several-per-line LAYOUT is
   fine and in fact required.
    "Chips are out,
    but only the chip-like styling.
    You can
   just … not style them like chips."
    So:
    no pill fill,
    no radius,
    no outline around a
   name;
    names are plain text at their natural width,
    several per line.
3. **One item per row is out** — in one column (pk-a,
    pk-c),
    in two (pk-b) or in three
   (pk-e,
    pk-f).
    It has been rejected at least four times:
    a letter holding 70–100
   names makes the scroll absurdly long,
    which is the original failure
   (review-notes 5b).
    Several names per line is what keeps the extent short.

Settled presentation:
 **D31**.

### D18. Transport block layout (revised 2026-09-04; volume row removed by D20)
Centred on the half's axis:
 title and subtitle centred;
 seek is a full-width Material
slider row with elapsed and duration anchors;
 previous,
 pause,
 and next are centred
Material icon buttons with the recommended 8dp target spacing.
 The one-row mode control hugs its
content instead of stretching edge to edge.
 The earlier left-hugging version was
called "un-balanced."
 The earlier 24dp button gaps and full-width segmented control
were replaced by the supplied Material component and target-spacing guidance.

### D14. Cover screen = full player (candidate cover-c), volume kept — as an icon since D20
Chip + Open on top,
 track list,
 deck at the bottom for thumb reach,
 volume inline,
mode group wrapped 2×2.
 **Rejected.**
 Controls-only with the list behind a row
(cover-d).

### D15. The A–Z jump strip must NOT be a grid of boxed keys
The 9×3 grid of rounded cells (unf-a/unf-b/unf-c) "looks like a keyboard,
 which
doesn't fly."
 Open between a fast-scroll rail with drag bubble (unf-d) and a
borderless text index (unf-e) — see open-questions.md #1.

## E. Foldable

### E1. Target device: Pixel 9 Pro Fold
See device-metrics.md for real dimensions.
 The hinge is **vertical** in portrait.

### E2. Nothing interactive crosses the crease (revised 2026-09-04)
A **24dp spacer** runs down the centre of the unfolded 852dp expanded layout.
 The
supplied Material breakpoint guidance requires a 24dp spacer between expanded panes.
The spacer remains visually centred and contains nothing interactive.
 This invalidated
an earlier design that put the play button directly on the crease and supersedes the
older 16dp gutter.

### E3. Tabletop posture = candidate tabletop-c
The user’s own proposal,
 and better than either option offered:
 the **track list stays
continuous** and only the row that would fall in the crease moves out of it.
**Platform note.**
 Compose can detect tabletop posture;
 desktop toolkits cannot — so
this behaviour is Android-only by nature.
**Rejected.**
 Splitting the screen into list-above / controls-below at the hinge
(tabletop-a),
 and a posture-agnostic layout (tabletop-b).

---

## F. Input

### F1. Keyboard map — DRAFT ONLY (candidate keys-a)
Not reviewed by the user.
 Current draft:
```text
Space        play / pause
Ctrl ←/→     previous / next track
←/→          seek ±5s
↑/↓          volume
Ctrl F       RESERVED for a future search (D25)
Ctrl O       open the folder picker (D25)
Ctrl L       jump to the playing track
Ctrl M       cycle end-of-track mode
any letter   type-to-jump in the folder grid
Ctrl ,       settings
```
Media keys are expected to work on both platforms (MPRIS on Linux,
 media session on
Android).
 The Android media notification has not been designed.

---

## G. Round 4 decisions (2026-09-03)

### D19. No album art, permanently
Art-free utility is now an explicit decision,
 not an accident of the work so far.
 No
artwork in the deck,
 in track rows,
 on the cover screen,
 or in the picker.
 The fork
between "art-free utility" and "art-led moody" is closed in favour of the former,
 so
row treatment,
 deck and visual system stay as built.
 Do not propose artwork again.

### D20. Volume = icon button + vertical popover slider, everywhere
The YouTube model,
 chosen over the inline full-width slider row.
 Spec:
 a 48dp icon
button in the transport block;
 tapping/clicking it opens a vertical slider popover
anchored to the button (MD3 menu surface — `surface container high` #1A1A1F,
 elevation
level 2,
 corner-extra-small container,
 44px slider handle on a 16px track per
md3-tokens.md).
 Same on Android and desktop;
 on desktop the popover also takes ↑/↓ and
scroll.
 **Revises D18** — the transport block loses its volume row,
 which frees a full
row of vertical space in both the unfolded left half and the cover screen.
 **Revises
D14** — the cover screen keeps volume,
 but as the icon,
 not the inline slider.

### D21. Command bar: global hotkey, configurable, off by default
A command bar exists.
 Its hotkey can be registered globally (works when the app is not
focused),
 that setting is **off by default**,
 and it is configurable.
 Consequences to
design:
 a fourth Settings row (D11 said the pane is deliberately short — it stays short
at four),
 plus the in-app binding,
 which must not collide with F1's map.
 Global hotkey
registration differs per platform (Android has no equivalent;
 on Linux/Wayland it is
compositor-dependent) — check feasibility per platform before drawing the setting.

### D22. Scrollbars: desktop bar always visible; the letter rail has none
Touch input keeps Material's non-interactive fading 4dp bar.
 Pointer input gets the
same bar **always visible and draggable**,
 with a 12dp grab zone — it does not fade.
Chosen by last input,
 never the OS-native scrollbar.
 The letter rail (D17) shows **no
scrollbar at all** on either input,
 because its 27 cells are self-describing.
 Closes
the two open sub-points on the scroll-a spec.

### D23. The picker shows no folder counts
No library total ("1,043 folders") and no per-letter count.
 The picker is a filter
(D17),
 and a count is a list affordance — it implies a length the user is not meant to
care about.
 Removes the header count from unf-h and the count beside the letter.

### D24. Track order within a folder = tag track number, filename as fallback
Where files carry a track-number tag,
 that is the order and that is the number shown in
the row.
 Where the tag is missing,
 the folder falls back to filename order.
 Mixed
folders sort tagged tracks first by number,
 then untagged by filename.
 Folder order
everywhere else stays name order.

### D25. Ctrl+F is reserved for a future search; Ctrl+O opens the folder picker
Reverses F1's draft,
 which had Ctrl+F opening the picker on the grounds that there is
no search.
 Search is now expected to arrive later and keeps its idiomatic binding.
Ctrl+O — previously "open a directory" — opens the **picker**;
 the map is to be aligned
with IntelliJ IDEA conventions generally,
 which needs one pass over the whole list
(open-questions #6) before F1 comes off draft.
 Neither J/K nor Ctrl+arrows was ticked,
so next/previous stays as drafted (Ctrl+arrows) pending that pass.

### D26. Scan indicator = scan-F (candidate scan-ef, right frame)
A 56dp bar at the bottom edge:
 "Analysing true peak · 412 of 1,218" plus a
**fixed-width (100dp) Pause button that is always rendered**,
 so nothing appears,
disappears or reflows mid-scan — the defect that killed scan-a.
 The bar itself appears
when analysis starts and leaves when it finishes (D13).
 **Rejected.**
 scan-E,
 a 2dp
determinate line on the bottom edge with no text or control (too little for an
hour-long operation);
 scan-b;
 scan-d.

### D27. First run opens the system music library and ASKS before analysing
If the platform exposes a designated music library — Android MediaStore,
 XDG
`XDG_MUSIC_DIR` on Linux,
 Music on macOS/Windows — the app **opens it automatically on
first launch**;
 no empty state,
 no "Open a folder" step.
 Analysis does **not** start on
its own.
 The bottom edge asks once,
 with four answers,
 all 48dp:
```text
Scan once        analyse this library now, ask again next time
Always scan      analyse now and whenever a new library appears — no more asking
Dismiss once     don't analyse; ask again next launch
Dismiss forever  never ask; Re-analyse on the track menu is the only entry point (D12)
```
Candidate first-run-a shows all four states.
 Until a library is analysed,
 rows show
duration only and the deck subtitle omits the dB value — the absence is not an error
and is never explained in place.
 Note this pushes against D10's empty state,
 which now
only applies when no system library exists or the user declined it.

### D28. The picker rail adapts to the library's writing systems (revises D3, D17)
**Only writing systems present in the library get a section in the rail:**
 Latin A–Z,
Japanese kana rows (+ 漢 for kanji),
 Cyrillic,
 Greek,
 Hangul,
 then #.
 A Latin-only
library shows no other section;
 a Japanese-only library opens on kana.
 Sections are
separated by a hairline in the one-column rail.
 This replaces the single "#" bucket
that every non-Latin name used to fall into.
 `candidates/buckets.js` holds the model.

**This decision covers the rail only.**
 Presentation of the names is D31.

### D29. Undo toast floats above the error bar — both visible (candidate toast-a)
Closes the collision.
 The toast is content-width,
 left-aligned,
 48dp,
 over the list,
16dp above whatever owns the bottom edge:
 it lifts when the error bar (D9) is up and
drops when the bar is dismissed.
 It never pushes layout and never spans the window.

### D30. Design for ~1,000 folders; small and huge libraries degrade gracefully
~1k is the design scale.
 A 30-folder library and a 20,000-folder library must not
break,
 but neither is drawn,
 and neither gets special-cased UI for now.

### D31. Picker names = plain text, several per line — CHOSEN (candidate pk-g, 2026-09-03)
Chosen over pk-h (14px with middot separators,
 2.0 screens):
 the 16px/24dp-gap version
reads as a set of targets rather than as running text,
 and the density gain was not
worth it.
 Selection marking uses **primary colour + a 2dp MD1-style indicator at the
bottom edge of the whole 48dp target**,
 never underlined label text and never a filled
pill.
 The indicator is spatial state chrome,
 not link decoration.
 The accepted extent
is "2 to 2.5 screens per letter is not absurd",
 which finally closes the scroll-length
constraint that ran through six
rejected candidates.
The presentation that satisfies every constraint in D17 at once:
```text
16px Roboto 400, on-surface #E6E0E9      plain text — no fill, no radius, no outline
several names per line, natural width    wrapping flex row, column-gap 24dp, row-gap 0
48dp minimum height per name             C1 target rule, met without a pill
nothing truncated                        names take the width they need
selected: primary + 500 + 2dp target-width indicator
          never text underline or filled pill
```
This is the unf-f/g/h/i layout with the chip styling removed — the layout was never the
problem.
 **Measured** extent at 418dp (not estimated — review-notes #1):
 names pack
about 2.1 per line,
 so C (72 names) is 35 lines / 2.2 screens and the worst letter,
 S
(90 names),
 is 41 lines / 2.5 screens — against 4+ screens for one name per row.
 pk-g
reads these off the DOM and displays them,
 so the claim can be re-checked at any width.
**Rejected on the way here:**
 wrapped chips (unf-f/g/h/i — the styling);
 one name per
row in one,
 two or three columns (pk-a,
 pk-b,
 pk-c,
 pk-e,
 pk-f);
 a rail accordion that
re-introduced prefix ranges (pk-d).

### D32. The dark ramp is the project's own, measured down from black (candidate dark-b)
Chosen over 2a (MD3's own dark containers sitting above the #000 window),
 because
MD3's steps are warmer and start higher — the panes read as grey cards floating on
black,
 which defeats the point of true black.
 The ramp,
 in place of MD3's dark
`surface-container-*` roles:
```text
window / lowest      #000000     MD3 would be #0F0D13
low                  #0A0A0D     MD3 #1D1B20
container            #121216     MD3 #211F26
high                 #1A1A1F     MD3 #2B2930
highest              #22222A     MD3 #36343B
```
Five token values now diverge from the bound design system and are this project's to
maintain;
 everything else in the dark scheme (primary,
 secondary-container,
 outline,
on-surface) stays MD3's.
 This is the concrete form of B1's "where MD3 and true black
disagree,
 the surface roles get overridden,
 not the rule".

### D33. Only the surviving candidates get rebuilt on the design-system bundle
unf-j,
 pk-g,
 first-run-a,
 toast-a and scan-ef,
 plus everything built from now on.
 The
other ~60 candidates keep their hand-inlined values as history and are not touched.
Every rebuilt file **pins its scheme inline on its own root** — the host sets
`data-theme="dark"` on `<html>`,
 and inheriting that silently inverts a light design
(review-notes 5g).

### D34. Light uses 1c with white pane spacers and a visible rail line
Use the `1c` tonal structure.
 The 24dp vertical spacer between panes and the 16dp
horizontal divider between the folder picker and transport are white.
 Keep the 1dp
letter-rail boundary in dynamic `outlineVariant`;
 keep pane and track-row outlines
absent.
 The user chose clarification option D2 and marked the horizontal divider in
`/var/home/user/Pictures/Screenshots/Screenshot_20260904_191909.png`.
**Why.**
 White removes the two prominent gray bars while the thin rail boundary still
separates the letter targets from folder names.
**Rejected.**
 `1a`,
 which uses another tonal hierarchy;
 `1b`,
 which outlines panes and
rows;
 a white rail line,
 which disappears against adjacent white surfaces;
 making all
three separators white.

### D35. Light supporting text uses one neutral role (candidate dbtp-a)
Use one `onSurfaceVariant` supporting line for both duration and true peak.
 Do not give
the true-peak substring a stronger role or move it to a trailing column by default.
**Why.**
 Custom display templating is planned,
 so users will be able to choose what the
row displays and emphasizes.
 The product default should remain neutral rather than
hard-code true-peak emphasis.
**Rejected.**
 `3b`,
 which strengthens true peak;
 `3c`,
 which creates a trailing
true-peak column.

### D36. Track rows have no invented ordinals or saturated current-row fill (reopened 2026-09-05)
Do not prefix tracks with interface-generated numbers;
 they can be confused with real
track-number metadata.
 Reserve a 24dp leading slot and show the Material play icon only
for the current track.
 Keep every row on the standard list surface with `onSurface`
titles and `onSurfaceVariant` supporting text.
 Expose the current state semantically.
**Why.**
 The user rejected agent-invented numbering and the saturated blue current-row
undertone on accuracy,
 accessibility,
 and Material grounds.
 The play icon remains a
non-color state cue without recoloring the row.
**Reopened.**
 The user rejected icon shape as the only visible distinction.
 Current-track treatment
must combine cues rather than relying solely on color or solely on shape;
 exact cues are
not settled.
**Rejected.**
 Sequential UI ordinals;
 saturated `primaryContainer` current-row fill;
 color-only or shape-only current-track
treatment.

### D37. Transport uses tight spacing and outlined skip buttons
Use 8dp spacing between the existing playback groups and outlined styling for the
separate Previous and Next icon buttons.
 Pause remains filled.
 This is matrix choice 1B.
**Why.**
 The user explicitly chose 1B after reviewing all nine native candidates.
**Rejected.**
 The other eight spacing and skip-button combinations from the existing-screen
refinement matrix.

---

## Pending after the theme picks (2026-09-04)

- **Order of remaining work** — my recommendation:
   cover screen,
   accessibility pass,
  command bar.
   `open-questions.md` 11c.

User's instruction closing the session:
 record the session,
 update the handover,
 and
implement nothing further.
