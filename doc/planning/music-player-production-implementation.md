# Music player: production implementation of the accepted design

## Purpose and authority

On 2026-10-10 the human said: "Now go prod. Dev work. Use Haiku subagents."
That authorizes production implementation of the accepted design in `package/music-player/design/decisions.md`.
Earlier records that said no production implementation was authorized (for example D101 to D104) described the design rounds;
this instruction supersedes them for implementation, and not for any design question still open.
Production source had been reverted to design-only on 2026-09-09 (`6d2d06e41`: "The accepted visual review did not authorize production app implementation"),
so the production app is the older player and differs from the design in many places.

The work happens on the branch `feat/music-player-production`, in the worktree `~/temp/agent/music-player-production`.

## Answers of 2026-10-10

- Target: Android first and desktop second, and the human said not to stop between them.
- Order: the human left it to the agent; it is foundation up, as the numbered packages below.
- Landing: each verified package merges to `main`.
  A package is verified when its unit tests pass in the capped container, detekt is clean,
  and, for a screen, its native captures match the design's captures.

## Method

- Model choice: Haiku 5.5 by default.
  The human gave the authority (2026-10-10) to elevate to Sonnet 5.5 whenever its results show Haiku is not good enough;
  the orchestrator decides that from the results, and records each elevation and its reason here.
- Trust, set by the human on 2026-10-10: once there is enough evidence that Haiku is good enough for a specific kind of task,
  the orchestrator does not repeat that kind of work as if it distrusted them.
  Evidence so far: pure-logic ports with a tested reference (packages 1 and 2) compiled, mirrored every case, passed the unit
  tests and, after one round, detekt, and the orchestrator's own re-run agreed with the agents' reports.
  For that kind of task the orchestrator accepts the agent's own test and detekt results from the logs and runs the suite once before committing.
  Compose UI packages have no evidence yet and keep the full verification, including native captures.
- Haiku subagents write code and tests for one bounded work package each, in the shared worktree, in disjoint files.
  They never run Gradle, never commit and never touch another package's files.
- The orchestrator (this session) builds and runs the unit tests in a capped container, reviews every diff,
  fixes or re-delegates, and commits each verified package with explicit pathspecs.
- Reference implementations come first: where the design folder holds a tested JavaScript reference
  (`template-reference.mjs`, the keyboard classifier), the Kotlin port mirrors its cases one to one.
- Where only a Compose study exists, the study's source on `prototype/music-player-first-run-access`
  (worktree `~/temp/agent/music-player-first-run-access`, `app/src/debug`) is the visual reference
  and the decision text is the requirement.
- Kotlin in this package carries a What, Why and "In TS you'd write" comment block above every declaration,
  as in `core/PlaybackMode.kt`; subagents copy that shape exactly.

## Work packages

Each is independently verifiable.
Packages 1 and 2 are pure logic with an existing reference; the rest need the screen they belong to.

1. Track template engine (D89 to D99): port `design/template-reference.mjs` to `core/TrackTemplate.kt`
   with a test file that mirrors its 94 cases.
2. Keyboard map classifier (D102): port the classifier inside `design/questions/keyboard-map.prototype.html`
   to `core/KeyboardMap.kt` with a test that mirrors `design/keyboard-map-test.mjs`.
3. Player screen to the design: remove the in-app volume row (D43), fold and cover layouts (D41 to D45),
   deck content height (D44).
4. Folder picker: letter rail (D17, D28), folder names (D31), the cover picker with an upward caret while open (D46, D104).
5. Search page (D47 to D74).
6. Feedback overlays and Undo (D83, D29).
7. Scan indicator (D26, D84).
8. First-run states (D95, D100, D101); needs a source-status outcome the production list API does not give yet.
9. Settings page, empty (D87), and the template editor (D89 to D99), on top of package 1.
10. Track context menu.
11. Keyboard wiring on top of package 2.
12. Desktop app inheriting the Fold visual choices.

## Log

- Packages 1 and 2 (Haiku 5.5): both ports compiled on the first build and mirrored every JS case;
  detekt then found 97 findings in them, mostly missing KDoc on local values, which a second Haiku round fixed.
  Verified by the orchestrator: `testDebugUnitTest` and detekt both green, landed on `main` as `cc2b1c49e`.
- The human disabled detekt's whole complexity rule set on 2026-10-10 (`7ed98539d`); a Haiku audit of oxlint and clippy was started.
- Model rule, set by the human on 2026-10-10: without evidence, assume Haiku can handle everything,
  and escalate to Sonnet 5.5 only when Haiku is proven bad by its results.
  An earlier entry here that elevated packages 3 and 4 to Sonnet before any result was wrong and is withdrawn;
  packages 3 and 4 start on Haiku.
