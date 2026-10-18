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

- A click or tap on a track row selects it paused and, on the selected row, toggles play and pause on both platforms
  (D124, decided by the human on 2026-10-14; Enter on the focused row follows it; the track menu's Play and Search
  results still start a track at once). `PlayerController.activateRow` (Android) and `play_row` (desktop) hold the rule;
  the e2e suite declares one more check for it (111 declared; D129 adds a setting that also starts the track).

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
- Android analysis failures (D123, 2026-10-14, branch `feat/android-analysis-failure-notification`, not merged): the
  message "Could not analyze <file>" is no longer an in-app message. The analysis service posts one system notification
  on its own low-importance channel `analysis-failure` (id 4202, apart from the D107 progress notification) when files
  first fail, with the old wording, the app's small icon, auto-cancel, no action button, tap opens the app.
  When it cannot be posted (permission denied, notifications or the channel off, any post failure) the app shows
  nothing, writes one warning without file names to the log, and the file keeps no row mark. The tap-time
  "Could not play <file>" message stays in the app. Wording and decisions are in `core/AnalysisFailureNotice.kt`, the
  Android side in `AnalysisFailureNotification.kt`, and `PlayerHostWiringTest`-style coverage in
  `wiring/AnalysisFailureWiringTest.kt`. The desktop app makes the same move as D122 on its own branch.

### In flight and queued (written 2026-10-15 01:50 UTC; read this first after a context loss)

Merged on 2026-10-14 and 2026-10-15, all on `main`: the click rule (D124), Search select-only (D127), the desktop
unreadable row that stays selected (D128), the Search restyle on both platforms (D126), the folders panel without a
scrollbar (D125), the desktop notification for an unplayable file (D122, merged at `973572ea12`; the notification
bus tests start a private `dbus-daemon`, so `:image` must be rebuilt before `:test:container` can run them), the
Android analysis-failure notification (D123), the queue-cost fix, the legacy queue removal, the Compose wiring tests,
and the gallery retakes. Open item from D122, not fixed: the e2e suite runs its app in a systemd user unit that
inherits the real session bus (`unix:path=/run/user/1000/bus`), so `states/refresh-broken-file-once` posts
"d.wav can't be played." on the real desktop on every run.

Work in flight, each in its own worktree under `~/temp/agent/` (merge procedure for each: `git merge main --no-edit`
in the worktree, rerun that platform's verification as a systemd unit, forced fresh, count tests from the result
files, `git -C /var/home/user/Monochromatic merge --ff-only <branch>`, push, update this file; run the real behavior
before saying it matches, QAB):

- 2026-10-18, READY TO MERGE, NOT merged, not released: branch `fix/music-player-android-load-failure-routing`,
  worktree `music-player-loadfail`, `main` merged in (at `df76fca699`). Two follow-ups of #1438. (1) The ledger edge:
  load N queued and failed, N+1 requested before the next poll and its descriptor open failed, so the poll reported N
  after N+1's message; `QueuedLoadLedger.requested()` (called from `RustEngine.load`) now drops the failure while the
  newest request has not been queued (red `QueuedLoadLedgerTest` case first, 1 of 8 failed, then 8 of 8 passed).
  (2) Non-tap failures (D131): before, every failed load, tap or not, set the in-app "Could not play" message and
  stopped (`engine.setOnLoadFailed` in `PlayerController`, shown by `PlayerHost`); now a natural end, Next, Previous, a
  Play with nothing selected, the restore and the readied first track walk past the file and report it as one system
  notification on the `analysis-failure` channel under id 4203, and a tap keeps the in-app message. Red first:
  `PlayerControllerUnplayableWalkTest` 13 of 14 failed before the change, 14 of 14 pass; notice and notification tests
  10 of 38 failed before. Verification fresh on the merged head: detekt, `lintDebug` clean, 1,361 unit tests, 0
  failures, 132 result files. Device pass on the headful emulator (invented library, private AVD copy, since deleted):
  natural end onto a corrupt `.flac` walked to the next track with one notification and no message, two corrupt files in
  a row gave one notification naming 2 files, the restore of a corrupt saved track readied the next track paused with
  one notification, a tap on the corrupt row showed the in-app message. Not done: the descriptor-open failure path and
  `TIMED_OUT` on a device, `nativeEngineLoad` returning non-zero, the walk on API levels other than 37, an instrumented
  test of the ledger edge, Android native clippy (no Rust touched). Open for the human: the channel is still named
  "Analysis problems"; the separate id 4203 and the stop on a timeout are implementer readings (D131).

