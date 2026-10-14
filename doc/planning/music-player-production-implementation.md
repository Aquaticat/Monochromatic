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
- Routing authority, given by the human on 2026-10-11 after the Haiku failures recorded in `doc/limitation/haiku.md`:
  the orchestrator decides itself which tasks go to Sonnet 5.5, without proof on the specific task.
  Applied rule: diagnosis, cross-system debugging, performance and audio engineering, search and database integration,
  the keyboard map with its end-to-end runs, and polish fixes that need judgment go to Sonnet;
  pure-logic ports with a tested reference, mechanical renames, comment sweeps and verification runs stay on Haiku.
  Every brief names `doc/troubleshooting/` as the first search and requires the build or run, not only a linter, as its verdict.
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

## Handover: open work queue (2026-10-12)

This section is the canonical state for the next session. Read it, then `git log` on `feat/music-player-production`
and the decisions D106 to D119 at the end of `package/music-player/design/decisions.md`.

### Working agreements set by the human

- The human checks only `main`, and `main` is not sacred: merge as soon as tests, lints and clippy pass, and say plainly
  what has not been driven in a window or on a device.
- Subagents work in parallel, at most five at a time. Routing authority (2026-10-11): the orchestrator decides what goes
  to Sonnet without proof; diagnosis, performance, integration and judgment work goes to Sonnet, mechanical work stays on
  Haiku (`doc/limitation/haiku.md` records why). Every brief names `doc/troubleshooting/` as the first search and requires
  real runs, not a linter, as the verdict. Early circuit breaker: when a strategy cannot fit a hard requirement, record
  why and stop work on it.
- Polish standard: every clickable element has hover, pressed and pointer-cursor feedback; no copy or layout that a user
  would call unfinished; verify by driving the real window in the nested compositor
  (`package/cli/nested-wayland-session`, 0.4.0 installed: notifications and Plasma job fakes, `--accent-color`,
  `--launcher-log`, `--color-scheme`). A change is done only after it was driven the way a person uses it.