- Verification tooling: `~/temp/agent/run-production-task.ts` runs a Gradle or shell command for the production worktree in a
  capped container (6 GiB, 2 CPUs); mise's own task path fails with "Failed to find Build Tools revision 36.0.0" there while the
  same Gradle command through `raw:` passes, a difference not yet explained.

- Landed on the branch by 2026-10-10, each with its own unit tests and a clean detekt run: the folder rail and index,
  the transport deck, the track list pane, the folder picker pane with the app bars and icons, the assembled cover and unfolded
  player screens with a debug host, the feedback queue and overlay, the scan indicator, the first-run pane, the track menu,
  the template editor and Settings page, and the Search matcher, results and page.
  Native captures of the player screen found one defect (text and icons drawn black on the dark canvas because no content
  color was provided); it is fixed and a recapture is running.
- Decision D105 (trash): folder grants delete immediately with a copy-back Undo; the system library uses Android's trash request.
- Host wiring on the production branch (2026-10-10): routes (Player, Search, Settings, template editor), the first-run pane in
  place of the permission gate, the scan indicator driven by a process-wide sweep progress holder, the feedback overlay with a
  host-owned queue, the track menu with real actions and the D105 trash flows. Unit tests and detekt were green for each step;
  trash, the file-manager intent, the clipboard and the popup position are not yet exercised on a device.
  Native captures of the Search, Settings and template editor routes (40 views) found one more content-color gap in the debug
  host only (the production root has a Surface); the Search result title now sets its own color.
- Per-row duration and true peak landed on the branch (`4bdbfe3b0`, `8fdadbe51`): the shared core gained a per-track decision
  removal and a peak kind, the JNI crate gained `nativePeekPeak` and `nativeInvalidateTrack`, and Kotlin reads duration from
  MediaStore or `MediaMetadataRetriever` (cached by fingerprint) and the exact peak from the native cache. Rows show only exact
  peaks; File details shows sampled ones with a marker. Re-analyse invalidates one track and re-measures it.
- Keyboard wiring (D102) on the host: a root key handler over the classifier with 52 unit tests; not yet exercised on a device.
  Decisions of the orchestrator on the agent's questions: Escape stays as D102 words it (popup and Search only); one map for
  Windows and Linux chords; Ctrl+O is unhandled off the cover layout; Ctrl+G switches to the playing track's folder; a tap on a
  row returns focus to the playback area.
- Known gaps on Android: a folder-scan failure that the library source swallows (it reports an empty folder), the Settings page
  on the inner screen spanning the full width, and every device-only behaviour (trash flows, file manager intent, clipboard,
  popup position, keyboard focus). The debug APK built by Gradle alone carries no native library; the package's `build:native`
  task (cargo-ndk, both ABIs) must run first.
- Desktop composition (2026-10-10): the new `AppWindow` (cover layout below 600 px, two panes from 600 px) replaced the old
  page-tab UI and its five experimental page styles; Rust glue modules bind the engine to the components; Settings, template
  editor, search, menu, overlays and keyboard are wired; 521 tests pass and clippy is clean on the host. Not done: sweep
  progress for the scan indicator, per-track length and peak from the engine (rows show no second line yet), the first-run copy
  for desktop, the opened root's name for the no-audio state, key repeat (Slint 1.17 has no repeat flag), macOS and Windows
  branches never compiled.
- Desktop: the template, search, folder, keymap and overlay logic is ported to Rust and integrated into `desktop-app/src`
  (485 tests pass, clippy clean on the host; the container clippy task fails on the existing `truepeak-core` path dependency,
  which the container does not mount). The Slint components are being built next to the Android captures.