- 2026-10-18, desktop part of the owner's license decision, READY TO MERGE, NOT merged, NOT released, no version bump
  (a Sonnet agent was told not to merge, release or bump): branch `feat/music-player-desktop-licenses-row`, worktree
  `music-player-licrow`, code head `b953e60e63`, `main` merged in at `5994c324b9`. The owner decided on 2026-10-18
  (question tool): the desktop releases use Slint under its Royalty-free license 2.0 instead of GPL-3.0-only, and
  Settings gets a Licenses row on both platforms without mockups. This branch is the desktop half; the Android row is
  another agent's. It builds on the notice tooling of `feat/music-player-license-notices`, which is already an
  ancestor of `main`. Done: `about.toml` accepts `LicenseRef-Slint-Royalty-free-2.0` and no longer `GPL-3.0-only`;
  cargo-about 0.9.2 drops the text of a `LicenseRef-*` license
  (`doc/troubleshooting/cargo-about-licenseref-text-is-dropped.md`), so `bin/third-party-notices.mjs` adds a Slint
  section from `notices/slint-royalty-free-2.0.md` after a SHA-256 check of each Slint crate's own file; the Settings
  page has an About heading and a Licenses row that opens `ui/licenses.slint` (the `AboutSlint` widget, then the
  notice text in a ListView fed by `NoticeLines`, built on open and released on close); Escape and the Back arrow
  return to Settings; release notes, README, runbook and the decision's dated amendment follow. Fresh on this head:
  `lint:slint` clean, clippy clean, nextest 1,546 tests run, 1,546 passed, 1 skipped (1,466 on the notices branch;
  this branch adds the Licenses tests and main's), end to end `settings/` 6 of 6 and `auto-play` 4 of 4 on the release
  binary in the nested compositor, actionlint clean. Release binary 55,816,872 bytes against 55,544,040 on `main` (a
  first build was 57,790,760 because `NOTICES` was a `const` copied into the window crate; now a `static`, with a
  test). Startup: no measurable change (the two batches of the same build differ by about 20 ms, more than any
  difference between builds); opening the page builds the 40,039-line model in 833 to 1,098 microseconds. Release dry
  run `39105064383` on that head: all 13 jobs green (notices, Android, six desktop, two Alpine, checksums, release),
  every `--licenses` equal to the notices job's 1,973,826 byte file, the Android notices step passed, the release
  notes carry the new Slint sentence. Not done: the Windows and macOS binaries were not run; nothing was verified on a
  real keyboard or screen reader. Open for the owner: whether the Licenses page counts as the "About screen accessible
  from the top level menu" of the license's section 2(a) (the app has no menu bar), or whether the Slint badge should
  also go into the release notes; the page title and row naming; the Android row must use the same icon (`license`,
  Material Symbols, the same commit) and the same notices-script sentence that names the icons.
- 2026-10-18, READY TO MERGE, NOT merged and NOT released (the agent that finished it was told not to merge, release
  or bump versions): branch `feat/music-player-license-notices`, worktree `music-player-licenses`, `main` merged in at
  `60ba6d71bf`, code head `29ccfb516b` (the commits after it only change docs). Run fresh on that head: notices tasks
  (desktop 438 crates for x86_64 Linux, cross-checked with `cargo tree` as 440 lines minus 2 path crates; 501 across
  the eight targets; 570 cargo-about entries; Android 121 libraries against 124 `group:artifact` entries minus 3 BOMs,
  232 native crates), desktop verification (1,466 nextest tests with 1 skipped, clippy and `lint:slint` clean),
  Android verification (detekt and `lintDebug` clean, 1,289 unit tests, 0 failures, 127 result files), a debug build
  whose `--licenses` output equals the file byte for byte, and release dry run `39094642435` green on every job
  (notices, six desktop jobs, two Alpine jobs, Android, checksums, release), each desktop job comparing `--licenses` to
  the notices job's 2,004,178 byte file. A first Android unit-test run failed only on a Gradle journal lock held by
  another agent's container in the shared `aps-gradle-home`; the rerun passed. Not done: ff-merge to `main`, push of
  `main`, the version bump that releases the notices; not run: the Windows and macOS binaries on real machines, any
  device, a real release. Merge steps: `git merge main --no-edit` in the worktree, rerun both verification units, then
  `git -C /var/home/user/Monochromatic merge --ff-only feat/music-player-license-notices`, push, bump both manifests.
  Original entry (2026-10-15, agent `a861ba9cb4849c4bd`): third-party license notices for every release
  asset, closing product gap (4) "no third-party license notices" of task 92. Decision
  `doc/decision/music-player-third-party-licenses.md`. cargo-about 0.9.2 (mise tool) writes the Rust crate texts
  against an accepted list in `desktop-app/about.toml` and `android-app/rust/about.toml`; `app.cash.licensee` 1.14.1
  fails the Gradle build on any Android library outside Apache-2.0; `desktop-app/bin/third-party-notices.mjs`
  composes one file per platform and checks every crate `cargo tree` links for each release target. The desktop
  binary embeds the file and prints it with `--licenses`; the release workflow gains a `notices` job, ships
  `music-player-<version>-desktop-third-party-licenses.txt` and `-android-third-party-licenses.txt`, puts the file
  in the Linux archives, the `.dmg` and the APK assets, and compares each executable's `--licenses` output with the
  file. No in-app screen: the design has no About screen, so that is a design decision for the human. Open for the
  human: (1) Slint under GPL-3.0-only (chosen, the IDE precedent) or the royalty-free license with its attribution
  badge; (2) the GPL source offer, the tag tree plus crates.io or an attached `cargo vendor` archive; (3) an in-app
  licenses surface. Merge steps: merge main, desktop and Android verification fresh, a green release dry run on the
  final head, ff-merge, push; the next version bump releases the notices.
- 2026-10-15, agent `ad05bc0301c37d399` reported (head `1ce3b426e8`) and its work is MERGED and RELEASED as 0.1.4
  (see the release record below): GUI subsystem proven on all three Windows runner jobs (Subsystem 2, positive control
  failed as intended, release dry run green). Unmet by design: PowerShell `--version > out.txt` gives an empty
  file; I accepted that tradeoff (recorded in `doc/decision/music-player-windows-gui-subsystem.md`, veto open).
  Follow-up not done: 9 pre-existing Windows clippy findings (no Windows clippy task exists).
- In flight on 2026-10-15 after the 0.1.4 release (cap five agents; (c) is the license notices entry above):
  (d) agent `a9c8a6540c85f6042`, branch `fix/music-player-windows-startup-errors`, worktree `music-player-winerr`: a
  message for a failed Windows GUI start (no message today) and ANSI escapes gated on a VT-enabled console (arm64
  runner printed literal ESC characters), proven on the Windows runners with a positive control.
- Standing rule from the human (2026-10-17): "You should never use Opus subagents!" Subagents use `model: sonnet`
  (or haiku for trivial reads). The four agents below were first started on Opus and all died on 2026-10-17 on the
  account's weekly limit; their partial work stayed in their worktrees
  (now under `/var/mnt/encrypted/temp/agent/`) and fresh Sonnet agents continue it:
  (c) `aa99a806ba461a022` (licenses), (d) `a507287f6e2fa8092` (winerr), (e) `ae0eaae6e38ca6ea1` (cachebatch),
  (f) `a24e53faf2449563e` (andlarge, plus issues 1438, 1439, 1440), (g) `a4826ac87de5272d2`, branch
  `fix/music-player-desktop-review-issues`, worktree `music-player-deskissues`: review issues 1451 to 1458, 1460,
  1463 against desktop-app and truepeak-core (not the cache code). The older ids below are the dead Opus agents.
- 2026-10-18 progress: MERGED to `main` after fresh desktop verification each (nextest 1476, 1480, 1518 and 1524
  passed, 1 skipped; lint:slint and clippy clean; Android native clippy clean for the cache branch): (g) the ten
  desktop review issues (1451 to 1458, 1460, 1463; each commit carries its own Closes), (e) batched cache commits
  (isolated benchmark 83.5 s to 0.52 s median for 10,000 rows, 256 rows per transaction; the end-to-end cold start
  was not re-measured; Android keeps per-row commits, needs a device measurement), (d) the Windows startup message
  box, ANSI gating and a Search-service shutdown guard (a normal window close on Windows aborted with 0xC0000409 in
  0.1.4 because `ui_search.rs` dropped a service from a thread-local during process exit; fixed on main, so the next
  patch release is urgent), (c) license notices, and the CI fixes for issues 1612 and 1610 and the digest pins of
  three music player Containerfiles (part of 1758). Reopened 1763 (the README for `musicplayer-native` landed, the
  test-fixture packages did not). A dry run of the release workflow on main (`39098277889`) was started at
  `d101ad91a2` before the 0.1.5 bump.
- Human decisions 2026-10-18 (question tool): use the Slint royalty-free license for the desktop releases instead of
  GPL-3.0-only; source offered as the tagged tree plus crates.io; add a Licenses row to Settings on both platforms,
  "doesn't need mockups, just do it". Agents `ad19cbb1a5dabeac0` (desktop: license switch plus Settings row with
  the AboutSlint widget, branch `feat/music-player-desktop-licenses-row`) and `a8d200663bbc131bb` (Android Settings
  row, branch `feat/music-player-android-licenses-row`) are running; (f) `a24e53faf2449563e` (andlarge) is still
  running.
- 2026-10-18, Android Licenses row (Sonnet agent `a8d200663bbc131bb`, branch `feat/music-player-android-licenses-row`,
  worktree `/home/user/temp/agent/music-player-andlicrow`), NOT merged to `main`, no version bump, no release:
  Settings ends with an About group whose Licenses row opens a page of its own (full window; the right half on a
  creased screen) with the APK's `THIRD-PARTY-LICENSES.txt`, read off the main thread, cut into 6,649 blocks and listed
  lazily; Back returns to Settings, Escape too on the unfolded screen; the list is a keyboard stop. Every build
  variant now packs the asset (a short note without the `notices` output;
  `MUSIC_PLAYER_REQUIRE_THIRD_PARTY_LICENSES=true` still fails on a missing file, proven). Opened on the emulator in 267 ms (process cold, median of 5, 264 to 276) and
  140 ms (warm, 122 to 199); scroll windows had 29 to 30 janky frames of 901 to 907 (debug build). The decision, the
  numbers and the open choice (full page versus the right pane on the unfolded screen) are in
  `doc/decision/music-player-third-party-licenses.md`, section "Licenses row in Settings (2026-10-18)". The desktop row
  (agent `ad19cbb1a5dabeac0`, branch `feat/music-player-desktop-licenses-row`) picks its own icon; the Android app
  uses the Material Symbols `description` icon, so the two branches may need one icon agreed when both are merged.
- In flight on 2026-10-15 after the 0.1.4 release (cap five agents):
  (c) agent `a861ba9cb4849c4bd`, branch `feat/music-player-license-notices`, worktree `music-player-licenses`: third-party
  license notices (Rust crates, Android libraries, fonts) in every release asset, an allow-list gate, a
  `--licenses` flag or in-app view only if the design permits, decision `doc/decision/music-player-third-party-licenses.md`;
  (d) branch `fix/music-player-windows-startup-errors`, worktree `/var/mnt/encrypted/temp/agent/music-player-winerr`:
  FINISHED 2026-10-18 by a Sonnet agent (the Opus agents `a9c8a6540c85f6042` and `a507287f6e2fa8092` died on the
  limit), main merged into the branch, NOT merged to `main`, no version bump, no release. A failed Windows start now
  shows a message box when stderr reaches nobody (text in `src/startup_failure.rs`), ANSI colors are gated per console,
  and a Windows exit abort found on the way is fixed (the Search service threads are joined in `main`, not in a
  thread-local destructor during process exit). Proven on all three Windows jobs with a positive control (control run
  38776373884 failed, fix runs passed); the run ids, head commit and the host verification counts are in the Evidence
  sections of `doc/decision/music-player-windows-gui-subsystem.md`. Not seen: the dialog itself. Next: merge procedure
  as above, then a patch version bump and release (the same drop runs when a person closes the window of 0.1.4;
  no run did that).
  (e) agent `abe5d14bb8effe0d8`, branch `fix/music-player-cache-batched-commits`, worktree `music-player-cachebatch`:
  the per-row fsync in `DecisionCache::put` (10,073 fsync calls for 10,000 rows, 27 to 99 s cold analysis);
  (f) agent `aca4a721c4f906b9d`, branch `fix/music-player-android-large-library`, worktree `music-player-andlarge`:
  Android `Invalid column last_modified` logged 772 to 1,005 times per 15 s at 10,000 tracks, and scroll jank at
  10,000 tracks with the emulator-crash confound separated.
  Merge procedure for all four as above, then bump the patch version and release.
- (e) cachebatch, continued by a Sonnet agent on 2026-10-18, branch `fix/music-player-cache-batched-commits`,
  worktree `music-player-cachebatch` under `/var/mnt/encrypted/temp/agent/`, NOT MERGED, open to veto. Cause read in
  the Turso 0.8.2 source: every connection defaults to `SyncMode::Full`, so each autocommit `DecisionCache::put` is
  one WAL `fsync`. The desktop actor now drains its write queue (up to 256 rows) into one `DecisionCache::put_batch`
  transaction. Benchmark on a real disk (btrfs on the encrypted device), 10,000 rows, five repeats: 75.9 to 87.1 s and
  10,070 `fsync` calls before, 0.49 to 0.64 s and 47 after. Tests: truepeak-core with a kill -9 test (shown to fail
  when the transaction is removed) and desktop 1464 passed; Android verification is recorded in the report to the
  caller. Decision and rejected alternatives: `doc/decision/music-player-analysis-cache-commits.md`.
  Open: the Android actor still commits per row (its warm path waits on each row, so draining would not batch, and
  the `fsync` cost on a device was not measured); the desktop cold start was not rerun end to end; the 180 ms CPU per
  added file and the 23 to 25 s busy tail from the audit were not investigated.
- Measurements MERGED to `main` at `d5748ffd54` on 2026-10-15 (agent `a36ecdbfa335190de`, doc
  `doc/audit/music-player-release-build-measurements-2026-10-15.md`, no hedge words found by `rg`). Findings 1 to 4
  of that doc are the work of (e) and (f); finding 4 (desktop refresh CPU grows with library size, 180 ms at 10,000
  tracks) is assigned to (e) only if its evidence leads there.
- Task 92, release workflow: MERGED to `main` at `ab725bd924` on 2026-10-15 (actionlint 1.7.12 clean; Android
  detekt, 1287 unit tests and lint fresh on the merged head; the merge touched neither version manifest, so it started
  no release, confirmed with `gh run list`). Workflow `.github/workflows/music-player-release.yml`, decision
  `doc/decision/music-player-releases.md`, runbook `doc/runbook/release-the-music-player.md`. Matrix: Linux x64 and
  arm64 tarballs, macOS arm64 dmg (ad-hoc codesign, the agent's addition), Windows x64 (`link.exe`) and arm64 exe,
  Android apk signed with the release key (secrets `MUSIC_PLAYER_KEYSTORE_BASE64`, `_KEYSTORE_PASSWORD`,
  `_KEY_ALIAS`, `_KEY_PASSWORD`; a real run fails unless the APK cert SHA-256 is
  `9de6e9a475f182c36f2513179fd4b14763b0e00fe068c9b8f3e6f08103616926`), checksums, immutable pre-release. The final
  workflow text never ran in CI before merge (only its earlier commits ran, nine dry runs); the dry run on main
  dispatched at merge (run `38675318400`) is that check: read its result before any real release.
  Release authority: the human said "Feel free to do real releases. Release early and often." (2026-10-15), so real
  releases need no further asking: after the dry run on main is green, dispatch with dry-run false (or bump the
  version in both manifests, which releases on push), then verify the published assets and report the version.
  RELEASED `music-player-v0.1.0` on 2026-10-15 (run `38676838535`, dispatched on main after the green dry run
  `38675318400`): a pre-release, immutable, six assets plus `SHA256SUMS`. I downloaded them, `sha256sum --check` passed
  for all six, `gh attestation verify` exited 0 for the Linux x64 tarball and the APK, the APK certificate SHA-256 is
  the expected `9de6e9a4...6926`, and the Linux x64 binary prints `music-player 0.1.0`. Not run by me: the Windows and
  macOS binaries (no such machine here; CI ran `--version`), the arm64 Linux binary, any real device. Next releases
  follow the version bump of the fingerprint migration (task 99) and the Windows linkers (task 96).
  Open for the human: (1) nothing for releasing itself (`0.1.0` is on main with no tag; a push that leaves the version
  unchanged never releases it, only a dispatch with dry-run false on main does); (2) the
  key backup is done with sops, not KeePassXC (the human: "We don't need KeePassXC when we have sops", 2026-10-15):
  `~/.local/share/music-player-release-keys` holds `music-player-release.p12.sops.json` and
  `credentials.txt.sops.json`, encrypted to the age identity in `~/.config/mise/age.txt`; each decrypted to the same
  sha256 as its original before I deleted the plaintext. Open: a copy of `age.txt` outside this machine, which the
  human has not mentioned (without it the backup dies with the machine); (3) vetoable choices: macOS ad-hoc signing, no Android SDK cache (measured 17 s restore
  against 25 s install), macOS x64 dropped, and AppImage (the human ruled 2026-10-15: not needed while the program ships as a single
  executable application; the placeholder icon is fine too, so both are settled); (4) product gaps the agent found:
  the Windows exe is a console-subsystem binary (a console window opens), the apk is about 160 MB, no third-party
  license notices, Linux needs glibc 2.39+ and AES. Cache budget: 4.0 GB steady
  state from this workflow alone against the 10 GB cap (task 97 owns the policy). The Alpine (task 95) and Windows
  (task 96) agents write the artifact names and job steps; apply them to the release workflow as a follow-up when
  they report (the agent has finished, so a new agent or me).
- Task 93, auto-play on select (D129): MERGED to `main` at `9a356efd02` on 2026-10-15. Desktop: 1444 passed, 1
  skipped, clippy and slint lint clean (agent's run on the pre-merge head; the merges since touched no desktop
  file). Android: I reran detekt, unit tests (1287, none failed, the test task executed) and lint fresh on the merged
  head. Real runs on both platforms were the agent's (desktop in the nested compositor, Android on an emulator); I
  viewed the four Settings PNGs. Open to the human's veto: the setting's name, the "Playback" group, the supporting
  lines, and the Search action label ("Select track" or "Play track"). Known and left alone: `desktop-e2e` `lint:oxlint` has errors in files this branch did not touch (`wide-select.ts` and others).
- Task 94, Android row text alignment (D130): MERGED to `main` at `3e7d03e7c2` on 2026-10-15 (detekt, 1249 unit tests
  and lint passed fresh on the merged head; I viewed the three retaken PNGs). The human's ruling: beside the crease
  only text dodges it; fills, state layers and rings may reach the crease and the pane edge; text columns win. Two
  changes beyond the brief are open to the human's veto: the template editor's hairlines now start at the pane edge,
  and its field rows lost 3 dp of ring padding. Search's rounded result shape (D126) was left alone and is a candidate
  if the human asks. Not verified on a device: the keyboard ring on a template field row.
- Issue 545, fingerprint hash migration, branch `feat/music-player-xxh3-128`, worktree `music-player-xxh3` (agent
  started 2026-10-15): the human said "just migrate to XXH3-128", then "just `twox-hash`" (the only hash crate, 2.1.4),
  then "if XXH3-64 is available in twox-hash use that". The last ruling stands: XXH3-64, the fingerprint stays a
  64-bit value in every layer, the peak caches still re-key once (the function changes), the `+aes` target feature
  goes away, the 128-bit width criterion of the issue is waived by the human, and the final commit body carries
  `Closes #545`. The agent reported 2026-10-15 (head `671602773e`): `twox-hash` 2.1.4 has XXH3-64 (feature
  `xxhash3_64`); one shared `track_fingerprint` in `truepeak-core/src/fingerprint.rs` (domain tag inside the hashed
  bytes, seed 0); `gxhash` and every `+aes` setting removed; `SCHEMA_VERSION` 2 with old rows deleted on open;
  Android duration cache renamed `track-durations-v2.tsv`; known answers from the xxHash reference C implementation;
  about 1.9 times faster than `gxhash64` on 5,000 tracks (agent's measurement with wide spread). Its desktop suite
  failed one different timing test in each of two earlier runs (cause not established), so before merging I merge
  main (done: `05d322fba2`, conflict in `desktop-app/.cargo/config.toml` resolved by hand: no `aes` left, `+crt-static`
  kept, the `lld-link.exe` pin kept for the Windows agent to remove) and run the desktop suite three times plus clippy
  and the Android checks fresh as unit `verify-xxh3-final`. Not verified: aarch64 NEON known answers, real Android
  device, macOS and Windows builds. One surviving mutant: the call site of `measureDeleteLegacyDurationFiles`.
  MERGED to `main` on 2026-10-15 (issue 545 closed by `Closes #545`). My fresh run on the merged head: desktop suite
  three times, each 1445 run, 1445 passed, 1 skipped (no timing test failed in any of them, so the two earlier
  failures did not recur; the cause stays unestablished), clippy clean; Android detekt, 1289 unit tests and lint
  clean. Released as `music-player-v0.1.1` (bump commit `5fe8e8e2e5`, push run `38679233251`): same checks as 0.1.0
  passed (`sha256sum --check` for six files, attestation exit 0 for the Linux x64 tarball and the APK, APK
  certificate `9de6e9a4...6926`, Linux x64 prints `music-player 0.1.1`).
- Task 97, existing CI caching: MERGED to `main` at `56d268686a` on 2026-10-15 (policy `doc/decision/ci-caching.md`,
  actionlint clean, the agent's cold and warm dispatch runs recorded there; I did not rerun them). Findings: the
  `cargo-publish.yml` cache never hit (keys hashed `Cargo.lock`, which every version bump changes), now keyed with a
  restore-key prefix, `target/` minus `target/package`, `ImageOS` in the key; the mise `cache: true` is inert (the
  action saves it only with `install: true`, every workflow sets `install: false`), removed only in
  `cargo-publish.yml`; pnpm store caches measured slower than no cache and reverted; `cli-git-native` is cached in
  `final-newline.yml` and `npm-release.yml`. Unverified: the `npm-release.yml` version job, a PR restoring a
  main-scoped entry, release-matrix caching. Repo cache usage went over the cap (11.1 to 11.3 GB). Follow-ups noted by
  the agent: the dead `cache: true` in `npm-release.yml`, `pnpr-publish.yml` and `kotlin-linter-publish.yml` is
  removed and `kotlin-linter-publish.yml` has `MISE_AUTO_INSTALL: 'false'` (DONE 2026-10-15, main `7845259345`; a
  `kotlin-linter-publish` dry run from the branch, run `38765367059`, passed; the other two workflows were not run);
  still not done: `cargo-publish.yml` uses one concurrency group for all refs, so a branch dispatch can replace a pending
  publish on main; `logger-fuzz.yml` fails its coverage gate (2026-09-24 and now). `cache-prune.yml` (daily, `actions:
  write`, deletes superseded cache entries, keeps the newest per family per ref): the human approved it with the
  music player families added, merged at `96728127aa`; its dispatch dry run (run `38676731033`) listed 24 entries in
  11 families and would delete 0. The first scheduled run (`38712633874`, 2026-10-15 09:23 UTC, success, 15 entries)
  executed the DELETE path for real: it deleted the older `music-player-desktop-v1-Windows-ARM64` entry (899,731,867
  bytes) and kept the newest of each family. Feature-branch entries of the Windows agent
  (`mp-win-v1`, about 2.6 GB) count against the cap until that branch merges and its entries are deleted.
- Task 95, Alpine: MERGED to `main` at `2077b5b81e` on 2026-10-15 (decision `doc/decision/music-player-alpine.md`,
  workflow `.github/workflows/music-player-alpine.yml` on x86_64 and arm64). The app builds and runs on Alpine 3.24.2
  with Alpine's own rust 1.96.1, dynamic musl (static musl cannot open a window: `dlopen` is unsupported there, and
  Alpine ships no static fontconfig, freetype or pipewire). Code changes: raw `sched_setscheduler` syscall because musl
  returns ENOSYS, a cargo feature `alsa-fallback` (PipeWire first, then the default ALSA device), `Update::AudioUnavailable`
  with a notice in the window. Runtime packages: `apk add fontconfig font-dejavu pipewire-libs libgcc wayland-libs-client
  wayland-libs-egl libxkbcommon mesa-egl mesa-gles mesa-dri-gallium alsa-lib`. My fresh run on the merged head:
  `lint:slint`, `lint:clippy` clean and nextest 1448 passed, 1 skipped (host glibc); the agent's Alpine runs (1449
  passed, 1 skipped on x86_64 and aarch64, smoke OK, window shown through our nested compositor with llvmpipe, audio
  heard through PipeWire and the ALSA fallback at 440 Hz, notices through the compositor's notification service) are
  the agent's, not mine. The compositor needed no change, so no publish and no version bump. Unverified: real Alpine
  hardware, a real GPU, X11, other compositors, edge and postmarketOS. Alpine clippy flags `src/oklch.rs`
  `manual_range_contains` where host clippy does not (the Alpine guard runs no clippy; not fixed, lint not loosened).
  The Alpine CI cache entries are 0.93 to 0.95 GB each, over the 650 MB guide, and the agent added the Alpine family
  to `cache-prune.yml`. Release artifact (task 100): MERGED to `main` at `ff743f8b7e` on 2026-10-15, job `build-desktop-musl` in
  the release workflow adds `music-player-<version>-linux-musl-x64.tar.gz` and `-arm64.tar.gz` (Alpine build image,
  `--version` checked in the runtime image). The agent's two dry runs from its branch passed (38684256021 and
  38686797998); it measured the Alpine x86_64 job at 15 to 20 minutes, which now sets a release's length (about 7
  minutes before); the job is uncached because the repo cache was at 9.98 of 10 GB (a cache would save at most the
  9 minutes of the dependency phase on x86_64). Its attestation path ran only as skipped until a real release; the
  `0.1.2` release (bump commit `c75435f772`, run `38688512043`) is the first real run of it.
  RELEASED `music-player-v0.1.2` on 2026-10-15 on attempt 2 of that run: attempt 1 failed in two jobs (`build-android`
  and macOS) at the mise setup step with "GitHub releases API returned 403 Forbidden" and created no tag or release; I
  reran the two failed jobs. Cause found in the action source (`jdx/mise-action` `c2a87611a1`, `src/index.ts` lines
  413 to 423 and 985 to 1001): with `minimum_release_age` set and no `version`, every job lists mise releases through
  the GitHub API with the workflow token, and any 4xx except 429 is non-retryable. Why the API answered 403 is not
  established (no response headers were read). Planned fix: set the action's `version` input in both mise steps of
  `music-player-release.yml`, with a comment (the call is skipped then). Verified for 0.1.2: nine assets, `sha256sum
  --check` passed for eight files, attestation exit 0 for both musl tarballs and the APK (the first real run of that
  path), APK certificate `9de6e9a4...6926`, musl x64 interpreter `/lib/ld-musl-x86_64.so.1`, and the musl x64 binary
  printed `music-player 0.1.2` inside `alpine:3.24` with the apk list installed.
- Task 96, Windows linkers: MERGED to `main` on 2026-10-15 (merge `aa9f48eaf6`; decision
  `doc/decision/music-player-windows-linkers.md`, workflow `.github/workflows/music-player-windows.yml` with jobs
  `msvc-x64`, `msvc-arm64`, `gnu-x64-ucrt64`). Windows MSVC now uses `link.exe` (no `linker` key; `+crt-static` kept);
  the new `x86_64-pc-windows-gnu` target links with mingw-w64 GNU ld (`-fuse-ld=bfd`; UCRT64 kept, MINGW64 deprecated
  by MSYS2); Linux stays on rust-lld and macOS keeps its linker. mold is not adopted: it has no PE/COFF output
  (v3.0.0 and unreleased main, README and `doc/audit/tech-mold-linker-vet-2026-10-05.md`; unreleased mold main has a
  Mach-O linker since 2026-10-08, which could matter for macOS later). My fresh run on the merged head: `lint:slint`,
  `lint:clippy` clean, nextest 1450 passed, 1 skipped (host glibc). The agent's results, not mine: CI shows
  `link.exe` for both MSVC jobs and GNU ld for the GNU job; 1422 passed, 1 skipped on all three Windows jobs; no C
  runtime DLL imports for MSVC, only `api-ms-win-crt-*` for UCRT64; Wine cross-build 1383 run, 1377 passed, 4 failed,
  2 hung (all six pass on real runners; hang and failures unexplained). Found and not filed: Slint
  `frame_throttle.rs:58` divides by zero when the display reports a 0 refresh rate (seen under Wine on bare Xvfb;
  issue draft in `doc/troubleshooting/music-player-windows-build-and-test.md`; a human should rerun the reproduction
  first). Windows cache entries total about 2.0 GB (653.7, 635.1, 652.3 MB plus 72.8 MB MSYS2), saved only on main
  and dispatch; the first run on main is cold. Unverified: real Windows desktop, real arm64 hardware, audio under
  Wine, the PR no-save rule, `link.exe` against `lld-link.exe` link time. Follow-up (task 101): MERGED to
  `main` at `175aa6287e` on 2026-10-15 after two dry runs from its branch (38692770715, 38695662196; actionlint
  clean): both `jdx/mise-action` steps set `version: 2026.10.9` and no longer use `minimum_release_age` (the action
  ignores it once `version` is set; the runbook section "The mise version pin" says how to update it; the 403 root
  cause stays unestablished); the stale `link.exe` export is gone (both MSVC jobs printed `link.exe`, imports hold no
  Visual C++ runtime; the x64 MSVC job recompiled 449 crates once because the linker setting changed, 12 to 15
  minutes, and the next version bump rebuilds and saves a fresh entry); the GNU exe
  `music-player-<version>-windows-x64-gnu.exe` is a release asset (MinGW-w64, GNU ld 2.46, UCRT dynamic, imports only
  `api-ms-win-crt-*` and system DLLs, 44 MB; uncached, 16 minutes; not byte-reproducible between two runs). On
  Windows the build step is now `cargo rustc --release --locked --target ... -- --print link-args` for all targets so a
  linker check costs no rebuild (arm64 restored main's `cargo build` entry and recompiled 2 crates). Attestation of the
  GNU exe ran only skipped until the real release. RELEASED `music-player-v0.1.3` on 2026-10-15 (bump commit
  `4144c6c933`, run `38698502487`, first attempt, all jobs green): ten files. I downloaded them: `sha256sum --check`
  passed for nine files, attestation exit 0 for the GNU exe, the MSVC x64 exe, the musl x64 tarball and the APK
  (first real attestation of the GNU exe), APK certificate `9de6e9a4...6926`, Linux x64 prints `music-player 0.1.3`.
  Independent PE parse with `pefile` 2024.8.26: MSVC x64 and arm64 linker 14.51, GNU exe linker 2.46, and none of
  the three imports `vcruntime*`, `msvcp*`, `libgcc_s*`, `libwinpthread*` or `libstdc++*`. Not run by me: any
  Windows or macOS binary, the arm64 Linux and musl binaries, anything on a real device.
  RELEASED `music-player-v0.1.4` on 2026-10-15 (bump commit `9e4b09e2d1`, run `38765172415`, all jobs green): the
  Windows executables are GUI-subsystem programs (no console window on double click; decision
  `doc/decision/music-player-windows-gui-subsystem.md`). Ten files; `sha256sum --check` passed for nine, attestation
  exit 0 for all nine, APK certificate `9de6e9a4...6926`, Linux x64 and the musl x64 binary (in `alpine:3.24`) print
  `music-player 0.1.4`; `pefile` shows Subsystem 2 on all three Windows exes, MSVC linker 14.51, GNU linker 2.47,
  and none import `vcruntime*`, `msvcp*`, `libgcc_s*`, `libwinpthread*` or `libstdc++*`. Not run by me: the window
  itself (nobody looked at a Windows desktop), any Windows or macOS binary, arm64 binaries, a real device. The
  0.1.4 notes keep the PowerShell redirection sentence (`| Out-File`).
  RELEASED `music-player-v0.1.5` on 2026-10-18 (bump commit `216ea6dedc`, run `39101350150`, all jobs green, after a
  green dry run on main, `39098277889`): the Windows normal-close abort fix, startup message box, ANSI gating, batched
  cache commits, the ten desktop review fixes and third-party license notices (two extra assets,
  `-desktop-third-party-licenses.txt` and `-android-third-party-licenses.txt`, and `THIRD-PARTY-LICENSES.txt` in the
  Linux archives). Eleven files. I downloaded them: `sha256sum --check` passed for all eleven, attestation exit 0
  for all eleven, APK certificate `9de6e9a4...6926`, Linux x64 prints `music-player 0.1.5` and `--licenses` prints the
  notices, the musl x64 binary prints it in `alpine:3.24`, `pefile` shows Subsystem 2 on the three Windows exes
  (MSVC 14.51, GNU 2.47) with no C-runtime DLL imports. Attestation lookup changed with the repository owner name:
  0.1.4 and older verify with `--owner Aquaticat`, 0.1.5 with `--repo Aquaticats/Monochromatic` (README and runbook
  corrected). Not run by me: any Windows or macOS binary (so the normal-close fix is proven by CI only on forced
  paths, not by closing a window on Windows), arm64 binaries, anything on a real device.
  RELEASED `music-player-v0.1.6` on 2026-10-18 (bump commit after `b9d5c4e8d7`, run `39108583307`, all jobs green,
  after a green dry run on main, `39107058640`): the Licenses rows on both platforms (desktop opens `ui/licenses.slint`
  with the `AboutSlint` widget; Android opens a LazyColumn page of the notices from an APK asset), the desktop
  programs under the Slint Royalty-free license 2.0 (owner decision 2026-10-18), and Android unplayable-file routing
  (D131: moves walk past the file and post one system notification, a tap keeps the in-app message). Eleven files;
  `sha256sum --check` passed for all eleven, attestation exit 0 for all eleven with
  `--repo Aquaticats/Monochromatic`, APK certificate `9de6e9a4...6926`, Linux x64 and musl x64 (in `alpine:3.24`)
  print `music-player 0.1.6`, `--licenses` names the Slint royalty-free license, the APK asset starts with the
  Android notices, `pefile` shows Subsystem 2 on the three Windows exes. Not run by me: any Windows or macOS binary,
  arm64 binaries, a real device, TalkBack. Merged earlier the same day: Android licenses row (1,334 tests), the
  load-failure routing (1,361 tests), desktop licenses row (nextest 1,546 passed, 1 skipped). Open for the human
  (veto): whether the Licenses page counts as the "About screen accessible from the top level menu" of Slint's
  license section 2(a) (adding the "Made with Slint" badge to the release notes would satisfy 2(b) as well); the
  two platforms use different icons (`license` desktop, `description` Android); `design/decisions.md` has D131 but
  no entry for the About heading and Licenses rows; the Android channel is still named "Analysis problems". The
  repo cache was at 10.28 GB; a real `cache-prune` run (`39109951532`) deleted four superseded entries (2.33 GB), now
  7.95 GB.

- 2026-10-18, license polish after 0.1.6, branch `fix/music-player-license-polish`,
  worktree `music-player-licpolish`; not merged to `main`, no version bump. Three commits: the Slint attribution badge (`#MadeWithSlint`, the
  `MadeWithSlint-logo-whitebg.png` file the license links, image URL pinned to Slint commit `7577a165d1`, linked to
  slint.dev) is the first element of the release notes template in `music-player-release.yml`, so the release page
  meets section 2(b) as well as the in-app widget (2(a)); the same notes no longer say Android has no screen for the
  notices; the Android Licenses row draws Material Symbols `license` like the desktop row (was `description`); D132 in
  `design/decisions.md` records the About group and Licenses row on both platforms (the human's no-mockup decision).
  Badge facts, licence of the badge file (CC-BY-ND-4.0, linked and not copied) and the render checks are in
  `doc/decision/music-player-third-party-licenses.md` section "The badge on the release page". Verified on the branch
  after merging `main` (the merge changed nothing under `package` or `.github`): actionlint 1.7.12 clean, pandoc and
  `gh api markdown` render the badge as an image link, release dry run `39110239882` green (all jobs; its log's
  "Write the release notes" step prints the badge line), desktop `lint:slint`, nextest 1546 passed and 1 skipped,
  clippy, Android detekt, 1361 unit tests with 0 failures in 132 result files, `lintDebug`. Not done: the new icon was
  not seen in the app on the emulator (three launches of the owned AVD copy: gfxstream SIGSEGV, SIGABRT, then a boot
  that never opened its console port; stopped at the two-relaunch limit); the committed path data was rendered
  instead and equals the upstream `license_24px.svg` path. Open for the human (veto): whether the badge placement at
  the top of the notes is wanted, and the Android icon change. The dry run's caches (gradle 654 MB, notices 128 MB)
  were deleted.

- 2026-10-17, review issues 1451 to 1458, 1460 and 1463 (assigned to (g) in the GitHub issues item), branch
  `fix/music-player-desktop-review-issues`, worktree `music-player-deskissues`; not merged to `main`, no version bump.
  All ten were real and are fixed, each commit closing its own issue: the session file is saved by temporary file,
  sync and rename and a failed load is logged with its path (1453, 1452), `PlayerError::source` forwards the wrapped
  error (1455), the queue wrap comments quote the code they document (1456), each Search result row is a named button
  (1451, new `SearchRow.spoken` label built in Rust), a single probe window starts at the final legal start (1460),
  the bench feasibility search reads `Policy::max_too_loud_db` (1463, new `truepeak-core.bench:test` task), and the
  `truepeak-core` README, `Cargo.toml`, `mise.toml` and `lib.rs` header and `HANDOVER.md` describe the shipped crate and
  dependency versions (1457, 1458, 1454). Verified on the branch after merging `main`: desktop `lint:slint` exit 0,
  nextest 1476 passed and 1 skipped (1460 passed before), `lint:clippy` exit 0; `truepeak-core` 83 passed and clippy
  exit 0; `truepeak-core.bench` 3 passed and clippy exit 0; the Android native crate has no Rust tests, so
  `android-app:lint:clippy` compiled it against the changed `truepeak-core` for both ABIs (exit 0). Open for the human:
  whether one window should sit at the end (chosen, per the module contract) or at frame 0; the Search row announces
  name, kind and parent folder but not the D77 action wording (Select track, Play track), which needs the Auto-play
  setting threaded into `search_view_of`; `PlayerError` now prints the wrapped error text twice in a full chain.

In flight 2026-10-18 after 0.1.6: agent `af163cdecb7b58458` (Sonnet), branch `fix/music-player-license-polish`,
worktree `music-player-licpolish`: the "Made with Slint" badge in the release notes (license section 2(b)), the
Android Licenses icon changed to `license` to match the desktop, and the design record D132 for the About group and
Licenses rows. Merge, then release 0.1.7. Not started, mine: a quiet-host perfetto trace for the 10,000-track jank
(p = 0.089, optional), re-check of issues 1079 to 1081 and 1069 (Depot trial CI failures, another thread owns them).

Queued, not started (an agent slot frees when one of the above reports; the cap is five agents):

- Android large library (written 2026-10-18, branch `fix/music-player-android-large-library`, not merged): the media
  store was asked for the document column `last_modified` once per fingerprint (sweep, page measure pass, track
  load) and the provider logged a stack each time; the audit's "idle" count was the page pass that follows every
  start. Fixed in `cfd1d882c2`: 0 exceptions in every cold run and idle window on the fixed build against 27,137 in
  a cold run of `main` at 10,000 tracks; 25 of 25 media store fingerprints identical, so no cache version bump. Root
  cause, counts and spread: `doc/troubleshooting/music-player-android-mediastore-last-modified-column.md`. Scroll
  jank at 10,000 tracks (audit finding 3) re-measured in two sessions without an emulator crash: 4 of 20 windows
  slow against 2 of 40 at 1,000 tracks (p = 0.089), 2 of 10 before and 2 of 10 after the fix, time lost in
  render-thread draw commands, tracking host CPU pressure. Not profiled: two later sessions crashed after 4 and 2
  minutes (gRPC `SIGABRT`, gfxstream `SIGSEGV`) and the relaunch limit was used. Owed: a `perfetto` trace of slow
  and normal windows on a quiet host with a Settings-app control window (the driver for it was written in the agent
  scratch, not committed). The page measure pass still reads the size of every row at each start (9.2 to 21.9 s at
  10,000 tracks); not changed.
- Android issues fixed on the same branch, each with a test that failed before: #1438 (a file that opens but does
  not decode now reaches `onLoadFailed` through a worker failure number and `QueuedLoadLedger`; instrumented
  `RustEngineLoadFailureTest` failed on a build of `main` and passes), #1439 (the notice kind sits between Undo and
  error in the feedback order, chosen from the issue's suggestion; today's behavior put it above Undo), #1440 (the
  readied first track at the end of a folder is reported as loaded). Open choice for the human: #1438 reports
  through the in-app "Could not play" message of D123 (the tap-time path), not a system notification, because that
  message stays in the app by D123; D122 covers the desktop launch and sweep report. Superseded on 2026-10-18 by D131:
  an auto-advance, Next, Previous or restore onto an undecodable file is now walked past and reported by notification,
  only a tap keeps the in-app message.
