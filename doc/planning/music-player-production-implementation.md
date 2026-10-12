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

## Handover: open work queue (2026-10-11 night)

This section is the canonical state for the next session. Read it, then `git log` on `feat/music-player-production`.

### Working agreements set by the human

- The human checks only `main`, and `main` is not sacred: merge as soon as tests, lints and clippy pass, and say plainly
  what has not been driven in a window.
- Use subagents for parallel work (Haiku by default; a Sonnet agent where the human asked for one). Do not start more than
  can be verified; take items one at a time and keep this list current.
- Polish standard: every clickable element has hover, pressed and pointer-cursor feedback; no copy or layout that a user would
  call unfinished; verify by driving the real window (nested compositor: `package/cli/nested-wayland-session`, which may be
  improved: bump its version and it auto-releases, then run `mise upgrade`).
- Scale: 1 000 artists and 1 000 000 tracks is normal operation (tests at 1M belong in the normal suite); above that is
  unsupported. The real library to seed names from is `/home/user/Seafile/Plain/Music` (read only; 206 folders, 4262 files).
- Never set the emulator display density with `wm density`; use the Settings app's Display size slider, or Developer options
  "Smallest width", through the UI, and restore it.
- Shortcuts: D106 in `package/music-player/design/decisions.md` (JetBrains style, key hints when modifiers are held,
  double Shift opens Search on the player page only). Every shortcut needs an end-to-end test.
- Never use the word "finished" for a UI until the user-eyes pass is clean; a Sonnet review found the first "final state"
  was not.

### Landed on `main`

- Inter Variable font, thin LTO, `run-quick` task, Settings dividers removed, Folders panel no longer re-wraps,
  tapped rail letter circled, deck title click, Search covers only the right pane when unfolded, "Open dir",
  the unfolded folder pane heading shows the opened folder (Android: "MediaStore" for the system library).

### Committed on the branch, to merge to `main`

- Desktop: StateLayer and hover, pressed and pointer feedback on every TouchArea; deck heading `folder / title` with two
  click targets; one-line transport and mode control; steady seek bar (fixed-width time labels); mode control that slides
  and fits one row at 443 px (segment padding 10); whole-pixel geometry; list scrolls only when asked (single scroll
  offset and tick, startup reveal waits for the restored track, cancelled by any user action); Settings page in the stock
  Android Settings look. 616 tests, clippy and slint lint pass.
- Android: deck heading `folder / title`, one-line deck controls, list scrolls only when asked, Settings page in the stock
  look. Detekt and unit tests pass. None of the Android work has been seen on a device since the Settings redesign.

### In flight (agents; read their reports when they arrive)

- Audio stutter under load: own worktree `~/temp/agent/audio-work`; maps the pipeline, adds an underrun counter, measures
  on a silent null sink with CPU load in a capped unit, then fixes (analysis worker priority and count, ring depth,
  output buffer size, real-time work in the callback).
- Nested compositor 0.2.0: worktree `~/temp/agent/nws-work`; adds `move`, `button down|up`, `title`, `app-id`,
  `launcher`, `launcher-log`, `launcher-clear`, `--launcher-log`. After review: merge to `main`, wait for the release,
  `mise upgrade`.
- Scale testing: worktree `~/temp/agent/scale-work`; generator `~/temp/agent/agent-scale/make-scale-library.ts`, pure-logic
  scale tests desktop and Android, real-app measurements at 1M, bottleneck list (suspect: per-update O(N) work in
  `view`/`pages`).
- Stock Settings two-pane capture on the unfolded screen (first run saw one column only; second agent retries and may use
  Developer options "Smallest width"). Output under `~/temp/agent/agent-settings-ref2/`.

### Not started

- Slint bump to 1.18.1 (latest on crates.io, 2026-09-21) in `file-enforcer.config.ts` (shared dependencies), the
  per-crate `i-slint-backend-testing` pin, three lock files (music-player, desktop-app ide, desktop-app terminal), rename
  `viewport-*` to `content-*`, check the ICU duplicate pins in `doc/troubleshooting/slint-parley-icu-cjk-segmentation.md`.
  The `lint:slint` task uses `slint-viewer` 1.18.1 while the app compiles against 1.17, so it passed code that did not
  build; make lint compile with the app's version.
- Taskbar progress jumps (KDE LauncherEntry). Harness `~/temp/agent/taskbar-check/record.ts` records signals on a private
  D-Bus session. The first run showed no `visible=true` signals; another agent had killed the instance and playback state
  was unclear. Suspects: old position over the new duration at a track change, debounce dropping the visible signal.
  Use the compositor `launcher-log` once released.
- Turso full-text search instead of our matcher: Turso 0.8.2 is current (we pin 0.6); its repository has an FTS index
  (`CREATE INDEX ... USING fts`, Tantivy based, `ngram` tokenizer). Check release status, CJK and one-character queries,
  1M-row build and update cost, Android, and the peak cache file migration. Keep the highlighter and D58 to D74 on results.
- Keyboard map and focus model (D106), key hint badges, double Shift, end-to-end runner as a package mise task.
- Polish review packages (report in `~/temp/agent/agent-polish/`): clicks fall through Search, Settings and the editor to the
  hidden player (severe); Escape does not leave Settings or the editor; scan bar and toasts cover controls and the scan
  bar never animates; long names have no ellipsis; loose root tracks are bucketed under a letter and the deck labels
  follow the browsed folder; first-run shows a dead deck; header heights and button styles are inconsistent; "time dBTP"
  has no separator; developer wording in template errors; nothing reachable by Tab and no focus ring; many controls lack
  accessible labels; no motion; contrast is low in places (a design question, D41).
- Android clickable audit leftovers (`MainActivity.kt` legacy page tabs), the unexplained intermittent first-click miss on a
  rail cell, an Android user-eyes pass, and the `AGENTS.md` proposal to tighten `VUB` (a UI is done only after it has been
  driven the way a person uses it).

## Queue

- [x] Package 1.
- [x] Package 2.
- [x] Packages 3 to 12 landed on `main`; device-only and live-desktop behaviours remain unexercised (see the handoff).
- [ ] Release builds, signing and distribution are outside this plan and were not touched.