- Emulator: launch it headfully, as its own systemd user unit, on the host GPU, no container, no `xvfb-run`, no
  `-feature -Vulkan` (`doc/troubleshooting/android-emulator-37-software-renderer-sigsegv.md`, section "Working agent
  launch"). The headless container launch failed for 2.8 hours. Never use `wm density`; change display size through
  Settings (Display size or Developer options "Smallest width") and restore it. Always use a private copy of the owned AVD.
- Scale: 1 000 artists and 1 000 000 tracks is normal operation (tests at 1M belong in the normal suite); above that is
  unsupported. The real library to seed names from is `/home/user/Seafile/Plain/Music` (read only).
- Colors: D108. The OS accent is the only platform color on both apps, every derived color is OKLCH.
- Search: D111 (functional while scanning, hard requirement) and D112 (in-memory index, Turso search rejected after
  measuring both of its mechanisms; open to the human's veto).
- Settings: D109 (single full-width column on one canvas color, stock numbers, Material Symbols icons) and D110 (two
  panes when wide: half each with the text out of the crease band on a device with a crease, the 0.3636 default ratio
  without one; Back and Escape close).
- Analysis progress: D107 (a system notification, never an in-app banner; a Plasma job on KDE).
- `mise upgrade`: scope it to the tool (`mise upgrade <tool>`), and use `--before 0s` only for our own just-released crate.
  A bare upgrade installs unrelated toolchains and rewrites `mise.lock` (it broke the builds once).

### Landed on `main`

- Earlier: Inter font, thin LTO, `run-quick`, Settings dividers removed, stable Folders panel, rail tap circle, deck title
  click, Search on the right pane only, library name heading, hover and pressed everywhere (desktop), deck heading and
  one-line controls, steady seek bar, list scrolls only when asked.
- Toolchain: Slint 1.18.1 in three packages; every Rust crate and Android build dependency at the latest release (Turso
  0.8.2, jni 0.22, ringbuf 0.5, Gradle 9.8.1, AGP 9.4.1, Kotlin 2.4.21); the `branches` crate fix for the newest nightly
  (`doc/troubleshooting/floating-nightly-branches-crate-abort.md`); the Android native targets are in the `mise` rust
  config, so `mise run //package/music-player/android-app:build:native` works (about 7 minutes); nested compositor 0.4.0.
- Desktop: Settings per D109 and D110; playback position equals the audible position and same-format neighbours are
  gapless (`src/playback_clock.rs`, `Queue::peek_next_natural`; cross-format joins add a 43 ms hold and are not
  gapless); Search on the in-memory index with the 1M scale fixes (D111, D112; 1M tests in the normal suite;
  `MUSIC_PLAYER_SCAN_PAUSE_MS` slows the scan for hand tests); the D106 keyboard map (`src/keymap_bindings.rs` is the one
  table behind the classifier, badges, tooltips and menu rows), focus ring, hint badges and double Shift; the theme in
  OKLCH from the OS accent; the audio underrun meter and rtkit priority; the taskbar progress state machine.
- End-to-end runner: `package/music-player/desktop-e2e`, run by `mise run //package/music-player/desktop-app:test:e2e`
  (110 pass, 0 fail, 1 not injectable). It plays only into
  its own PipeWire null sink and never signals the user's player.
- Android: D107 notification with its device pass (three defects fixed: first-launch start, the API 35 time-limit
  `onTimeout(int, int)` crash, the legacy channel on upgrade); Settings per D109 and D110 with crease detection through
  `FoldingFeature`; Search on the in-memory index plus a scan pipeline that builds the library off the main thread; the
  OKLCH theme.
- Shared theme: the light baseline was retuned for AA under state layers (D108, primary delta-E 3.46, open to veto); one
  fixture of 52 roots (`android-app/app/src/test/resources/theme-roles-vector.txt`) is checked by a test on each side, and
  the Rust drift test fails if either side changes alone.

- Since then (D113 to D119): library and analysis follow files automatically (D113: no rescan or re-analyze command;
  the watcher names changed paths and a planner edits the list in place; at 1M tracks a replaced file costs 0.12 ms on
  the handler instead of 1.4 s; a replaced playing file is swapped in at the same position; every refresh retries
  recorded failed decodes and tells each file once); the track menu opens with `Menu` or `Alt+Enter` and every row has
  an access key (D114); the Firefox focus ring (D117) and the menu on the pure canvas (D119) on both platforms; grays
  carry the root hue unless the root is completely neutral, with an accent chroma floor, no `seam` role, and the dark
  deck read from the derived `deck` role (D118; fixture of 59 roots, 2124 role values, tolerance 0 on both sides);
  Android reloads on foreground return and shows a single top-level folder's own name; the Rust drift test now runs in
  the `containerCargo` fallback (it mounts `truepeak-core` and the Android fixture); `states/window-title` and
  `states/natural-order` were harness races and pass 20 of 20; nested compositor 0.4.0 is published and installed, and
  the runner checks capability by version with no pin; the e2e suite has 110 checks (110 pass, 1 not injectable).

### Open, not started

- Nothing waits on the human. D120 and D121 (2026-10-12 and 2026-10-13) answered every question this handover had
  open: the ring on `primary`-filled elements stays as specified, rows in clipped lists draw the ring just inside their
  edge, the page-control chain was deleted (`1635237e73`; its leftover stub, the Compose OKLCH adapters and the docs
  that described the styles went on 2026-10-13), the accent chroma floor and the D108 retune stay, the two Turso bugs
  are not filed, and `targetSdk` stays on 36. Ask any new question through the question tool, never in prose.
- Android large folders (2026-10-13): rows are now keyed by track (`core/TrackRowLineSource.kt`), so an analysis step
  no longer rebuilds the page; on the Fold emulator with 10 000 tracks in one folder frame p99 went from 400, 450, 109 ms
  to 69, 53, 48 ms and main-thread CPU from 31.5, 31.7, 21.7 s to 13.4, 15.9, 16.6 s. No actual ANR was ever
  reproduced, before or after (the original came from one bug report, `~/temp/agent/agent-android-final/bugreport1/`).
  Second round (2026-10-13 and 14, headful on the Fold emulator, 10 000 invented tracks, interleaved before and after,
  host never quiet): the `refreshPage` effect now runs one pass per sweep step without cancelling the running one
  (`core/StepPasses.kt`) and `measureNextBatch` starts at the first visible track and wraps (`startAt`), so the first
  supporting line on visible rows near row 9000 came after 17.7 to 26.1 s before and 3.5 to 4.5 s after (an upper bound,
  the first sample already showed lines); the play window (Next every 400 ms for 40 s) costs 15.4 s of main-thread CPU
  instead of 18.4 s because the playing-track change no longer rebuilds the rows (`LocalPlayingIndex`,
  `rowWithPlayingFlag`, `playingRowOrderOf`), a real but modest difference with no frame p99 difference shown; the cold
  75 s window is noise; `controller.mergeMeasures` costs 0.29 s per cold run (0.37 ms per call, about 2% of main-thread
  CPU), below the noise, and is left alone. The mutation pass killed every mutant of the new logic after ten more test
  cases; the unit suite is 1077 tests with no failures, detekt and lintDebug pass.
  Wiring tests (2026-10-14): the page measure refresh effect and the first visible report moved into
  `core/PageMeasureRefresh.kt` and `core/FirstVisibleTrack.kt`, so JVM tests now kill the mutants for the per-step
  cancel (`collectLatest`), the start position and the sink index (13 new tests, 1090 in all, no failures; detekt and
  lintDebug pass). Five mutants still survive because they sit at Compose boundaries: the `LocalPlayingIndex provides`
  value, the `rowWithPlayingFlag` call in the `LazyColumn` item, and the `currentPositionOf`,
  `pageEntryScrollTarget` and `remember` key arguments. Killing them needs Robolectric with compose ui-test or an
  instrumented test, a dependency decision not yet made. No emulator test ran for this change.
  Still open: the five Compose-boundary mutants; the fourth cost below; the 435 ms `loadTemplate` violation did not
  reproduce, so the template cache in `SessionStore.warmUp` is unproven; the old ANRs did not reproduce in 23 play
  windows (cause unknown); the sweep-under-load case was not exercised; release build not measured.
- Android playing-queue cost (measured 2026-10-14, partly fixed, on `main` since `90f121edf5`): while tracks changed,
  `BrainPlayer.getState` rebuilt one `SnapshotItem` (title, ids, artist) and one `MediaItemData` per queue position on
  every pull, and every brain change posted its own pull, so a 10 000-track queue cost 135 ms of main-thread CPU per
  track change (3 tracks: 21 ms) and the GC thread 10.8 s per 40 s. The fix keeps the rows between pulls
  (`SnapshotItemCache`, `reuseRows`), reuses the base state and its timeline, and posts one refresh per burst
  (`CoalescedTrigger`). Measured on the headful Fold emulator with the invented 10 000-track library, Next every 400 ms
  for 40 s, interleaved ABBA from a clean reinstall: main-thread CPU per track change 135 ms before (131 to 140, 12
  runs) and 69 ms after (66 to 101, 10 runs, 8 of them 66 to 74); three before runs taken while another job pushed the
  host load above 40 (252, 295 and 311 ms) are left out. Track changes that fit in the window 111 to 123 before and
  147 to 165 after; GC thread 10.4 to 11.5 s before and 1.7 to 2.0 s after; frame p99 200 to 250 ms before and 101 to
  117 ms after; `getState` 42% of main-thread samples before and 5% after. A 3-track queue is unchanged (21 to 22 ms
  per change), the control that the probe sees no difference where none is expected.
  Residual media3 cost, removed on `feat/android-no-legacy-queue` (owner's choice: remove the system queue, not window
  it): `MediaSessionLegacyStub.ControllerLegacyCbForBroadcast.updateQueue` converted the whole timeline to `QueueItem`s
  and called `MediaSession.setQueue` on every timeline change (32 to 35% of main-thread samples, `setQueue` 22 to 24%).
  It returns early with `setQueue(null)` when `isQueueEnabled()` is false, and that is false when the platform
  session's commands lack `COMMAND_GET_TIMELINE`
  (`MediaSessionLegacyStub.java` lines 1263 to 1266 and 1635 to 1638 in media3 1.11.1). The platform session takes its
  commands only from the media notification controller's connection result
  (`MediaSessionImpl.updateLegacySessionConfigurationOnConnectOnHandler`, line 1019). `PlatformSessionCallback`
  (`onConnectAsync`) therefore gives that one controller the default commands minus `COMMAND_GET_TIMELINE`
  (rule `keepsPlatformCommand`, plain Kotlin); every other controller keeps the defaults. In 1.11.1 the platform
  commands' timeline entry gates only the queue and its title (`isQueueEnabled`);
  `convertCommandToPlaybackStateActions` maps it to no action, so the actions mask is unchanged. The active queue
  item id,
  position, duration, metadata and the media keys read the player wrapper's own commands, not the platform commands.
  The notification controller now receives a one-window timeline (`PlayerInfo.filterByAvailableCommands`), which the
  notification manager only tests for emptiness.
  Measured on the headful Fold emulator, invented 10 000-track library, Next every 400 ms for 40 s from a clean
  reinstall, variant before = main (`7fa1465197`, built in a throwaway worktree) and after = `b1c23e653d`; one 5-trial
  block of the unchanged variant first, then three ABBA blocks; host load at the end of every window was 3 to 31 and no
  window reached 40, so none was excluded. Main-thread CPU per track change: before 69 ms (65 to 94, 11 runs; the five
  runs of the spread block 68 to 77), after 44 ms (40 to 48, 6 runs). Main-thread CPU per window 10 980 ms
  (10 060 to 13 670) before and 7 230 ms (6 720 to 7 650) after; track changes per window 159 (145 to 161) before and
  165
  (161 to 169) after; GC thread 1 980 ms (1 840 to 2 230) before and 1 045 ms (990 to 1 070) after; all threads 14
  740 ms
  before and 9 905 ms after; frame p99 117 ms (101 to 200) before and 48 ms (42 to 81) after. The two slowest before
  runs (94 and 85 ms) were the last trial of an ABBA block, at load 31 and 21. Control: playing a 3-track queue
  (the small window, split by which queue the log shows playing): before 21.0 ms per change (18.8 to 22.7, 8 runs),
  after 20.1 ms (19.3 to 20.9, 2 runs), no difference. simpleperf (13 s, dwarf call graph, 2 runs each), share of
  main-thread samples: `updateQueue` 32.1 and 34.7% before, 0.1 and 0.1% after; `setQueue` 23.9 and 22.4% before, 0.1
  and
  0.1% after; `invalidateState` 35.5 and 38.7% before, 8.9 and 11.8% after; the thread's sample count fell from 6 298
  and 5 591 to 3 210 and 3 781. The remaining 23 ms against the 3-track queue (44 against 21 ms) is now spread over
  `Choreographer.doFrame` (44 to 45% of main samples), recomposition (19%), `mediaButton` (9 to 14%) and `getState`
  (8%); whether it depends on the queue length or on the page that shows the big list was not separated.
  What a platform controller sees (`dumpsys media_session` after cold start, Next, Next, pause, resume, Previous; and
  `funcdiff.ts`): state, speed, the actions mask 21426 (21428 while paused), metadata title and the notification
  actions (previous, pause or play, next) are the same before and after; `queueTitle` is null in both; the queue size
  is 10 000 before and 0 after at every step, also during the first 90 s of a cold start (the notification controller
  connects before the library loads, so the full queue is never published). `activeQueueItemId` still reports the item
  index in the after variant although no queue is published. A 120 s invented tone showed the same wavy progress
  card and moved the same way when the scrubber in the notification shade was tapped or dragged in both variants
  (the first interaction after a cold start moved the position in 1 of 5 before and 1 of 4 after attempts, every later
  one did; the driver was not reliable, so seeking from the shade is checked in both variants, not shown identical
  on every attempt). No screen lock is set on the emulator, so the lock screen card was not seen.
  What this removes for other apps (not testable here, derived from the source): every controller that reads the
  platform queue (`MediaControllerCompat.getQueue`, `MediaController.getQueue`) gets none. Android Auto and Wear OS
  media
  UIs and car head units that list the Up Next or Now Playing queue from the platform session lose that list;
  `ACTION_SKIP_TO_QUEUE_ITEM` is still advertised, with no queue to pick from. Media3 controllers that connect through
  the session token (not the platform session) still read the full timeline.
  Three emulator crashes (SEGV in `libgfxstream_backend.so`, `TextureResize`) happened headful, the latest 25 minutes
  after a launch; the notes are in `doc/troubleshooting`. Verified only on the debug build and the emulator; the
  artist-tag patch of the rows has JVM tests but no device run (no artist tag arrived in the measured runs).
  Mutation check of the queue-cost code: 36 of 40 mutants killed, the four survivors are output-equivalent (a redundant
  guard or an extra pass). Mutation check of `keepsPlatformCommand` (throwaway worktree): 11 of 11 mutants killed (the
  removal dropped, applied to every controller, to none, to every controller but the notification one, another command
  removed, two commands removed, comparison inverted, range comparisons), plus 2 wiring mutants in
  `PlatformSessionCallback` that survive because no JVM test can build `Player.Commands` (it needs an Android runtime):
  the call to the rule and the notification-controller test are covered only by the device checks above.
  No JVM test reaches the `BrainPlayer` wiring (`playlistFor`, `stateWith`, `rowOf`, base-state reuse); shuffle and
  repeat were not driven on a device. The unit suite on the branch is 1129 tests, 0 failures (7 new); detekt and
  lintDebug pass. Verified only on the debug build and the emulator (Android 17, API 37); the lock screen, Android
  Auto, Wear OS and a car head unit were not seen.
- Review findings left open: look-alike letters (rail hairlines address it), red accent against the error roles, cold
  restore scroll, scroll anchoring when rows above change height, `project()` about 120 ms at 100k rows, the 117 px
  phantom view on the Android idle deck.
- Not measured or only partly done: cold-cache startup at 1M on desktop; a load sweep running with a user event on a cold
  open at 1M; Search with 1M tracks on an Android device (20 000 tracks: median 34 to 46 ms, worst 290 ms); Android
  `folderIndex` (about 1.5 s at 1M); long Android search terms (0.6 to 1.9 s off the main thread); shuffle-all queue
  paths are O(n); add and delete at 1M still cost about 0.4 s on the engine thread (building and announcing the list);
  no device latency is subtracted from the audible position; cross-format joins are not gapless.
- Not repeated on the device after the last Android changes: loose tracks, `In order` at the end of a folder, Search
  below the status bar, light and dark with three accents (dark was done).
- Empty Folders pane at 443 px with a saved session (2026-10-13): about 130 resize and restart cycles never reproduced
  it. The folded picker opened by Alt+1 or Ctrl+O before the library arrived did show no names, and that is fixed with
  five window tests; whether it was the original sighting is unproven.
- Android focus ring on lists (2026-10-13, `6afe69c81a`): track lists and the folder picker now show the ring only
  after a keyboard input (they drew it from list focus alone), and flush entries of clipped lists (track rows, Search
  results, template fields, letter rail cells) draw it just inside their edge (D120) with no reserved padding, which
  had clipped the rail cell ring. Folder names and menu rows keep the outside ring. Verified: detekt, 1044 unit tests,
  lintDebug, eleven mutations killed, before and after captures on the Fold emulator. Not verified: the Compose
  call-site wiring has no unit test; the template field ring was never seen on the device; dark scheme, cover display,
  the menu popup's keyboard ring, TalkBack and a real keyboard; the Android gallery PNGs predate this change (the
  first row of a list sits 3 dp higher now) and were not retaken. That emulator ran with `-no-window` on the host GPU, which the rule below bans.
- Stale docs: none known. The README gallery and the Android page-control text were rewritten on 2026-10-13, and the
  peak-sweep start path in `android-app/HANDOVER.peak-sweep-optimization.md` and
  `android-app/DECISION.peak-sweep-parallelism.md` was corrected.
- Hygiene: `~/temp/agent/agent-polish2/work/` and `~/temp/agent/agent-refresh-cost/lib-1m` (12 GB) hold scratch libraries
  that can be deleted. A failed decode is retried at every library change, one decode per failed file per change.
- Rate limit: on 2026-10-12 the Sonnet weekly limit stopped five agents mid-run; a re-login lifted it and they were
  resumed. Their work is committed; check `git log` before relaunching anything.
- Never verified: a real Plasma session, macOS, Windows, real Android hardware, Android API 33 to 36 for D107.

### Mistakes made in this effort, and what corrected them

Read these before repeating them. Each one cost the human a correction.

- The wiring-test agent (2026-10-14) committed `55f465c0b3` with no blank line after the subject, so the whole body is
  one long subject line, and an early step test looped forever under a mutant and blocked a mutation run for about 40
  minutes. Commits are never amended, so the message stays; the tests now fail fast with a read limit. Briefs for test
  agents should say that every test over a coroutine loop needs a bound, and that a commit body follows a blank line.

- Loose tracks were misread twice (first as an "Unfiled" folder, then as flat entries). The human decided that a loose
  root track lives in a virtual folder named by its rail letter (D28 for non-Latin initials, "#" for the rest). Reviewer
  finding LS1/M2 ("A" as a defect) was not a defect.
- The 0.3636 split ratio on devices without a crease (D110) and the Hangul font and test profile (D116) were listed as
  open after the human had decided them. Check `decisions.md` before listing anything as open.
- F5, Ctrl+Shift+F5, Shift+F10 and a "Re-analyze" menu row were added unasked. Refresh and re-analysis are never exposed
  (D113); Shift+F10 is "Run" in JetBrains and is unbound (D114).
- The nested compositor was pinned to 0.4.0 in the e2e config and committed (`e64f02e07e`) before the human said it
  needs no pin because the repo controls it. The pin was removed in `a0552c4cfc`.
- The compositor was said to be unable to do something it could do after a feature was added; the human had already
  authorized adding features to it.
- Browser focus-ring behavior was asserted from memory. Reading the Firefox and Chromium sources showed the memory was
  of the 2019 Firefox `outline: 1px dotted`, and D117 was revised twice before the Firefox form was chosen.
- The agent-reported failed-decode retry rule (retry only when a path is named) contradicted D113 ("next library
  change") and was sent back before it was accepted. Compare agent output against the decision text, not the agent's
  own summary.
- Decisions were left as "waiting on the human" in prose and in this handover instead of asked through the question
  tool. Corrected on 2026-10-13; the same day the answers became D120 and D121.
- A turn ended with tracked work still queued (the polish list), and the report said "not started". Tracked work left
  means start the next item in the same turn.
- A wait loop that used `pgrep --full` matched itself and ran for 14 hours; it was killed by PID. Wait on a unit state
  or a file, never on a pattern that can match the waiting command.
- A command ran `rg` without a path and read the worktree root. Always pass a path.
- I wrote in a brief that `-no-window` on the host GPU had worked, and the agent launched a headless emulator, which
  the human reports breaks frequently, although this handover already said to launch headfully. The ban is now the
  rules EMW and EMB in the `android-emulator` skill (`.agents/skills/android-emulator/SKILL.md`), a section in the troubleshooting document, and the brief of every emulator agent:
  headful on the host GPU as its own systemd unit, never `-no-window`, `xvfb-run` or a container, and on a failed
  launch report the error instead of falling back.

## Queue

- [x] Package 1.
- [x] Package 2.
- [x] Packages 3 to 12 landed on `main`; device-only and live-desktop behaviours remain unexercised (see the handoff).
- [ ] Release builds, signing and distribution are outside this plan and were not touched.