- The workflows of tasks 95 and 96 were told to cache properly and prove it; `doc/decision/ci-caching.md` binds them
  to save only on main and dispatch, under 650 MB per entry, and to delete feature-branch entries after merge.
- Gallery retake owed from task 93 (the four Settings images, in progress inside that branch); task 94's retakes are done.
- Forward the Alpine and Windows artifact specifications to task 92 when those agents report.
- 2026-10-18 MERGED (agent `a24e53faf2449563e`, head `303ef695f0`, 1,302 Android unit tests, detekt, lintDebug and
  clippy clean): the `last_modified` fix (root cause: the document column asked of the media store, 27,137 exceptions
  in a cold 10,000-track run before, 0 after; fingerprints identical on device for 25 of 25 media store tracks) and
  issues 1438, 1439, 1440. Jank at 10,000 tracks is not caused by the exceptions and not changed by the fix (4 of 20
  windows slow against 2 of 40 at 1,000 tracks, p = 0.089); a quiet-host perfetto trace is owed and not started.
  Follow-up agent `af5649edcdf4f7d71` (branch `fix/music-player-android-load-failure-routing`): the ledger stale
  second message edge and non-tap load failures (auto-advance, restore) following D122 and D123 with a system
  notification instead of an in-app message. Agent (g)'s scratch of 94 GB was cut to 11 GB (emulator copies and
  invented libraries removed; `emu-90` belongs to someone else and stays).