- Real-app verification (2026-10-11): a scripted run of the real Android app on the owned Fold emulator (native library,
  generated library) found five defects that the debug host had hidden: the track menu opened at the bottom instead of by its
  row, the Settings line for track rows was empty, the light rail boundary line was missing, the deck blanked when the playing
  track was on another page, and three keyboard behaviours needed the decisions recorded above. All were fixed and re-run; the
  run ends 31 of 32 (the remaining step is Android's own permission prompt covering the app on the folded cover, as designed).
  The same style of run on the desktop (Slint MCP headless and nested in `cage`) found missing per-row length and peak, wrong
  first-run copy, dead shortcuts after leaving Search, and a menu clipped at the window edge; all were fixed.
- Final state on `main` (2026-10-11): Android unit tests and detekt pass; desktop 577 tests pass and clippy is clean on the host.
  What is not exercised is listed in `package/music-player/design/HANDOFF.md` under the production handoff.
- Correction (2026-10-11 evening): the "final state" above overstated what was checked. Tests, lints and static renders
  passed, but nobody had used the apps the way a person does. The human then found, in a few hours of use, missing hover and
  pressed feedback on every desktop control, a wrong Settings page, a jumping taskbar progress indicator, audio stutters
  under load, the list scrolling on every track click, a deck that wasted a line, and copy problems. The product was not
  finished. A change is now done only after it has been driven in the running window (hover, press, keyboard, both color
  schemes, every screen), not when tests pass.

## Handover: open work queue (2026-10-11 evening)

Work one item at a time, verify each in the running app, commit, then take the next. Agents (Haiku unless noted) do the
bounded edits; the orchestrator builds, tests, reads diffs and drives the apps. The human said the plan does not have to
run all at once.

### Landed on `main`

- Inter Variable bundled as the desktop font; thin LTO for the release build; `run-quick` task; Settings divider lines
  removed; Folders panel layout no longer re-wraps (names sized by the heavier weight, panes at exactly half); the tapped
  rail letter is circled; the deck title click jumps to the track; Search covers only the right pane when unfolded; the
  Open action reads "Open dir"; the unfolded folder pane is headed by the opened folder's name (Android: "MediaStore" for
  the system library).

### Committed on the branch, not yet merged to `main`

- Desktop: the StateLayer component and hover, pressed and pointer-cursor feedback on every TouchArea; the deck heading
  `folder / title` with two click targets. Slint lint, 577 tests and clippy passed; the hover states are not yet checked
  by hovering in the running window.
- Android: the deck heading `folder / title` (detekt and unit tests passed).

### In the worktree, uncommitted or in flight

- Android deck: transport buttons and mode control on one line when everything fits at natural width, plus a 48dp minimum
  width for the heading parts. Written by an agent, not yet compiled or run.
- Desktop deck: the same one-line rule in `ui/deck.slint` (agent running).
- List scrolling: the list must scroll only on a folder change, at startup, and on explicit reveal requests, never when
  the playing track changes (agents running for desktop `tracks.slint` and Android `TrackListPane.kt`).
- Stock Android Settings reference: an agent captures the stock Settings app with the display size set through the
  Settings UI itself (never `wm density`), restores it, and writes measurements. Next: redesign the Settings page on both
  platforms from those measurements.
- A Sonnet agent reviews the committed desktop app as a user and lists everything lacking polish. Next: triage, fix by
  area, re-check.

### Not started

- Taskbar progress jumps (KDE LauncherEntry). A private-bus recording harness is in `~/temp/agent/taskbar-check`; the first
  run never produced playing signals (the app was killed and playback did not start in that environment), so the cause
  is not found yet. Suspects: progress emitted with the old position over the new duration at a track change, and the
  debounce dropping the visible-true signal.
- Audio stutters under load: decode and output threads should not compete with the 16-worker peak analysis; look at thread
  priorities, ring buffer depth, and the output buffer size. Needs measurement under load, not guesses.
- Android clickable audit leftovers: four target-width findings in `MainActivity.kt` legacy page-tab variants (check
  whether production uses them).
- The unexplained intermittent first-click miss on a rail cell seen once by the checking agent.
- Run the same user-eyes review on Android after the desktop pass.
- Propose to the human: tighten `VUB` in `AGENTS.md` to require a user-style pass before calling a UI done.
- Desktop polish after live use (2026-10-11): the window font is Inter Variable, bundled from `ui/fonts/InterVariable.ttf`
  (the app had fallen back to Noto Sans; sizes were already 16, 14 and 12 logical pixels, measured against a 16px
  browser reference); the Settings page lost its header line and row lines on both platforms; the Folders panel no longer
  re-wraps or moves the Open pill when the selection changes, because every folder name is sized by a hidden copy at the
  selected weight and the desktop panes are placed at exactly half the window. Inter has no grade axis (only `opsz` and
  `wght`) and Slint 1.17 has no font-variation property, so reserving the heavier width is the available fix.
  Checked with real-text renders of the old and new code (old re-wraps, new moves only the two names whose color changes),
  the desktop and Android unit tests and lints; the Android Folders change has no on-device capture yet.

## Queue

- [x] Package 1.
- [x] Package 2.
- [x] Packages 3 to 12 landed on `main`; device-only and live-desktop behaviours remain unexercised (see the handoff).
- [ ] Release builds, signing and distribution are outside this plan and were not touched.
