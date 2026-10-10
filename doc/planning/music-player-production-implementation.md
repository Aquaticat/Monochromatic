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
- Known gaps: per-row duration and peak (no JNI accessor yet, so template lines show without them), Re-analyse and file details
  (no per-track cache invalidation or peak read-back from Kotlin), keyboard wiring, a folder-scan failure that the library source
  swallows (it reports an empty folder), and the Settings page on the inner screen spanning the full width.
- Desktop: the template, search, folder, keymap and overlay logic is ported to Rust and integrated into `desktop-app/src`
  (485 tests pass, clippy clean on the host; the container clippy task fails on the existing `truepeak-core` path dependency,
  which the container does not mount). The Slint components are being built next to the Android captures.
- Open and next: keyboard wiring, the per-row peak source, the Slint UI composition for the desktop, then the final verification.

## Queue

- [x] Package 1.
- [x] Package 2.
- [ ] Packages 3 and 4 (on Haiku): player screens (cover and unfolded) and the folder picker, with a debug host for native captures.
- [ ] Packages 5 to 12, each started only when the previous one it builds on is committed.