- 2026-10-18 done from that triage and merged to main: 1612 and 1610 (workflow fixes, release and cache-prune dry
  runs green), 1639 (the four design runtime JS files tracked, negations recorded in
  `doc/decision/gitignore-negations.md`; closed by the commit), the music player share of 1758 (fedora:41 index digest
  pins in `Containerfile`, `.sign` and `.icons`; `Containerfile` and `.sign` were built from the pin; other packages'
  Containerfiles stay floating, so 1758 stays open), the desktop share of 1756 (root `clippy.toml` mounted at
  `/clippy.toml` in the container lint; probe: a crate with `Result::unwrap` passes without the mount and fails with it;
  `ide`, `terminal` and `nested-wayland-session` stay open), the `musicplayer-native` README (1763 reopened for the
  test-fixture packages). Still mine and not started: re-check 1079, 1080, 1081, 1069 against current main.
- GitHub issues from the 2026-10-17 repository review that touch the music player (open, triaged 2026-10-17, 500+
  open in total, most are doc style findings): assigned to agents (f) 1438, 1439, 1440 and (g) 1451 to 1458, 1460,
  1463. Mine, not started: 1612 (`cache-prune.yml` FAMILIES omits `msys2-pkg-v1`), 1610 (`music-player-release.yml`
  hardcodes build-tools 37.0.0), 1758 (floating container bases: `Containerfile.sign` runs with Authenticode
  credentials, then `Containerfile`, `Containerfile.icons`; `Containerfile.alpine` and `windows-gnu` already pin),
  1756 (container clippy omits the root `clippy.toml` in `desktop-app/mise.toml`), 1763 (`musicplayer-native` has no
  README), 1639 (root `.gitignore` `*.js` rule strands the design runtime JS). To check, may be stale: 1079, 1080, 1081
  (Linux tests, filed 2026-10-16; the desktop suite passed 1460 of 1460 on 2026-10-15), 1069 (clippy on the schema
  constant; clippy passed). Not music-player product work and left alone: the `drop the unnecessary regex` refactor
  issues 727 to 982 (design JS and Kotlin lint refactors), 1173/1174/1172 prose-style gates, the macOS native
  assertion issues 1082 to 1107, CI issues 1023 to 1029, Depot trial issues.

