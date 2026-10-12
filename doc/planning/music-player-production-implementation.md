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
and the decisions D106 to D112 at the end of `package/music-player/design/decisions.md`.

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
  (`package/cli/nested-wayland-session`, 0.3.0 installed: notifications and Plasma job fakes, `--accent-color`,
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
  config, so `mise run //package/music-player/android-app:build:native` works (about 7 minutes); nested compositor 0.3.0.
- Desktop: Settings per D109 and D110; playback position equals the audible position and same-format neighbours are
  gapless (`src/playback_clock.rs`, `Queue::peek_next_natural`; cross-format joins add a 43 ms hold and are not
  gapless); Search on the in-memory index with the 1M scale fixes (D111, D112; 1M tests in the normal suite;
  `MUSIC_PLAYER_SCAN_PAUSE_MS` slows the scan for hand tests); the D106 keyboard map (`src/keymap_bindings.rs` is the one
  table behind the classifier, badges, tooltips and menu rows), focus ring, hint badges and double Shift; the theme in
  OKLCH from the OS accent; the audio underrun meter and rtkit priority; the taskbar progress state machine.
- End-to-end runner: `package/music-player/desktop-e2e`, run by `mise run //package/music-player/desktop-app:test:e2e`
  (74 pass, 0 fail, 5 not injectable: F5, Shift+F10, Menu, Ctrl+Shift+F5, double Shift with repeats). It plays only into
  its own PipeWire null sink and never signals the user's player.
- Android: D107 notification with its device pass (three defects fixed: first-launch start, the API 35 time-limit
  `onTimeout(int, int)` crash, the legacy channel on upgrade); Settings per D109 and D110 with crease detection through
  `FoldingFeature`; Search on the in-memory index plus a scan pipeline that builds the library off the main thread; the
  OKLCH theme.
- Shared theme: the light baseline was retuned for AA under state layers (D108, primary delta-E 3.46, open to veto); one
  fixture of 52 roots (`android-app/app/src/test/resources/theme-roles-vector.txt`) is checked by a test on each side, and
  the Rust drift test fails if either side changes alone.

### In flight when this was written

Five agents were running at 2026-10-12. Their input is the two review reports,
`~/temp/agent/agent-polish2/README.md` (desktop: 1 severe, 16 major, 33 minor) and
`~/temp/agent/agent-polish-android/README.md` (Android: 2 severe, 9 major, 14 minor). Each agent leaves its work
uncommitted in the worktree `~/temp/agent/music-player-production`; the orchestrator commits with explicit pathspecs
(scratch `.ts` scripts), and hunks shared between agents go into one combined commit after all of them finish.

- Desktop interaction: Search and toast click-through, track menu position in the two-pane layout, Play/Pause focus ring,
  accessible roles on rows, transitions, header heights, template editor messages.
- Desktop playback and library: virtual letter folders and the single-folder name, scanning state, disabled deck in empty
  states, undecodable and deleted tracks, Undo through a symlinked path, `In order` stopping at the folder end, American
  spelling, stale README, default music folder.
- Desktop lists: ellipsis for long names, picker reveal of the selection, scrollbars (D22), scroll smoothness at 10 000
  rows, the split Hangul glyph.
- Android logic: shuffle history crash (duplicate playlist id), template parsing and file opens off the main thread, `In
  order` stop, File details, stale deck states, sweep for new files, launcher icon, copy, template editor.
- Android layout: crease clearance on the player and everywhere text is drawn, Search under the status bar, the rail as
  one Tab stop with a visible focus ring, the D106 bindings that make sense on Android, font scale 2.0.
- Decisions made while they run: loose root tracks live in a virtual folder named by their rail letter (the human,
  2026-10-12), and Search drops its "Unfiled" folder result in favor of that letter folder on both platforms; `In order`
  stops at the end of the folder (D2 beats the README and the `PlaybackMode.kt` comment); a library falls back to the home
  Music folder when `XDG_MUSIC_DIR` is unset (D95); the button reads "Open folder".

### Open, not started

- Waiting on the human: the D108 retune (primary moved 3.46 delta-E, accepted by the orchestrator), the D112 veto, filing
  the two Turso bugs from issue 678, the `[profile.dev]` and `[profile.test]` `opt-level = 1` proposal (the desktop test
  suite ran 3.99 s instead of 8.9 s in a sandbox, at the cost of a 12.5 minute cold dependency build), and `targetSdk` staying on 36 until a device test.
- The Rust drift test reads the Android fixture and fails under the `containerCargo` fallback, which mounts only the
  desktop package (task 66).
- Review findings the fix agents may leave open: look-alike Latin, Cyrillic and Greek letters in the rail, red accent
  confusable with error roles, cold restore scroll, the 117 px phantom view on the Android idle deck. Read their reports.
- Not measured or only partly done: cold-cache startup at 1M on desktop; Search with 1M tracks on an Android device;
  Android `folderIndex` (about 1.5 s at 1M); long Android search terms (0.6 to 1.9 s off the main thread); shuffle-all
  queue paths are O(n); no device latency is subtracted from the audible position; the e2e default library still comes
  from a private scratch generator when present.
- Android keyboard end-to-end checks beyond `adb input keyevent`; hint badges on Android; pause and resume of the analysis
  notification on a device after the fixes; Trash Undo restoring a file.
- Stale docs: `HANDOVER.peak-sweep-optimization.md` and `DECISION.peak-sweep-parallelism.md` in `android-app` still say
  the service starts from `MainActivity.onCreate`; the desktop README after the fix agents; the Rust comment blocks the
  repo's skill asks for.
- Hygiene: `mise.lock` shows about 400 added lines of platform entries after `mise` runs in the worktree, which must not
  be committed with feature work; `~/temp/agent/agent-polish2/work/` holds large scratch libraries that can be deleted.
- Never verified: a real Plasma session, macOS, Windows, real Android hardware, Android API 33 to 36 for D107.

## Queue

- [x] Package 1.
- [x] Package 2.
- [x] Packages 3 to 12 landed on `main`; device-only and live-desktop behaviours remain unexercised (see the handoff).
- [ ] Release builds, signing and distribution are outside this plan and were not touched.