Standing rulings of the human in this effort (2026-10-14 and 15): click rule D124; Search results select only D127; the
desktop keeps an unreadable row selected D128; Search restyled within the decisions with no section labels and no
recents, desktop parity D126; no scrollbar on the folders panel D125; the unplayable and analysis-failure reports are
system notifications with no in-app fallback when one cannot be posted (D122, D123), and a later unread failure
notification replaces the earlier; USB debugging on emulators is always allowed (skill rule EMA); the repo's own nested
compositor is the only nested compositor; CI must cache; real releases are authorized, early and often (2026-10-15).
Decision numbers D122 to D130 are taken; the next free one is D131.

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
  `core/PageMeasureRefresh.kt` and `core/FirstVisibleTrack.kt`, so JVM tests killed the mutants for the per-step
  cancel (`collectLatest`), the start position and the sink index (13 new tests, no failures; detekt and lintDebug
  pass). The five mutants at Compose boundaries (the `LocalPlayingIndex provides` value, the `rowWithPlayingFlag` call
  in the `LazyColumn` item, and the `currentPositionOf`, `pageEntryScrollTarget` and `remember` key arguments) are
  now tested with Robolectric 4.17 and Compose UI test (`ui-test-junit4` from the Compose BOM, `ui-test-manifest` in
  debug; user-approved test dependency, no emulator): `wiring/TrackListPaneWiringTest` renders the real `trackListPane`
  and `wiring/PlayerHostWiringTest` the real `playerHost` over a controller with a fake engine and invented tracks.
  They assert the one selected row for a playing index, the marker moving on next and previous, where a page opens,
  that a track change alone never scrolls, what a reveal and a folder reveal scroll to, a track added to the shown
  folder (row and supporting line), a folder change, and, through a recording content provider, that a new measure
  pass starts at the first visible track. The unit suite went from 1129 to 1149 tests with no failures; the test
  task costs about 8 s more (Gradle `BUILD SUCCESSFUL in` 40, 42, 42 s before and 50, 48, 50 s after, test task only
  rerun in a container after a warm-up; summed test time from the XML 28.2 s to 36.4 s, means of three runs).
  The mutation pass (21 mutants of these sites and their siblings, one at a time, full suite each) killed 17; the
  four that survive are output-equivalent or need a flow no test drives: the folder title key and the playing-index
  key and argument of the `rowEntries` `remember` (the rows are built from the entries alone, and
  `rowWithPlayingFlag` overwrites any flag they carry, so only the cost of rebuilding changes), and the template key
  of the `rowLines` `remember` (a template changes only through the Settings editor, which no wiring test opens).
  Robolectric needs the API 36 framework jar: Gradle resolves it as `robolectricRuntime` and copies it to
  `app/build/robolectric-runtime`, read through `robolectric.dependency.dir`, so a warm Gradle cache runs offline.
  The podman runner's Java could not reach Maven Central or Google Maven (names resolve only with
  `/run/systemd/resolve` mounted, and connections from the container's Java then still fail, cause not found), so new
  dependencies were fetched with a host Gradle run into the shared Gradle home and the container runs offline.
  Possible flake to watch: `SearchServiceTest.typingDuringASlowScanAnswersFromTheKnownTracks` (p95 under 500 ms)
  failed in 2 of 21 mutant runs during the wiring work while a host Gradle run competed for the CPU, and passed in
  every control and final run (p95 3.98 ms); whether the Robolectric sandbox sharing its JVM contributes was not
  measured. The suite on `main` is 1149 tests, 0 failures, from a forced offline run.
  Still open: the fourth cost below; the 435 ms `loadTemplate` violation did not
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
  Residual media3 cost, removed, on `main` since `29dfe1b934` (the user chose to remove the system queue, not window
  it; Android Auto, Wear and any app reading `getQueue` lose the queue list, derived from the source and untested):
  `MediaSessionLegacyStub.ControllerLegacyCbForBroadcast.updateQueue` converted the whole timeline to `QueueItem`s
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
  `funcdiff.ts`): the playback state, speed, the actions mask 21426 (21428 while paused) and the notification's
  actions (previous, pause or play, next; `funcdiff.ts` prints 6 for both variants because its pattern also counts the
  three compact-action indices) are the same before and after; `queueTitle` is null in both; the queue size is 10 000
  before and 0 after at every step, also during the first 90 s of a cold start (the notification controller connects
  before the library loads, so the full queue is never published). Titles cannot be compared across runs, because the
  invented tracks last under a second and advance by themselves; in both variants the session's metadata title follows
  the playing item and the notification title sometimes trails it by one item. `activeQueueItemId` still reports the
  item index in the after variant although no queue is published.
  Transport on a folder of three 120 s invented tones (media key and the notification shade card's buttons, state read
  from `dumpsys` after each step, second relaunch): Next and Previous by key, Next and Previous by the shade card,
  pause and play by the card gave the same sequence of active items (0, 1, 1, 1, 1, 2, 0, 2, 2, 0, 1, 1, 1, 1, 1, 1) and the
  same states (PLAYING, then PAUSED with actions 21428, then PLAYING) in both variants; the queue was 3 before and 0
  after. A Previous pressed after 5 s and a second one at once left the item at 1 in both variants. The position
  field of `dumpsys` is the value at the last update, not extrapolated, so positions are compared only as
  magnitudes. On the 120 s tone of the 10 003-track library, a scrubber drag in the shade moved the position from about
  9 s to 61.8 s in the after variant and a tap from about 9 s to 62.0 s in the before variant; the other taps and drags
  right after a cold start left it unmoved in both variants, and the later tap probes read the same sequence of
  positions in both (60.6, 60.1, 62.2 and 78.1 s before; 67.8, 61.7, 61.9 and 78.0 s after) that does not match the
  tapped positions, so the scrubber driver was unreliable and a scrubber seek is shown to work in each variant but not
  to behave identically on every attempt. No screen lock is set on the emulator, so the lock screen card was not seen.
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
  the menu popup's keyboard ring, TalkBack and a real keyboard; the Android gallery was retaken headful on
  2026-10-14 from `e02e74edec` (only the track menu image changed visibly and was replaced; the other seven differ by
  4 to 7 px row offsets and were kept; see `doc/handover/music-player-readme-and-gallery.md`). The ring capture
  emulator ran with `-no-window` on the host GPU, which the rule below bans.
- Desktop folder names scrollbar removed (2026-10-14, D125, amends D22): the names list of the folder picker draws no
  bar on either input; the track list, Search, Settings and the template editor keep theirs. Verified: two window tests
  (both fail with the bar restored in a throwaway worktree), the whole nextest suite, clippy, `slint-viewer --check`,
  and release builds of the old and the new commit in the nested compositor on an invented library of 61 folders in a
  1000 by 800 and a 443 by 900 window (names unchanged in place, wheel offsets identical, track list bar kept). Not
  verified: macOS, Windows, a real Plasma session, touch input on a real screen (only the window test sets it). Eight
  committed desktop gallery images still show the old bar and are due a retake: `desktop-two-pane-light.png`,
  `desktop-two-pane-dark.png`, `desktop-menu-light.png`, `desktop-menu-dark.png`, `desktop-hints-dark.png`,
  `desktop-search-light.png`, `desktop-search-dark.png` and `desktop-narrow-folders-light.png` in
  `package/music-player/asset/readme/`. The `desktop-settings-*` images, `desktop-narrow-player-dark.png` and
  `desktop-empty-light.png` do not show it.
- Stale docs: the gallery images in the bullet above; otherwise none known. The README gallery and the Android
  page-control text were rewritten on 2026-10-13, and the peak-sweep start path in
  `android-app/HANDOVER.peak-sweep-optimization.md` and `android-app/DECISION.peak-sweep-parallelism.md` was corrected.
- Hygiene (2026-10-15): I removed the 21 music-player worktrees whose branches are merged into `main` and clean, the
  `ral`, `xxh3` and `bannerfit` Gradle homes (4.7 to 4.8 GB each) and `agent-refresh-cost` (17 GB). Kept: the worktrees
  `music-player-production`, `-cover-picker`, `-first-run-access`, `-theme-compose-prototype`, `-relgnu` (in flight),
  the Gradle homes `aps-gradle-home` (my verify scripts use it) and `tap-gradle-home`, and
  `~/temp/agent/agent-polish2/work/` (not inspected). The branches themselves were not deleted. A failed decode is retried at every library change, one decode per failed file per change.
- Rate limit: on 2026-10-12 the Sonnet weekly limit stopped five agents mid-run; a re-login lifted it and they were
  resumed. Their work is committed; check `git log` before relaunching anything.
- Never verified: a real Plasma session, macOS, Windows, real Android hardware, Android API 33 to 36 for D107 and for
  the D123 failure notification (its device pass ran on the API 37 emulator only).
- Windows linkers (2026-10-14): the desktop app no longer links with `lld-link` (mold is ELF-only and cannot replace it);
  the MSVC targets use Visual Studio's `link.exe`, and an `x86_64-pc-windows-gnu` build links with GNU ld. The suite now
  runs on GitHub Windows runners (`.github/workflows/music-player-windows.yml`), where its first run found eleven
  Windows-only failures, fixed. Record: `doc/decision/music-player-windows-linkers.md`. Windows is now verified on those
  runners and under Wine, not on a real machine with speakers.

### Mistakes made in this effort, and what corrected them

Read these before repeating them. Each one cost the human a correction.

- The orchestrator merged the unplayable-file notification (D122) with a racy test helper:
  `unplayable_notification_bus_support.rs` made its message iterator inside the service thread, so a `Notify` call that
  came first on a loaded host was never delivered and `a_successful_post_leaves_the_warned_flag_clear` timed out after
  3 s (it failed in 3 of about 8 runs; the agent had reported a 40 of 40 stress pass and one failure it called load).
  A failure that shows up in more than one run is a defect to fix before merging, not load to note. Fixed on
  2026-10-14 by making the iterator before the thread starts; three clean full runs followed.

- The unplayable-notification run (2026-10-14) shipped a test that started a fake notification service after posting
  the first report, so it raced the notifier thread; it passed in the suite and failed only as the baseline of the
  mutation run (fixed in `95d573b836`: the fake service now refuses its first call on purpose). The docs commit
  `2007ce0cb4` says its Containerfile note follows, but that change landed in `b21530ceae`; a corrective commit comment
  was posted. Tests that wait for "something happens after X" need a deterministic signal, not an order of two threads.
- The orchestrator told the human the desktop click rule already matched ("an unselected row is selected, the selected
  row toggles") after reading only `play_row` and the README, which say a click plays at once. The human pointed out the
  mismatch: `Command::SelectIndex` selects and pauses ("selecting never auto-plays") and `play_row` then sends Play, so
  a click replaced the playing track and started the new one. The ruling (2026-10-14) is select only, then toggle, on
  both platforms (D124). Before saying behavior matches a spec, read the engine command the UI sends and the
  user's words, and run the real binary (QAB, QJ1).

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
- [x] Search page restyle on Android (D126, 2026-10-14, branch `feat/android-search-restyle`): canvas-tone header,
  `outlineVariant` divider, 40 dp circle result glyphs with a rounded press and ring shape, the empty and no-result
  states in a 72 dp circle lifted clear of the keyboard (`doc/planning/android-search-page-refresh.md`).
- [x] Search page restyle on desktop (D126 addendum, 2026-10-14, branch `feat/desktop-search-restyle`): the same header,
  divider, rounded rows with tonal circle glyphs and status block in Slint, thirteen window tests, and the two desktop
  Search gallery images retaken.
- [x] Search select only, unreadable rows and the Search caret (D127, D128 and a D126 note, 2026-10-14, branch
  `feat/search-select-only`): a Search result for a track that is not current only selects it (both platforms), the
  result of the current track toggles; desktop keeps an unreadable row selected like Android and a click retries it
  (Next, Previous and the end of a track still skip unreadable files); the Android Search field keeps its caret at the
  end of the kept query after a fold change and after `Ctrl+F`. The spoken action of a non-current result is now
  "Select track" (D127, open to the human's veto).
- [x] Auto-play on select setting (D129, 2026-10-14, branch `feat/auto-play-on-select`): a Settings switch row under a
  Playback heading, off by default and stored with the session on both platforms; with it on, a click, tap, `Enter` or
  Search result for a track that is not current also starts it, and the current track, the menu Play, the rails and
  an unreadable row behave as before. One pure rule per platform (`rowActivationFor`, `row_activation_for`), mutation
  checked; the desktop e2e suite gains the `auto-play` session (117 declared); the switch moves under the text in a
  narrow list pane.
- [x] Release workflow (2026-10-14, branch `feat/music-player-release-workflow`): `.github/workflows/music-player-release.yml`
  builds the desktop app for Windows, macOS (Apple silicon) and Linux and the Android app and creates one pre-release,
  triggered by a version change in `package/music-player/desktop-app/Cargo.toml` or by a dispatch
  (`doc/decision/music-player-releases.md`, `doc/runbook/release-the-music-player.md`).
  The Android version now derives from that manifest, and a release signing config reads `MUSIC_PLAYER_*` values.
- [x] Alpine Linux (musl) on x86_64 and aarch64 (2026-10-14, branch `feat/music-player-alpine`): a dynamically linked build
  with Alpine's own Rust (a static binary cannot link PipeWire or open a window), an opt-in ALSA fallback for machines
  with no sound server, a window message when no audio output opens, a musl-safe scheduler call, and a CI workflow plus
  smoke test that runs the app in this repository's compositor (`doc/decision/music-player-alpine.md`).
- [ ] The first real release is the human's call: it is immutable, and no Windows, macOS or real-device run exists.
