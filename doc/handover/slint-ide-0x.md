# Slint IDE implementation handover

## Purpose and next action

Continue the authorized implementation of `package/desktop-app/ide`.
The user confirmed [the scope][scope] and [the approach][plan],
then authorized implementation.
A checkpoint is not a pause:
continue the queue without asking the user to say “continue”.
The application remains an incomplete read-only workspace reader.
The user paused this session to hand the work to another agent;
resume the queue on request without waiting for a second authorization.

Current boundary:
combined search and in-file find are complete;
the "Handoff state" section lists the work in flight and the queue.
Historical record of the combined-search gate:
`proc_9bf4` passed 119 library/integration tests,
fourteen native tests,
and complete package lint.
`proc_ee06` passed disposable guard-removal controls including result caps at
`/home/user/temp/agent/ide-search-guard-r46p2u/results.json`.
The guards cover reply identity,
result/record limits,
scope containment,
EOF cancellation,
and source focus while a search overlay is open.

The dark and light native search probes pass at
`/tmp/monochromatic-ide-native-H0znPy/search-probe.mjs` and
`/tmp/monochromatic-ide-native-YJgXM6/search-probe.mjs`.
Their inspected screenshots cover ordered combined results,
selection/copy at source line 120,
and invalid regex diagnostics alongside a usable filename result.
The light `search-edge-probe.mjs` also verifies actual tree-directory scoping,
failed binary-file retention,
recovery,
and outside-click dismissal.
The first clipboard probe treated a not-yet-published selection as terminal failure;
the corrected probe waits for the expected isolated clipboard value.
No host clipboard is inspected or cleared.
Both native consumer processes exited cleanly after socket `quit`;
there is no active native IDE probe.

Whole-model search row replacement already cancels a held click in Slint 1.18.1.
The added custom press guard was ineffective and was removed after a rebuilt disposable control still passed.
The tree's fixed-slot guard remains necessary.
See [the pointer lifetime investigation](../troubleshooting/slint-repeater-model-pointer-lifetime.md).

In-file find was implemented on 2026-10-05;
the "Handoff state" section records its result.
The following paragraphs are the research record that preceded it.
Fresh reference reads confirm that editord delegates Ctrl+F to real Chrome's find-in-page,
rather than implementing another regular-expression search widget.
`inspect:find-reference` now probes synthetic Unicode/whitespace cases in an isolated browser profile.
`proc_53b2` passed and closed its own browser session in `finally`.
Results are `/tmp/ide-find-reference-is2TFy/results.json`,
with a reduced user agent reporting HeadlessChrome 149.
The disposable profile's `Last Version` file identifies the actual build as `149.0.7827.54`.
Positive and negative controls passed.
The probe matches case differences,
canonical/decomposed accents,
plain letters against accented letters,
`STRASSE` against `Straße`,
`office` against `oﬃce`,
final sigma,
dotted I,
and NBSP against an ordinary space.
It preserves significant query spaces,
treats regex punctuation literally,
and does not treat a literal newline or tab as an ordinary space in the `<pre>` fixture.
Literal newline queries do match literal newlines;
empty patterns do not match.
The probe's `Window.find` path is non-standard and is not itself proof of every Chrome toolbar behavior.
`proc_be99` completed Chromium finder-directory discovery.
The pinned source trace and expanded measured corpus are recorded in
[the find matching plan](../planning/slint-ide-find-matching.md).
No new matching dependency is adopted.

The matcher is settled.
An earlier version of this handover called browser matching fidelity a settled requirement
that must not be sent back to the user.
That was an agent inference and is withdrawn:
on 2026-10-05 the user asked why a find matcher needs vetting when it is just substring matching.
In-file find uses plain literal case-insensitive substring matching with the existing `regex` dependency.
The technology-vetting run and the editord line-DOM probe are dropped.

The incumbent gap is measured, not assumed.
`inspect:find-regex` (`proc_6c18`) runs the already adopted Helix `regex` engine
against the captured 29-case corpus,
escaping every query as a literal and enabling Unicode case-insensitive matching.
It agrees on 16 cases and differs on 13:
canonical-accent,
plain-accent,
case-expansion,
compatibility-ligature,
dotted-i,
nbsp-as-space,
kana-script,
kana-width,
kana-composed,
single-quote,
double-quote,
soft-hyphen,
and combining-mark-only.
Those 13 cases are accepted as documented deliberate differences from editord's browser find.

### Handoff state

#### Current state on 2026-10-06

This block is current;
the items after it are the record of 2026-10-05 and older.

- The host restarted overnight and cleared `/tmp`,
  including the coordinating session's scratch scripts.
  Durable coordinator scripts and the shared agent brief now live in `~/temp/agent/ide-coordinator/`
  (`ide-fanout-common.md`,
  `provision-worktree.mjs`,
  `gate.mjs`,
  `land-merge.mjs`,
  `render-check.mjs`,
  `inotify-usage.mjs`,
  `fsmonitor-sockets.mjs`);
  gate logs go to `~/temp/agent/ide-coordinator/logs/`.
- Landed on `main` as merge `45db45d02`:
  reaping and lifecycle checks (`feat/ide-language-verify`),
  UI batch 2 (`feat/ide-ui-batch-2`),
  re-asking for timed-out hints and pulled diagnostics (`fix/ide-hints-after-reload`),
  the user's watch timing (`feat/ide-tree-watch` through `cefc9902d`),
  and release packaging (`feat/ide-package`).
  Gate at the integration commit `93ac17859`
  (IDE tree `d1f5569c31fe7e4cb92e651820f0338ac68842aa`, load 4 to 15):
  lint;
  96 passing library and integration result lines;
  102 of 102 native tests with 4 ignored measurements skipped.
- Landed on `main` as merge `906ee5aed`:
  the logging rework (`feat/ide-logging` through `2572405cc`)
  and hint and diagnostic rows above the code line with gutter severity letters
  (`feat/ide-hint-rows` through `b05776ede`).
  Gate at the integration commit `93f9f4891`
  (IDE tree `53fd6b369da8be4ea65c447cb2a4f2a6dd219897`, load 75 to 98):
  lint;
  99 passing library and integration result lines;
  112 of 112 native tests with 4 ignored measurements skipped.
  The merge resolved nine conflicted files by keeping both sides;
  the three tests with a hard-coded `TEXT_LEFT` of 313 now take `sidebar_tests::TEXT_LEFT`
  (256 + 1 + 58 = 315).
  An earlier gate of the logging merge alone failed on two known timing tests,
  which `fix/ide-test-flakes` owns.
  UI batch 3 was asked with the page `package/desktop-app/ide/design/questions/2026-10-06-ui-batch-3.html`;
  every answer matches what the build ships.
- Landed on `main` as merge `d1493c66c`:
  a crashed language server's last standard-error lines in its warning
  (`feat/ide-logging` through `6c1aff99b`; 8 lines of at most 512 bytes per server;
  a start timeout keeps its ERROR line and adds a WARN with the lines;
  the crash warning waits up to 1 s for the last lines;
  these three choices were the agent's, settled by the coordinating session).
  Gate at `180353bbb` (IDE tree `88b0bf572869089e9e723f2567b6614070991013`):
  lint;
  102 passing library and integration result lines;
  `test:native` failed once in
  `native::annotation_gutter_tests::the_letter_stands_the_same_gap_before_one_two_and_three_digit_numbers`
  ("line 0's number or text changed when its letter appeared")
  and passed 112 of 112 on the rerun of the same tree;
  that intermittent failure went to `fix/ide-test-flakes`.
- The API session limit cut four agents off again at about 15:10 on 2026-10-06;
  each worktree was clean and pushed,
  and each agent was resumed from its transcript with its measured state.
- Landed on `main` as merge `21f2c625d`:
  the single executable carrying its runtime, the home folder as the default project,
  install, the launcher entry, `--licenses`, and removal of other builds' grammar folders after 30 days unused
  (`feat/ide-single-file` through `4b8b03663`).
  Gate at `a70b0bead` (IDE tree `93cf8e20158fd4c11d0143d28a33224496c3b567`):
  lint, lint:release, test, test:cli, test:native 114 of 114, bundle, inspect:bundle 9 of 9.
  The integration worktree needs its own release build of `//package/cli/nested-wayland-session`
  before `inspect:bundle`; without it six checks fail naming the missing compositor.
- Landed on `main` as merge `7940aef9c`:
  the IDE watching the project's source folders for the language servers,
  quiet reads, the watch-limit back-off, offline containers,
  and no warning for plain text (`fix/ide-watch-save` through `bcd30ef32`),
  plus `f3f0a6092`, which routes the plain-text check through `OwnLoader::helix`.
  Gate on IDE tree `9bf8ee9c59037bae008d7e9e980d644d68179dc5`:
  lint, lint:release, test, test:cli, test:native 116 of 116, bundle, inspect:bundle 9 of 9,
  and inspect:server-watches.
- systemd-oomd killed the shared `claude-code-bash` cgroup at 17:11:23 and 17:14:48 on 2026-10-06,
  taking every background shell of this session and its agents;
  long runs now go through `systemd-run --user` as described in
  `doc/troubleshooting/systemd-oomd-reaps-terminal-scope-with-the-agent-in-it.md`.
- Landed on `main` as merge `4ee4171b5`:
  element-handle accessibility tests with the batch 3b and accessibility answers applied
  (`feat/ide-accessibility-tests` through `5335dddce`)
  and cargo-about collecting every Rust crate's license text into the executable and `--licenses`
  (`feat/ide-crate-notices` through `72e34e0ae`).
  Gate at `6a4095f99` (IDE tree `65e7fed6f689088b645411ec5e7bfb0da817d46b`), run as a user unit:
  lint, lint:release, test, test:cli, test:native 124 of 124, bundle,
  inspect:bundle 10 of 10, inspect:bundle-guards 8 of 8.
  The batch 3b page gave the whole-cell plate a wrong cost (covering the focus line);
  the user was shown the correction with the applied frames and kept the plate.
  The shared image `localhost/monochromatic/ide` now contains cargo-about 0.9.2.
- Agents at work:
  - `fix/ide-test-flakes` (`.claude/worktrees/ide-test-flakes`), the last feature branch outstanding:
    merging `main`, the remaining native external-reload flakes, lazy server lookup, and five gate rounds.
  - `fix/ide-guard-anchors` (new worktree from `main`):
    the stale `frame-stamp` guard anchor, a static check of every guard script's anchors,
    and the three files `:format:rust` rewrites on `main`.
- Still owed after those:
  rerun every `inspect:*-guards` script on final `main`,
  repeated gate runs,
  a consumer check of the installed single file,
  and removing finished worktrees whose branches are pushed.
- Inotify:
  on 2026-10-06 about 478000 of the host's 524288 inotify watches were in use,
  about 462000 of them by `git fsmonitor--daemon` processes
  (`core.fsmonitor=true` in `~/.gitconfig`),
  one per worktree and per git-wrapper shadow git directory,
  each watching every directory of its worktree including ignored `node_modules` and `target`
  (146000 for another session's worktree,
  135000 for the main checkout,
  about 13900 for each IDE worktree with a build cache).
  The coordinating session removed twelve clean,
  fully pushed IDE worktrees it had created
  (their branches remain).
  The user then chose to turn the monitor off for this repository:
  `core.fsmonitor=false` is in `.git/config`
  (the wrapper's shadow git directories include that file),
  and stopping the sixteen running daemons that served this repository freed 436062 watches;
  49870 were in use afterwards.
  Three daemons for another session's worktree `translation-repair` started again afterwards,
  one through an explicit `git fsmonitor--daemon start` under the git wrapper's shadow git directory;
  the cause is not established.
- Reminder issues for the user to raise upstream themselves,
  opened on 2026-10-06 as with #606 for Slint:
  #608 (helix-lsp logs a server's normal exit at ERROR level)
  and #609 (the TypeScript 7 language server exits with `context canceled`).
  Each points at its troubleshooting document's draft.
- Still owed to the user:
  UI batch 3 with screenshots
  (hint row look,
  label shortening,
  diagnostic row wording,
  the caret card beside the rows,
  UI batch 2's open choices,
  the watch-limit message,
  the launcher icon).

Claude Opus resumed the queue on 2026-10-05 from `e81b01c42`
and fanned the work out to in-process subagents at the user's request.
Unrelated concurrent commits from other sessions sit in the same history;
leave them alone and stage only explicit task paths.

Proportionality rule from the user's correction:
editord is a familiar reference,
not an exact contract.
Do not chase a reference's incidental engine semantics,
and do not start a technology-vetting run,
when a plain conventional solution with existing dependencies meets the stated scope.

Work in flight,
each owned by one subagent:

- Branch heads at 11:48 on 2026-10-05,
  all committed with clean worktrees:
  `feat/ide-sidebar-resize` at `4e0907962` (6 commits,
  plus `8bfa7bd0b` later;
  since integrated),
  `feat/ide-source-keys` at `b59b15b59` (8 commits,
  since integrated),
  `feat/ide-language-core` at `652d383dd` (7 commits;
  12 through `00dd01956` were integrated,
  and later commits on that branch carry the bubblewrap leg).
  All three agents were cut off by an API session limit at about 11:10
  and resumed at 11:48 from their transcripts.
  If this session ends,
  integrate each branch with `git cherry-pick main..<branch>` one branch at a time,
  running `:test`,
  `:test:native`,
  and `:lint` between branches.
  Files touched by more than one branch:
  `mise.toml`,
  `src/lib.rs`,
  `src/native.rs`,
  `ui/app.slint`
  (and `README.md` additions);
  resolve them additively.
  Guard-removal proofs are taken on branch state;
  rerun every `inspect:*-guards` task once on the final `main`.
  When another session has files staged in the main checkout,
  `git cherry-pick` refuses to run there
  ("your local changes would be overwritten by cherry-pick").
  The language-core integration therefore ran in the provisioned worktree `.claude/worktrees/ide-integrate`
  on branch `integrate/ide-language-core`:
  cherry-pick,
  gate,
  `git rebase main` when other sessions moved `main` meanwhile,
  confirm `git rev-parse <commit>:package/desktop-app/ide` is unchanged from the gated commit,
  then `git merge --ff-only` from the main checkout.
  Whether a fast-forward preserves another session's staged files was not tested,
  because their files had been committed by then.
- No agent edits the IDE crate in the main worktree now.
  `main` is the integration point:
  the coordinating session cherry-picks each branch and reruns the suite.
  `inspect:native` takes `IDE_NATIVE_MCP_PORT` so parallel sessions do not collide.
- Bubblewrap launch policy for the Language module:
  done,
  landed on `main` through `34e41e424`
  (branch commits `6789cfd9f` through `b9f877b23`).
  `LanguageSetup::default()` confines every server with `/usr/bin/bwrap`
  (no network,
  `--clearenv` plus an allowlist that keeps `RUSTUP_TOOLCHAIN`,
  a process-id namespace except for the TypeScript servers,
  per-project per-server state under the cache directory,
  type acquisition off)
  and binds the project back read-only last,
  so projects below `/tmp`,
  `/run`,
  and `/dev` work;
  only `/proc` is refused.
  `PROJECT_MOUNT` in `src/language/confine/project.rs` is the single place a 1.x write mode would change.
  Every failure is `LaunchRefused` with a remedy;
  nothing falls back to an unconfined launch,
  so the native UI must show that state.
  Measured:
  `inspect:language-confinement` 114 of 114 checks,
  including fixtures below `/tmp` and `/run/user/1000`;
  confined `inspect:language` 20 of 20 for TypeScript and 21 of 21 for Rust,
  with the project tree unchanged and two `rustc` `E0308` diagnostics from `cargo check`
  now that the Rust fixture has a `Cargo.lock`.
  Gate on the identical IDE tree:
  44 test binaries with no failures,
  43 of 43 native tests,
  lint.
  Notes:
  `doc/troubleshooting/bubblewrap-project-paths-and-working-directory.md`;
  the TypeScript servers can still signal host processes because they run without a process-id namespace.
- Native language navigation:
  done,
  landed on `main` through `d92a57d21`
  (branch commits `e98f8b243` through `9aa5b8531`,
  plus the coordinator's integration fix).
  `native::run` enters the project directory right after `Workspace::new`,
  starts `LanguageWorker`,
  and keeps the window working if either fails.
  Bindings,
  from editord unless noted:
  Ctrl+B for definition at the caret
  (falling back to references when the only target is the caret's own line),
  Ctrl+click for definition under the pointer,
  Ctrl+Q for hover at the caret
  (JetBrains Quick Documentation;
  editord has no keyboard hover),
  and hover after the pointer rests 350 ms.
  Several targets open a location list beside the caret line;
  `file` targets outside the project open read-only with an "Outside project" tag,
  no tree reveal,
  and no history slot.
  Server and document states produce a note only after an explicit action;
  the sentences are in `src/native/language/message.rs` and the README section "Language navigation".
  The package README lists every deliberate difference from editord.
  Integration finding:
  the build image has no `bwrap`,
  so window tests must launch the scripted server with `launch_directly`,
  as `tests/language/support.rs` does;
  the branch's tests used `LanguageSetup::default()`,
  which became confinement after they were written,
  and all failed with "the scripted server did not become ready" until `d92a57d21`.
  That commit also adds a window test and guard entry for a refused launch,
  the state a user without bubblewrap reaches.
  Gate on the integration branch:
  44 library and integration test binaries with no failures
  (run before the test-only fix,
  which does not touch them),
  75 of 75 native tests,
  lint;
  the `launch-refused-explained` guard control failed when removed and passed when restored
  (`~/temp/agent/ide-language-navigation-guard-KZntea`).
  The branch's own evidence:
  12 guard controls
  (`~/temp/agent/ide-language-navigation-guard-reiHcb`,
  `~/temp/agent/ide-language-navigation-guard-RKSEkB`)
  and seat-input sessions against disposable TypeScript 7 and Rust projects in
  `~/temp/agent/ide-lsp-nav-evidence/`,
  taken unconfined before confinement landed;
  the coordinating session inspected the TypeScript hover and Rust references frames.
  Still to do for this feature:
  rerun the nested sessions on `main`,
  where servers are confined;
  stop language-server shutdown from logging bare errors
  (`context canceled`,
  `StreamClosed`,
  and rust-analyzer's "notify error: No path was found" all land at ERROR through `helix_lsp`),
  which the repository's cleanup rule forbids;
  selected rows of the location list use the palette's selected-text ink like the tree and search list.
  The annotation renderer's snapshot store and repaint are recorded in the item "Inlay hints and diagnostics".
- Inlay hints and diagnostics:
  done,
  landed on `main` as merge `1d7bc0fe7`
  (branch `feat/ide-lsp-annotations` through `112dbd955`,
  merged on `integrate/ide-language-core` as `3476a78af` with fixes `889beb9fe` and `d5ea96492`),
  plus the test correction `1c953683b`.
  Hints are drawn in boxes after the end of their line,
  diagnostics as severity underlines with lettered markers,
  and the problems at the caret in a card;
  placement was the agent's delegated choice and stays open to the user's veto.
  The package README section "Inlay hints and diagnostics" has the measurements and the differences from editord.
  One store:
  `State::annotations` is `ide_app::annotation::Annotations`;
  the language poll stores a snapshot only for the displayed file generation and revision
  (`accept_hints`,
  `accept_diagnostics`),
  the renderer reads the same store,
  and the frame stamp includes the visible annotations.
  The poll repaints once in the tick that stored a snapshot (`src/native/language/poll.rs`).
  The problem card hides while the hover popup,
  a note,
  or the location list is shown (`problem-card-visible` in `ui/app.slint`).
  Gate at `d5ea96492`
  (IDE tree `4653e9920f21305bb958cbd65fe80ed5b6d6a7eb`):
  lint;
  the library and integration tests on the second run;
  85 of 85 native tests.
  Guard controls on `main` at `1c953683b`:
  `repaint-on-accept` and `card-yields-to-popup` failed when removed and passed when restored
  (`~/temp/agent/ide-language-navigation-guard-murJAW`),
  and the re-anchored `card-focus` guard likewise
  (`~/temp/agent/ide-annotation-guard-a3HMKh`).
  Two findings from this integration.
  First,
  the window tests' shared server definitions set `IDE_SCRIPTED_PUSH` to `0`;
  a test that needs the scripted warning names `PUSH` itself.
  Second,
  the first version of the repaint test passed with the repaint removed
  (`~/temp/agent/ide-language-navigation-guard-pc9vqd`):
  the source refresh repaints once when the file's first highlighting answer is applied,
  about 250 ms after opening,
  and that painted the stored annotations.
  The test now uses a server that answers after 3 s,
  waits until `State::syntax_revision` equals the displayed revision,
  and asserts nothing is painted before the server is ready.
  Any window test that claims "painted without another event" needs the same wait.
- Open defect,
  observed once in the first library test run of that gate:
  `lifecycle::dropping_the_worker_leaves_no_child_process` failed with a scripted-server child
  left as a zombie (state `Z`) for the whole 5 s wait after the worker was dropped
  (`~/temp/agent/ide-gate-logs-20261005/annotations-merge-test-zombie.log`).
  The Language module's shutdown code is the same on `main`,
  so this is not from the merge.
  Unverified guess:
  the child handle is dropped with kill-on-drop before the child exited,
  and the worker's runtime ends before reaping it.
  The agent working on quiet shutdown (`feat/ide-language-verify`) was asked for the cause,
  a fix,
  a guard control,
  and the failure rate before and after;
  the test's wait must not be lengthened to hide it.
- Repeated runs on the IDE tree `b35830353a255f96dd4754d9f0836bb359201a1b`,
  taken while the host's load average was near 98
  (`~/temp/agent/ide-gate-logs-20261005/repeat/results.json` and the logs beside it):
  the native window tests passed 5 of 5 times,
  so the two find flakes fixed in `4ab83c59e` did not recur;
  the library and integration tests passed 4 of 5 times.
- Open defect from the failing run:
  `requests::inlay_hints_are_shaped_and_follow_reloads` timed out after 20 s
  waiting for hints for the reloaded text.
  At the timeout the server was ready,
  the diagnostics snapshot already carried revision 1 with the reloaded text,
  and the hints snapshot still carried revision 0.
  So hints for the new revision were never asked for,
  or their answer was dropped and not asked again;
  in the application,
  hints would vanish after an external change until something else asks.
  An agent works on it in the worktree `.claude/worktrees/ide-hints-reload`
  on branch `fix/ide-hints-after-reload`:
  reproduction rate,
  cause,
  fix in the Language module,
  a deterministic regression test with its guard control,
  and the rate after.
- Event-driven tree and displayed-file refresh with the user-approved `notify` crate:
  landed on `main` as merge `732384e4b`
  (branch `feat/ide-tree-watch` through `096fbf574`,
  9 commits on `48a1b5756`,
  merged on `integrate/ide-language-core` as `aab809c54`
  with additive conflicts in `mise.toml` and `src/native.rs`).
  Gate at `aab809c54`
  (IDE tree `b35830353a255f96dd4754d9f0836bb359201a1b`):
  lint;
  88 passing library and integration result lines with none failed;
  87 of 87 native tests with the two ignored latency measurements skipped.
  Still in flight:
  the user chose a 1 s safety sweep and a 50 ms quiet,
  100 ms limit write wait,
  and kept the 100 ms gap;
  `main` still has the 10 s sweep and the 150 and 250 ms waits.
  The watch agent applies the new values on `feat/ide-tree-watch`
  (worktree `.claude/worktrees/ide-tree-watch`),
  with a log-once rule for failed watches,
  idle cost measured at 1,
  12,
  and 100 expanded folders,
  and a fresh latency run;
  merge its new commits after it reports.
  The 30 watch guard controls were observed on the branch;
  the rerun on the merged tree `b35830353a255f96dd4754d9f0836bb359201a1b` passed 30 of 30
  (`~/temp/agent/ide-watch-guard-UAHxUa`),
  taken with the 10 s sweep and the 150 and 250 ms waits.
  The agent's measured results and open points,
  taken with the 10 s sweep and the 150 and 250 ms waits:
  - `notify` 8.2.0 with default features off;
    the code names `notify::INotifyWatcher`,
    so no polling backend can be selected.
    Six new lockfile packages
    (`notify`,
    `notify-types`,
    `inotify`,
    `inotify-sys`,
    and the BSD-only `kqueue` and `kqueue-sys`),
    regenerated with the `fetch` task.
  - Watched,
    each non-recursively:
    the root,
    visible expanded folders,
    and the displayed file's folder,
    only when the folder's canonical path equals its path inside the root.
    Events only invalidate;
    the existing readers reread and keep their stale-reply fencing.
  - A full reread follows a queue overflow,
    a stream error,
    an event without paths,
    a removed or renamed watched folder,
    a failed watch,
    and a watch thread that ended.
    Items without a live watch keep the old timers (file 250 ms,
    folders 500 ms round robin);
    a sweep every 10 s rereads everything shown and retries failed watches.
  - Latency from an external write to the model change,
    medians of 16 trials in 3 runs:
    a new file with eight expanded folders took 1657 to 1706 ms under polling and 29 to 35 ms watching;
    a rewrite of the displayed file took 115 to 118 ms and now 44 to 48 ms.
    Run-to-run spread of medians was at most 134 ms polling and 6 ms watching
    (`~/temp/agent/ide-refresh-latency-MpRf1V/results.json` before,
    `~/temp/agent/ide-refresh-latency-9Ljcjy/results.json` after).
  - On the branch:
    30 of 30 guard controls (`~/temp/agent/ide-watch-guard-lnfGWB/results.json`),
    405 passing library and integration results,
    43 of 43 native tests with the two ignored latency measurements skipped,
    lint;
    nested-session frames for both schemes in `~/temp/agent/ide-tree-watch-20261005/native-evidence-final/`.
  - Values the agent chose,
    since decided by the user as stated in this item:
    the 10 s sweep,
    a 100 ms gap between notified rereads of one item
    (added beyond the brief so a busy folder is not reread every tick),
    and the 150 ms quiet and 250 ms limit before reading a file that is still being written.
  - Still open,
    to be asked with built screenshots:
    whether reaching the watch limit shows a visible message or stays log only.
  - Not exercised end to end:
    an unavailable watcher (inotify instance limit) and `fs.inotify.max_user_watches` exhaustion;
    both are logged at WARN and fall back to the timers,
    with no visible message.
    `notify` 8.2.0 spawns its loop thread detached and unwraps sends to it;
    a panic there would take the watch thread down.
  - Facts worth keeping:
    the IDE's own reads raise open and close events on watched paths,
    so only close-after-write counts among access events;
    a moved folder's watch follows the inode unless removed,
    and `notify` removes it itself only when the parent is watched too.
- UI batch 2:
  the comparison page and option screenshots are on `main`
  (`package/desktop-app/ide/design/`,
  commit `b52227249`),
  the user answered every question,
  and the answers are in the scope record under "Interface decisions (UI batch 2)".
  An agent applies them in the worktree `.claude/worktrees/ide-ui-batch2`
  on branch `feat/ide-ui-batch-2`
  (MCP ports 9394 and 9395),
  based on `integrate/ide-language-core` at `d5ea96492`:
  a thin divider line with a narrow pointer grab zone taken from cited desktop precedent,
  the divider still a Tab stop with two-channel focus,
  the application's own text box with a 48 by 48 clear cell in the find and search boxes,
  white text on selected rows in the tree,
  the search list,
  and the references list,
  and frames of the applied result under `package/desktop-app/ide/design/screenshots/`.
- Release packaging and the consumer-boundary check of the packaged application
  in the worktree `.claude/worktrees/ide-package`
  on branch `feat/ide-package`
  (MCP ports 9414 and 9415),
  based on `aab809c54`:
  what a runnable artifact means from sibling precedent and Helix's runtime lookup,
  a release build task,
  a self-contained directory that runs without `HELIX_RUNTIME` and the source tree,
  a check of that artifact in the nested compositor against disposable TypeScript and Rust projects,
  and the scale-change latency in release and debug builds.
  Desktop entry,
  icon,
  installer,
  and install location are left as questions for the user.
- Landing a branch that conflicts with `main`:
  merge it with `git merge --no-ff` in `.claude/worktrees/ide-integrate`,
  resolve once,
  and gate there.
  A plain `git rebase main` afterwards would drop the merge commit and its resolutions,
  so a gated merge lands through the worktree `.claude/worktrees/ide-land`
  (branch `land/ide-desktop-app`):
  fast-forward it to `main`,
  `git merge --no-ff <gated commit>`,
  confirm `git rev-parse HEAD:package/desktop-app/ide` equals the gated tree,
  then `git merge --ff-only` from the main checkout.
  That keeps `main` as the first parent.
- Quiet language-server shutdown and the confined navigation check
  in the worktree `.claude/worktrees/ide-language-verify`
  on branch `feat/ide-language-verify`
  (MCP ports 9408 and 9409):
  trace and fix the ERROR-level shutdown and runtime messages at their cause,
  a lifecycle check that fails on any of them,
  SIGKILL of the application leaving no server behind,
  and navigation in the nested compositor with confined servers against disposable projects below `/tmp`,
  with project tree hashes before and after.
- Nested compositor output scaling and the closed private bus:
  done on `main`,
  commits `a8e60feca` through `dd5a19953` in `package/cli/nested-wayland-session`.
  `--scale SCALE` at startup and `scale SCALE` on the control socket accept 0.5 to 3 in steps of 1/120;
  `--size` and `resize` are logical sizes,
  screenshots and recordings are logical size times scale,
  and input coordinates stay logical.
  The client learns the scale through `wp_fractional_scale_v1` with `wp_viewporter`,
  which winit 0.30.13 requires together.
  Captures now render into an offscreen texture,
  because Mesa defers a window resize while an unswapped back buffer exists
  and frames recorded after a mid-recording scale switch were empty.
  The private `dbus-daemon` runs from a written configuration with no service directories:
  it lists only `org.freedesktop.DBus` and answers `ServiceUnknown` at once,
  where the stock configuration listed 73 activatable names.
  The package passes 69 tests,
  lint,
  Clippy,
  and its `inspect:clipboard`,
  `inspect:color-scheme`,
  `inspect:stalled-parent`,
  and new `inspect:scale` tasks;
  release binary sha256 prefix `cc9c5479b3b4346c`.
  IDE scale migration,
  verified end to end with `inspect:native dark scroll` and switches 1,
  2,
  1.25,
  1:
  every settled frame is sharp,
  the first frame the IDE commits at each scale equals the settled one,
  and the frame after the round trip equals the start
  (`~/temp/agent/nws-scale-nasfB8/ide-run-2/`).
  Worktrees that copied the release binary earlier lack `scale` until recopied.
  Open:
  an intermittent `calloop` "Received an event for non-existent source" warning,
  not attributed;
  a README link in that package points at `doc/decisions/` instead of `doc/decision/`.
- Coordinator working-directory hazard:
  the compositor agent reported its session working directory moving into `.claude/worktrees/ide-integrate`
  while the coordinating session ran commands there.
  Keep every coordinator command pinned with `cd /var/home/user/Monochromatic` or `git -C`,
  and tell agents to pin theirs.
- Inlay hint and diagnostic placement,
  decided by the user on 2026-10-05 and not started yet:
  hints move from boxes after the line end to virtual rows above the code line,
  like editord,
  and diagnostic messages go on virtual rows there too,
  replacing the lettered marker and the caret card unless the user keeps either;
  the rows must read as belonging to the code line beneath them,
  through spacing;
  the scope record has the user's words under "Interface decisions (inlay hints and diagnostics)".
  The worktree `.claude/worktrees/ide-hint-rows` on branch `feat/ide-hint-rows` is provisioned
  (MCP ports 9424 and 9425),
  and the agent's complete brief is kept at `~/temp/agent/ide-gate-logs-20261005/agent-w-hint-rows-brief.md`.
  The harness runs at most five agents at once
  (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`),
  and all five slots were in use;
  start this agent with that brief when one finishes.
  Its second phase produces the comparison frames for UI batch 3:
  hint row look,
  label shortening,
  marker and card beside the diagnostic rows,
  and the wording of a diagnostic row.
- Session-limit recovery at 18:50 on 2026-10-05:
  all five agents had been cut off;
  their worktrees held the work described in the next item,
  partly uncommitted,
  and each was resumed from its transcript with its measured state.
  One orphaned private `dbus-daemon` of a dead nested session (started 16:34) was stopped by process id.
- Usage-limit stop at about 16:45 on 2026-10-05:
  the coordinating session reached its usage limit while five agents were running.
  Each works in its own worktree and commits as it goes;
  none of their work was on `main` beyond what this section records as landed.
  To resume,
  check each worktree with `git status` and `git log`,
  check for leftover processes and bound MCP ports,
  and continue from the branch:
  `feat/ide-ui-batch-2` in `.claude/worktrees/ide-ui-batch2` (UI batch 2),
  `feat/ide-tree-watch` in `.claude/worktrees/ide-tree-watch` (the user's timing values),
  `feat/ide-language-verify` in `.claude/worktrees/ide-language-verify` (quiet shutdown and the zombie child),
  `feat/ide-package` in `.claude/worktrees/ide-package` (release packaging and the consumer check),
  and `fix/ide-hints-after-reload` in `.claude/worktrees/ide-hints-reload` (hints lost after a reload).
  Merge each on `integrate/ide-language-core`,
  gate,
  and land through `.claude/worktrees/ide-land`.
  Still owed to the user,
  with built screenshots:
  a visible message or log only at the watch limit,
  the divider's pointer grab width,
  and how several inlay hints on one line are told apart.
- Commits that appear late:
  on 2026-10-05,
  with the host's load average near 98 from several sessions' builds,
  a commit through the repository's `git` wrapper took minutes,
  and one command returned while its file was still staged and its commit was not yet in `git log`.
  Issuing the same commit again produced the real commit `e8ac286e4`
  and an empty duplicate `29a5b0da6` with the same subject
  (corrected by a commit comment on GitHub).
  The wrapper's landing mechanism was not read,
  so the cause is not established.
  After a commit command returns without a visible commit,
  look at `git log` again after a while and at running `git-policy-cli` processes before committing again;
  run commits in the background and read their full output from a file.
- Session-limit interruptions:
  the API session limit cut the running agents off twice,
  at about 11:10 and 14:15 on 2026-10-05.
  Each time their worktrees held committed work and nothing was left running;
  the coordinating session checked each worktree with `git status`,
  checked for leftover processes and bound MCP ports,
  and resumed every agent from its transcript with a message stating the measured state.
  The compositor agent works in the main checkout and had uncommitted edits at the second cutoff.
- IDE reaction to a live color-scheme switch:
  done,
  landed on `main` as `f158ae458` and its parent.
  No IDE source change was needed.
  `src/native/theme_tests.rs` switches dark,
  light,
  dark through `SlintContext::set_color_scheme`
  (the call Slint 1.18.1's portal watcher makes)
  and requires the live source image to equal a cold render,
  the scheme's syntax and selected-text ink,
  match rectangles,
  and tree,
  find bar,
  and divider on the scheme's side;
  a second test re-tints the accent five times per scheme.
  Both reach the toolkit through `slint::private_unstable_api`,
  so a Slint upgrade may break only these tests.
  Five guard-removal controls failed as named
  (`~/temp/agent/ide-theme-guard-wGG2mw`).
  In the nested compositor,
  `color-scheme light` and `color-scheme dark` repainted within one frame,
  and the return to dark was byte-identical;
  twelve recorded switches showed no frame with the new palette over the old source image
  (frames in `~/temp/agent/live-theme-Z50lLh/evidence/ide-native/`).
  Gate on the integration branch:
  43 of 43 native tests,
  lint.
  Found along the way:
  the file tree and combined-search rows still draw selected text with the palette's dark-scheme black on blue
  (`ui/tree.slint`,
  `ui/search.slint`),
  unlike the source view's fill-derived ink;
  fix them with the same rule.
- Runtime color-scheme switching in `package/cli/nested-wayland-session`,
  through the private portal only,
  plus a read-only analysis of what the IDE needs for a live switch.
  IDE-side verification is a later leg.

Completed in this fan-out:

- Headless Language module core,
  integrated onto `main` through `770c8f3a6` from `feat/ide-language-core` commits `8ee886976` through `00dd01956`.
  `ide_app::language::LanguageWorker` runs `helix-lsp` on one long-lived `ide-language` thread;
  commands are non-blocking
  (`Ok(false)` means the 64-entry queue is full; resend next tick)
  and replies,
  status,
  diagnostics,
  and hint snapshots are polled;
  every result carries a `DocumentStamp` of file generation and revision,
  and the handle drops stale ones and counts them.
  The package README section "Language module" lists the API and states.
  Deviations from the design,
  recorded in the agent report and `doc/troubleshooting/helix-lsp-embedding-roots-and-stop.md`:
  `Registry::stop` leaves a tombstone that blocks restarts,
  so servers are retired with `remove_by_id` and `force_shutdown`;
  paths are respelled through Helix's `PWD`-derived workspace,
  because `/home` links to `/var/home` here and a resolved path otherwise yields `rootUri: null`;
  superseded answers retry at most three times while their text is displayed;
  the unversioned-diagnostics hold falls back after 2 s,
  a chosen,
  unmeasured value.
  The TypeScript override requires the project's `package.json` to name TypeScript 7 or later,
  otherwise the state is `MissingExecutable` with a remedy;
  workspace and user Helix configuration are never loaded.
  Lockfile change:
  two direct dependency edges (`arc-swap`,
  `futures-util`),
  no new package or version.
  Gate in the integration worktree on the identical IDE tree:
  44 test binaries with no failures,
  41 of 41 native tests,
  lint.
  Real servers on disposable projects
  (`inspect:language`):
  18 of 18 checks each for TypeScript 7.0.2 and rust-analyzer,
  evidence in `~/temp/agent/ide-language-core-evidence-20261005/inspect-passing/`;
  that run is unconfined and rust-analyzer wrote `Cargo.lock` into its disposable project.
  Eleven guard-removal controls passed
  (`~/temp/agent/ide-language-guard-FpVQz5/results.json`,
  `~/temp/agent/ide-language-guard-uWmw4T`).
  Native wiring must call `language::enter_project_directory` right after `Workspace::new` at startup,
  add `HELIX_LOG_DIRECTIVE` to the log filter,
  build `DocumentReload::from_reload` before `Document::apply_reload` consumes the reload,
  and accept that dropping the handle blocks up to about 1 s while servers exit.
- Resizable sidebar,
  cherry-picked onto `main` as `365699eef` through `2187b8ebd` from `feat/ide-sidebar-resize`,
  plus the integration fix `0123ec0ba`.
  The tree starts at 256px like editord's `16rem`,
  session-only,
  and stays between 160px and the window width minus the divider cell and a 240px source column.
  The divider is its own 48px layout cell,
  so its pointer area overlaps no tree row or source text;
  the cost is a 47px gutter beside the 1px line.
  A left-button drag resizes;
  clicks and double-clicks without movement do nothing.
  The divider is a Tab stop between tree and source,
  steps 16px with Left and Right and jumps with Home and End,
  and is exposed as a `slider` named "Sidebar width",
  because Slint 1.18.1 has no splitter or separator role.
  States use two channels:
  idle 1px line,
  hover with column-resize cursor and a 3px line,
  drag at full ink,
  keyboard focus with a cell boundary.
  The width is clamped by layout constraints,
  not a size binding on `root.width`,
  which is a binding loop;
  the source cell's preferred width equals its 240px minimum,
  or long content shrinks the sidebar.
  The tab stop and the 48px cell changed `main`'s source pointer and focus test expectations,
  updated in `0123ec0ba`.
  The first gate on `main` after this stopped on the known flaky paint test;
  `4ab83c59e` fixed both find flakes at their cause
  (the waits now also require the active match to spell the whole query),
  and the rerun passed 234 library and integration tests,
  41 of 41 native tests,
  and lint.
  One passing run does not prove the flake gone;
  repeated native runs on the final `main` are part of the closing gate.
  Eight guard-removal controls passed on the branch
  (`~/temp/agent/ide-sidebar-guard-hJqYf7/results.json`).
  Dark,
  light,
  and 480x320 narrow sessions passed with seat clicks and toolkit-level drags,
  because the compositor protocol has no held pointer drag;
  evidence in `~/temp/agent/ide-sidebar-j/`.
  `inspect:native` now also takes `IDE_NATIVE_SIZE`,
  because the compositor's `resize` command had no effect while the host session was locked
  (inferred,
  with the older compositor binary).
  The divider-as-Tab-stop choice and the gutter were reported to the user as open to veto.
- Source-view reading gate,
  cherry-picked onto `main` as `6545c521d` through `374ea9a36`
  from `feat/ide-source-keys`.
  Bindings,
  each with a Shift form that extends the selection:
  Left and Right by grapheme (collapsing a selection first),
  Ctrl+Left and Ctrl+Right by word,
  Home,
  End,
  Ctrl+Home,
  Ctrl+End,
  Up and Down toward a remembered pixel x,
  PageUp and PageDown by the lines in view;
  every caret key scrolls the caret into view.
  Pointer:
  click,
  double click for a word,
  triple click for a line,
  Shift+click,
  and drag by the pressed unit;
  mouse-drag panning of the source view is off so quick drags select.
  Tabs are shaped as one space widened to stops every two space advances in pixels,
  matching editord's `tab-size: 2` with mixed CJK and Latin prefixes.
  Tab and Shift+Tab cycle tree,
  source,
  and the open find input;
  the outer key-observing `FocusScope` was a dead Tab stop before.
  Selected-text ink is now white on the blue selection fill in both schemes:
  Slint's fluent style sets black in dark
  (WCAG 2 ratio 4.64,
  APCA Lc 33.4 before;
  4.53 and Lc -76.2 after).
  The coordinating session reran the gate on `main` after the cherry-pick:
  234 library and integration tests in 41 binaries,
  30 native tests,
  and package lint pass.
  Thirty-one guard-removal controls passed on the branch
  (`~/temp/agent/ide-source-guard-bX6gco/results.json`,
  `~/temp/agent/ide-source-guard-Qu70pZ/results.json`).
  Dark and light seat-input evidence is in `~/temp/agent/source-keys-k1/evidence-final/`;
  the coordinating session inspected the dark selection-ink and tab-stop frames.
  Open:
  drag autoscroll runs only while the pointer moves;
  under container load one run timed out in
  `native_find_recomputes_after_external_reload_and_follows_selection_correspondence`,
  which then passed unloaded;
  watch it.
- Language-server write confinement,
  measured and specified but not yet implemented:
  `doc/planning/slint-ide-write-confinement.md`.
  Five candidates were measured with real rust-analyzer and TypeScript servers on disposable fixtures;
  ranking:
  bubblewrap,
  an `unshare` script,
  a systemd transient unit,
  podman,
  Landlock through `setpriv`.
  Adopted on 2026-10-05 and reported to the user as open to veto:
  the bubblewrap wrapper (`/usr/bin/bwrap` is already on the host),
  no network for confined servers,
  and a process-id namespace except for the TypeScript servers.
  Under that shape the project tree stayed byte-identical,
  build scripts and procedural macros got `EROFS` on the project,
  and hover and definition still answered.
  Constraints the implementation must honor:
  build server configuration in code and never load workspace or user Helix language configuration;
  resolve the server executable to an absolute path;
  never fall back to an unconfined launch;
  keep per-project,
  per-server private state outside the project and not an ancestor of it;
  start servers from the long-lived language worker thread.
  Unconfined servers also write outside the project by default:
  cargo and npm caches in the home directory,
  and both TypeScript servers run `npm install` for type acquisition.
  Servers inherit the application environment,
  credential variables included;
  clearing it is a follow-up to test in the implementation leg.
- In-file find,
  commits `f51495788` through `4e1c2a808` on `main`.
  `src/find.rs` holds the single matcher `find_matches`
  (escaped literal,
  Unicode case-insensitive,
  source character ranges);
  `src/find_worker.rs` runs it on a named thread with one running job and one replaceable waiting request;
  results carry a `FindIdentity` of file-open generation,
  content revision,
  and query generation,
  and are used only when all parts are current.
  Bounds:
  1,000 characters of find text,
  64 MiB of source,
  10,000 retained matches.
  The bar is a layout row under the source view with no buttons:
  Ctrl+F opens it,
  Enter and Shift+Enter move with wrap-around,
  Escape closes it.
  The active match is the reading selection,
  so Ctrl+C copies it and reload correspondence reuses the selection mapping.
  `tests/find_reference.rs` asserts the exact 13 browser-corpus cases that differ.
  The coordinating session independently reran the combined `main` state:
  198 library and integration tests,
  20 native tests,
  and package lint all pass.
  Thirty guard-removal controls passed before the runtime cherry-picks
  (`~/temp/agent/ide-find-guard-xnCvWt/results.json`,
  `~/temp/agent/ide-find-guard-uRdXAC/results.json`).
  Dark and light nested-compositor evidence with seat input is in
  `~/temp/agent/find-impl-c1/evidence/`;
  the coordinating session inspected the active-match frame in both themes.
  Open items from it:
  the toolkit `LineEdit` clear icon shows in the find input,
  as it does in the search overlay;
  every accepted match list repaints the source tile.
  The stale compositor `screenshot` frames it reported are fixed;
  see the runtime color-scheme entry in this list.
- Measured Helix runtime language coverage,
  cherry-picked onto `main` as `953753833` through `9cc81b5f7`.
  The runtime ships 27 grammars for 22 of the 23 `tokei`-measured languages
  (plain text has no grammar),
  34,607,713 bytes of assets.
  A recognized language without a bundled grammar now reads as plain text;
  a bundled grammar that fails to load remains a visible failure;
  a missing or malformed `manifest.json` fails syntax-engine startup with a named diagnostic.
  The combined `main` state passed 198 library and integration tests in 34 test binaries
  (`mise run //package/desktop-app/ide:test`,
  log kept only in session scratch).
  Record:
  `doc/planning/slint-ide-runtime-languages.md`.
  Its worktree `/var/home/user/worktrees/ide-runtime-languages`
  (branch `feat/ide-runtime-languages`)
  is merged and no longer needed.
- The compiled `helix-lsp` spike and design:
  `doc/planning/slint-ide-language-intelligence.md`.
  Adopted there on 2026-10-05:
  the project's own TypeScript 7 server (`tsc --lsp --stdio`) replaces Helix's default TypeScript entry,
  because `typescript-language-server` 6.0.0 cannot start without a `tsserver.js` and the repository pins TypeScript 7;
  `file` targets outside the project root open read-only;
  `didSave` follows an external reload when the server asks for it.
  The TypeScript choice was reported to the user as open to veto.
- Runtime color-scheme switching in the nested compositor,
  commits `96f8adc2a` through `8da338a3e` on `main`.
  The control socket accepts `color-scheme dark|light`;
  it answers `ok changed` after replacing the served value and emitting
  `org.freedesktop.portal.Settings.SettingChanged` with body `ssv`
  from the connection that owns `org.freedesktop.portal.Desktop` on the private bus,
  `ok unchanged` without a signal,
  and an error when the session has no private portal.
  It never falls back to another bus.
  Slint 1.18.1's winit backend ignores the signal from any other sender or with a `u` body
  (`doc/troubleshooting/slint-nested-color-scheme-portal.md`).
  `inspect:color-scheme` in that package showed a `slint-viewer` scene follow dark,
  light,
  dark,
  light live.
  The same leg traced and fixed the stale `screenshot` frames:
  while the parent compositor stops presenting,
  for example with the host session locked,
  the hosted client received no frame callbacks;
  `src/frame_pacing.rs` now paces it from a timer
  (`doc/troubleshooting/nested-wayland-screenshot-stale-frame.md`).
  The package passes 56 tests,
  lint,
  and Clippy.
  Read-only analysis found no IDE change needed for a live switch:
  `ui/app.slint` calls `theme-changed` when `dark-scheme` changes,
  and `src/source_frame.rs` includes the colors in the frame stamp.
  Not yet verified:
  the IDE under a live switch,
  a headless theme-change test,
  and a possible frame with the new palette over the old source image.
  The compositor has no runtime output scaling,
  so physical-output DPI migration is covered only by the headless scale-factor test.
  Residual risk found by that leg:
  the private D-Bus daemon attempts service activation from host service files
  (a hosted `slint-viewer` triggered `org.a11y.Bus` activation,
  which failed with `Permission denied`);
  nothing reached the host bus,
  and a private daemon configuration without service directories would close it.

Known constraints from the spike that the native wiring must honor:
`Registry` derives the LSP root from the process working directory;
a client used before `initialize` completes panics;
a failed `initialize` is invisible without a watchdog;
unconfined rust-analyzer writes `Cargo.lock` and `target/` into the project,
so real servers run only against disposable projects until confinement is wired in.

Language servers present on this host for measured languages:
TypeScript and JavaScript,
Rust,
Slint,
and QML.
Sixteen other measured Helix languages configure servers that are not installed;
SQL,
Batch,
and XML configure none.

Claude Code's built-in worktree isolation for subagents fails here;
see `doc/troubleshooting/claude-code-worktree-create-hook-no-path.md`,
written by another session,
for the cause and the manual `git worktree add` workaround with its provisioning steps.
The repository `git` shim rejects `git switch --create` inside an existing worktree;
new branch work needs its own `git worktree add -b`.

Queue after the in-flight work:

1. Integrate the annotation branch,
   then connect `State::annotations` to its renderer,
   and verify all five language feature paths in the nested compositor on `main`,
   confined,
   against disposable projects.
2. Measure the IDE's scale-change latency in a release build.
   In the debug build the compositor showed the IDE's previous buffer,
   scaled and soft,
   for about 330 ms after a switch from 1 to 2 before the first new frame;
   a cold glyph cache at the new scale is a guess,
   not a measured cause.
3. Confirm the two find flakes are gone with repeated native runs on the final `main`.
   `native_find_paints_visible_matches_only_and_reveals_far_columns` failed 3 of 8 runs on unmodified `8995633b0`
   because the query `n` also yields its `1/301` count;
   `native_find_recomputes_after_external_reload_and_follows_selection_correspondence`
   failed 1 of 8 with selection `(2, 5)`,
   because the prefix `am ` also yields `1/1`.
   `4ab83c59e` adds `status_for`,
   which also waits for the active match to spell the whole query.
4. The final package gates:
   guard-removal reruns on the final `main`,
   packaging,
   consumer-boundary checks,
   and the behavior-difference record.

Do not restart technology selection for the IDE architecture:
Helix reuse and the standalone Rust/Slint design are approved.

Historical navigation verification:
The read-only workspace model's five tests and the lazy tree model's eight tests pass.
`FileTree` accepts directory snapshots without doing filesystem I/O.
Opaque directory-request identities now fence replies;
`proc_36aa` passed all fifteen tree/request tests and scoped Rust lint.
`DirectoryWorker` now performs bounded background reads with admission before token creation;
`proc_ab5d` passed all twenty tree/request/worker tests plus scoped Rust lint.
Native tree rows,
file switching,
and Ctrl+digit promotion/reveal are now bound.
Native callback tests and scoped lint pass in `proc_ee8d`.
Actual nested Wayland mouse/keyboard/clipboard navigation checks pass in
`/tmp/monochromatic-ide-native-bOrX20/interaction.mjs` and `edge-probe.mjs`.
Off-screen reveal,
Tab/Shift+Tab traversal,
and clicks on windowed rows now pass in the light native probe.
Guard controls,
formatting,
91 library/integration tests,
ten native tests,
and package lint pass.
The final dark native smoke also passes with the click guard installed.
This navigation checkpoint preceded the combined-search gate.
Identity/admission and file-open-generation guard controls subsequently passed in the disposable copy.
The procedural-macro and variable-font paths now both pass native font isolation.
Continue annotations and language intelligence after workspace navigation.
Actual TypeScript/Rust syntax is now wired and the highlighted native screenshot was inspected.
The simplified UI,
nested clipboard,
and live external-change correspondence are verified.
Do not restart technology selection:
Helix reuse and the standalone Rust/Slint architecture are approved.

## Confirmed contract

- Current Linux x86_64 KDE/Wayland host only;
  local projects,
  one project root/window/source view.
- Read-only source navigation:
  file tree,
  combined path/content search,
  syntax highlighting,
  line numbers,
  caret/selection/copy,
  in-file find.
- Definition,
  references,
  hover,
  inlay hints,
  and displayed-file diagnostics,
  according to actual backend capabilities.
- Coverage is actual repository source/configuration languages found by `tokei`,
  intersected with Helix support.
  Documentation fences do not expand semantic coverage.
  No custom integrations for unsupported languages.
- No direct or delegated project-file writes.
  Scoped private caches and temporary files outside the project are allowed.
  Cache relocation alone is not write confinement.
- External changes refresh during selection,
  preserving best-effort source correspondence and roughly stable viewport.
  Required cases are `I am a bi|g cat.` to `I was a bi|g cat.`,
  and `I [am a] big cat` to `I [was a] big cat, but now I am a human!`.
  The selection must not jump to the later occurrence of `am a`.
- Ctrl+0 through Ctrl+9 match editord:
  unique MRU slots,
  promotion,
  tree badges,
  ancestor expansion,
  reveal,
  and session-local history.
  Ctrl+0 is the current file;
  Ctrl+1 alternates the last two after promotion;
  empty slots do nothing.
- Bundle Inter and JetBrains Mono with their licenses.
  Follow system appearance,
  including runtime changes,
  without an app-specific override.
- Shared CJK/Latin baseline and advance geometry.
  The independently centered per-grapheme screenshot was rejected.
- Genuine pixel-level smooth scrolling with a notched wheel,
  following music-player's native `Flickable` approach.
- Minimal visible UI.
  The user rejected the read-only indicator and Copy button.
  Those controls and the debug footer are removed from the current markup.
  Copy stays on Ctrl+C;
  accessibility retains read-only semantics;
  actionable errors appear only when needed.
- Record every deliberate difference from editord.
  Editing,
  saves,
  formatting,
  refactoring,
  filesystem mutations,
  go-to-line,
  tabs/splits,
  multiple roots,
  Git/status/diff UI,
  terminal/task/agent control,
  project-wide problems,
  rendered/media previews,
  persistent restore,
  remote support,
  and additional platforms are excluded.

## Work queue

- [x] Implement and verify nested compositor clap help and isolated clipboard support.
  Full package tests now report 40 passing cases,
  including wheel protocol and joined-option cases.
  Release build and post-wheel Clippy pass.
  Debug/release help exit 0 before Wayland startup.
  Native text/binary clipboard lifecycle checks pass.
  Hosted children no longer inherit X11 fallback variables.
- [x] Bundle and verify font embedding.
  Official variable roman and genuine italic Inter and JetBrains Mono
  are imported by Slint from `asset/font`.
  `build.rs` explicitly selects `EmbedResourcesKind::EmbedFiles`.
  Generated Rust embeds/registers the bytes.
  Native fontconfig excludes host copies of those families.
- [x] Complete native source-view interaction,
  clipboard readback,
  CJK/combining/tab boundary coverage,
  source rendering,
  and smooth-wheel acceptance.
  Integrated from `feat/ide-source-keys` on 2026-10-05.
- [x] Implement live external refresh and exercise both supplied correspondence examples through the GUI.
- [x] Implement native tree, file switching, and recent-file reveal/badges.
- [x] Implement combined path/content search and verify it in dark/light native sessions.
- [x] Implement in-file find.
  Matching is plain literal case-insensitive substring matching with the existing `regex` dependency;
  the 13 of 29 captured cases where Chrome's ICU collation search differs are deliberate differences.
  The native find bar,
  worker,
  and match painting are verified headless and in dark and light nested sessions.
- [ ] Implement runtime syntax and language-server paths:
  definition,
  references,
  hover,
  hints,
  displayed-file diagnostics,
  and reload synchronization.
- [x] Provision measured Helix runtime language coverage.
  Twenty-seven grammars are built,
  licensed,
  and tested on `main`;
  see `doc/planning/slint-ide-runtime-languages.md`.
- [x] Enforce subprocess project-write confinement.
  Bubblewrap by default since `34e41e424`;
  114 acceptance checks pass on disposable fixtures.
- [x] Verify light mode and live system-theme changes using the private portal,
  not host KDE settings.
  Verified on 2026-10-05 headless and in the nested compositor.
- [ ] Finish scoped formatting,
  Rust documentation/line budgets,
  Clippy,
  tests,
  packaging,
  consumer-boundary checks,
  and behavior-difference documentation.

## Current source boundaries

`src/document.rs` owns the Helix rope,
content revision,
selection,
caret,
and viewport anchor.
`prepare_reload()` uses `compare_ropes`;
`apply_reload()` rejects stale revisions and maps the latest reading state.
Its seven tests include both required correspondence cases,
reverse selection,
Unicode prefix,
deletion,
stale result rejection,
and selection movement while a reload is pending.

`src/file_reload.rs` reads regular UTF-8 source without filesystem mutation.
`src/reload_worker.rs` allows one outstanding job/reply on bounded channels,
computing reads and Helix correspondence on a named background thread.
File generations accompany replies;
the document still rejects stale content revisions.
`src/native/reload.rs` polls replies every 20 ms and submits reads at 250 ms intervals.
It applies changes to the latest selection,
retains fractional viewport placement,
and keeps the last readable text with an actionable error on read failure.
Its library tests and native build pass.
The live GUI verifies both required correspondence cases,
fractional viewport preservation after a prefix line,
and missing-file retention/recovery.
The probe is `/tmp/monochromatic-ide-reload-probe-STkJVk/probe.mjs`;
its native fixture is `/tmp/monochromatic-ide-native-zCPqiB/fixture.ts`.
Caret x changed from 137 to 146 while y remained 34,
and the next copied grapheme remained `g`.
Selection copied `was a`,
not the later literal.
Viewport offsets changed from -240.5 to -264.5 for one inserted line.
The selection screenshot was inspected.

`src/recent.rs` implements ten unique push-to-front slots and exact Ctrl+digit decoding.
Its four tests pass.
It is now wired to native file switching,
slot badges,
ancestor expansion,
and reveal.

`src/text_projection.rs` preserves source/display correspondence through expanded tabs.
`src/shaped_text.rs` uses Parley 0.11 layouts for glyph advances,
fallback baselines,
caret,
selection,
and hit testing.
`src/text_raster.rs` uses Swash 0.2 to paint those exact glyph runs into premultiplied RGBA.
Both dependencies were already present through Slint.
The raster has a 64 MiB viewport allocation limit.

`src/glyph_cache.rs` adds bounded reuse of glyph masks/color images:
16 MiB of image data and 4096 entries.
Keys retain font blob/face,
size,
variation coordinates,
glyph ID,
and exact fractional position bits.
Empty glyphs are cached too.
Theme colors are applied while compositing alpha masks.

`src/source_frame.rs` distinguishes paint inputs from collapsed caret movement.
The native renderer reuses its image and shaped geometry for caret-only changes.
Selection range,
source revision,
syntax spans,
viewport tile,
scale,
horizontal origin,
and palette invalidate painting.
Reset the stamp and accessibility revision when replacing the displayed document with another file.

`src/native.rs` owns the current UI-thread state and startup.
`src/native/render.rs`,
`src/native/input.rs`,
and `src/native/viewport.rs` separate presentation,
input,
and native scrolling.
Pointer selection,
Ctrl+A,
left/right,
Home/End,
and Copy are wired.
A hidden `TextInput` is only a clipboard bridge,
not a second text layout.

Unfinished surfaces as of 2026-10-05:
LSP wiring
and subprocess project-write confinement.
Native tree,
file switching,
combined search,
and in-file find are implemented,
and so are vertical,
paging,
word,
and focus navigation.
The accessible description no longer claims automatic refresh before that path exists.
Legacy terminal-cell geometry and tests in `view_model.rs` were removed on 2026-10-04.
The retained `StyleSpan` now lives in `source_style.rs`.

## Verification and measured rendering issue

The complete IDE suite before render reuse passed 21 tests:
seven document,
four recent,
five shaped-text,
and five legacy view-model cases.
The shaped build and Slint markup check passed.
A native dark screenshot was inspected at
`/tmp/monochromatic-ide-native-DdPO53/shaped.png`.
This is not whole-application acceptance.

Before the debug footer was removed,
a native click reached `Selection 61:61` after the leading CJK glyph;
keyboard selection reached `Selection 60:61`.
After adding nested clipboard management,
independent `wl-paste` readback matches full source,
`猫`,
and decomposed `é` exactly.
Typing and Ctrl+V preserve the accessible source value.
A multi-step MCP probe timed out,
but subsequent state reads responded and showed the expected selection;
this did not establish an application deadlock.

Repeated Home MCP requests took 357.19,
364.49,
and 359.61 ms,
while an ignored `x` request took 2.31 ms.
These are end-to-end request timings,
not isolated paint timings.
The bounded `test:raster` fixture then measured unchanged shaping at 9.82 to 10.29 ms
and rasterization at 368.16 to 373.14 ms.
After glyph caching,
unchanged shaping measured 9.42 to 9.59 ms
and rasterization 7.76 to 8.10 ms.
Repeated cached pixels match byte-for-byte.
The container limits mean absolute fixture timings are not native-host timings.
Additional cache-invalidation and native-boundary checks remain necessary.

A genuine native notch before the cache fix moved from 0 to -60 pixels,
with fractional positions including -5.85,
-13.183334,
and -48.442593.
At the materialization boundary,
a state request took 367.79 ms and the next observed position jumped to -60.
Evidence:
`/tmp/monochromatic-ide-native-8CCvg2/wheel-before.json`.
Native `Flickable` easing exists,
but the synchronous source raster interrupted it.
After rebuilding,
`/tmp/monochromatic-ide-native-S6Y37Y/wheel-after.json` shows continued fractional motion through that boundary,
including -49.020374,
-57.600006,
and -59.814823.
The boundary request took 32.52 ms in this debug build,
not the previous 367.79 ms.
Steady repeated Home requests after caret-image reuse took 1.68 to 2.95 ms.
This is evidence of the corrected redraw path,
not a claim of guaranteed frame pacing or whole-application acceptance.

MCP `scroll_element` sends `TouchPhase::Cancelled`,
which exercises immediate scrolling and is not a notched-wheel test.
The repo compositor now supports
`wheel X Y HORIZONTAL_NOTCHES VERTICAL_NOTCHES`,
using `AxisSource::Wheel`,
v120 notch units,
and ordinary axis deltas.
See [the scroll investigation][scroll].

## Syntax and font-fidelity additions

`src/bin/ide-runtime.rs` and the `runtime` task own build-only grammar provisioning.
They reuse pinned Helix fetching/building,
with private configuration under `target`.
The initial slice contains Rust,
TypeScript,
TSX,
JavaScript,
and JSDoc grammars;
full measured-inventory coverage remains pending.
Queries come from the pinned Cargo checkout,
and each grammar's license is copied into the runtime.
Assets are published beside debug/release binaries.
The asset directory measured 5,655,910 bytes at this checkpoint.

The terminal base image lacked `c++`,
which Helix's grammar manager requests even for C parsers.
`package/desktop-app/ide/Containerfile` now extends that image with `gcc-c++`;
tasks use `localhost/monochromatic/ide` with the same resource bounds.
The `runtime` task and actual parser tests pass.

`src/syntax.rs` uses Helix filename/shebang recognition and tree-house offsets,
converting byte ranges to source-character ranges.
Adjacent equal paint intervals are merged;
Rust comments arrived as adjacent `//` and ` 猫` captures rather than a single span.
`HighlighterError` implements Display but not std::error::Error;
`src/syntax_error.rs` supplies explicit operation-specific diagnostics.
Syntax failures retain readable text rather than pretending an installed language is unrecognized.
The worker computes initial and changed-source syntax and tags it with its target revision.
Native application rejects stale syntax,
and immutable `SourceStyles` prevent copying all spans during caret-only updates.

The dark syntax screenshot was inspected at
`/tmp/monochromatic-ide-native-KA8eTH/syntax-dark.png`.
It shows real grammar classifications,
not fixed example colors.

The user explicitly requested correct ligatures and other JetBrains Mono/Inter font behavior.
The source now explicitly enables JetBrains Mono's `calt` feature.
Real on/off glyph controls,
slashed-zero substitution,
and ligature-interior caret/hit/copy checks pass.
A committed regression exposed wrong selection ink inside the middle character of `===`.
`src/selection_paint.rs` now clips foreground against the same rectangles used for native backgrounds,
without reshaping or breaking the ligature.
Fractional DPI/origin and opacity controls pass.

Inter tests verify kerning against an off control (106.35498 versus 112.976074 pixels),
real 400/600 face bytes,
and tabular/proportional figures through the same Parley/fontique stack Slint uses.
The user rejected the static subset and explicitly requested variable fonts and real italics.
On 2026-10-04,
`Inter-Regular.ttf`/`Inter-SemiBold.ttf` were replaced by `InterVariable.ttf`/`InterVariable-Italic.ttf`,
and `JetBrainsMono-Regular.ttf` by `JetBrainsMono-Variable.ttf`/`JetBrainsMono-VariableItalic.ttf`.
The original filesystem names for the latter pair are recorded in the font README;
font bytes and internal names are unchanged.
JetBrains Mono advertises wght 100 to 800;
Inter advertises wght 100 to 900 and opsz 14 to 32.
Both families have separate real italic faces.

`font_asset.rs` shares stable source-font blob identities.
`SourceTypography` validates variable weights and chooses real italic faces.
Tests verify intermediate weights,
exact font bytes,
no synthetic emboldening/skew,
variation-aware glyph caching with the same blob ID,
and italic ligature caret/copy behavior.
Inter tests verify explicit optical sizes 14 and 32.
The toolkit's ordinary UI request still leaves opsz at 14;
automatic optical sizing is not claimed.
Optional stylistic alternates remain upstream defaults and no settings panel was added.
`asset/font/README.md` records the measured feature boundary.

`ui/app.slint` now tracks a physical pixel converted to logical length,
so an idle display-scale change invalidates source rasterization.
`src/native/tests.rs` drives actual Slint window events through the headless backend.
`test:native` and the markup check pass after the observed-failing DPI test.

## Latest clipboard and interface verification

The user explicitly authorized adding clipboard support to the nested compositor.
`src/handler/clipboard.rs` registers wlr-data-control and ext-data-control against the nested seat.
`src/child.rs` removes `DISPLAY` and `XAUTHORITY` so toolkit fallback cannot reach host X11.
The new isolation test was observed failing before the fix and passing afterward.
`inspect:clipboard` passed text and binary transfer,
selection clearing,
and clean producer shutdown.
See [the clipboard investigation][clipboard].

The latest complete IDE suite passes 49 tests after the expanded font checks;
the native headless DPI test also passes.
A new five-case workspace-model test file was added afterward and is running.
The headless native DPI regression was observed failing (1300-pixel bitmap retained instead of 2600),
then passed after adding physical-pixel scale invalidation.
It checks scale factors 2,
1.25,
and back to 1 without source input or resize.
The Slint markup check and native build pass.
IDE Clippy,
Rust documentation/line budgets,
and Slint markup checks now pass.
`native.rs` uses Slint's supported procedural-macro re-export of `ui/app.slint`,
retaining generated-code provenance rather than suppressing shadow lints.
The earlier generated-module implicit-return allowance was removed.
`build.rs` explicitly supplies `SLINT_EMBED_RESOURCES=true` to that macro and retains standalone markup validation.
Native font-isolation verification should be repeated for this integration change.

The minimal dark UI screenshot at
`/tmp/monochromatic-ide-native-8rNGro/minimal-dark.png`
was inspected.
MCP confirms no Button role,
read-only badge,
or debug footer in the complete element tree.
Copy is keyboard-only.
Only the file context and source remain visible in the normal source-view gate.

## Active probes at this checkpoint

Every managed process exited before this handoff;
none is running,
so no MCP port or nested Wayland socket is bound.

- Search backend and transient native overlay are implemented.
  `src/native/navigation/search/` binds double-Shift,
  150ms debounce,
  scope capture,
  independent errors,
  `%` filtering,
  close cancellation,
  and safe result opening.
  `navigation/line.rs` maps a content result's one-based line to canonical source characters.
  It retains the current document identity for a same-file hit.
  `search_worker.rs` keeps one latest request/reply,
  cancels superseded queries,
  and joins its owned thread after child cleanup.
  `search_process.rs` runs filename/content ripgrep streams concurrently,
  disables inherited configuration and preprocessing,
  and reaps children after cancellation or result caps.
- `proc_ea69` passed real subprocess tests,
  protocol tests,
  bounded output tests,
  and scoped Rust lint.
  Quiet-child cancellation verifies the owned PID is gone;
  a preprocessing-config positive control verifies `--no-config` separately from environment removal.
  Invalid regexes and oversized records retain the other stream's filename results.
- Search output records are capped at 4 MiB before parsing;
  diagnostic storage is capped at 64 KiB while still draining stderr.
  Previews retain at most 300 complete graphemes.
  Native filenames use NUL-delimited records or decoded base64 JSON paths.
- The bounded IDE image lacked `rg` and was updated to include it.
  Its verified runtime is ripgrep 14.1.1;
  the host is 15.2.0.
  Existing base64 0.23.1 is now an explicit dependency;
  the generated lockfile added only that direct dependency edge.
- Fresh UI-reference reads found required parity details:
  double-Shift release within 400ms opens the modal;
  non-Shift keypresses interrupt the chord;
  query debounce is 150ms;
  leading `%` selects content-only presentation;
  input is trimmed;
  Up/Down selection wraps.
  Search scope is the last-focused tree directory,
  or the parent of its focused file,
  falling back to the project root.
  The worker now validates per-request directory scopes on its background thread.
  Scope success/escape/file/missing/recovery tests pass;
  canonical checking remains vulnerable to filesystem races and is not OS confinement.
- Installed Slint FocusScope supports `capture-key-pressed` and `capture-key-released`.
  The overlay uses those for global shortcut observation.
  Headless tests and real nested-seat double-Shift both exercise them.
  Search uses the supported `search` accessibility role;
  `dialog` is rejected by Slint 1.18.1.
  `inspect:search-accessibility` retains positive and negative controls.

- Final native smoke `proc_4e47` is at port 9318,
  socket `/tmp/monochromatic-ide-native-EGMdAC/control.sock`.
  `interaction.mjs`,
  `focus-reveal.mjs`,
  and `windowed-click.mjs` all pass against the final pointer guard.
  The dark off-screen-reveal screenshot was inspected.
- `proc_fe92` passed final formatting,
  the full 91-test library/integration suite,
  all ten native tests,
  and package lint.
- Search work is starting from fresh reference reads of
  `package-paused/desktop-daemon/editord/src/server/operations/search.ts`
  and `stream-rg.ts`.
  Path results use smart-case substring matching with a cap of 20;
  content results use smart-case regex matching with a cap of 30 and one matching line per file.
  The path stream and content stream run concurrently,
  with path results presented first.
  The host has ripgrep 15.2.0;
  the container runtime probe is next.
  Use NUL-delimited filename records and `--no-config` rather than inheriting arbitrary ripgrep configuration.
  Ripgrep's current help confirms `--max-columns` does not limit JSON output,
  so JSON record/preview handling still needs a bounded design.

- `proc_fe92`,
  `ide-tree-final-format-verification`,
  runs formatting,
  the full library/integration suite,
  native tests,
  and package lint after the final tree-windowing and pointer-identity changes.
- `proc_81e8` stopped cleanly after the light-mode native proofs.
  No current native probe should be assumed running;
  check the process list before starting the final smoke check.

- `proc_81e8`,
  `ide-fixed-row-tree-native-proof`,
  was the completed light-mode probe at port 9319,
  socket `/tmp/monochromatic-ide-native-D6RbFJ/control.sock`.
  Its `interaction.mjs`,
  `focus-reveal.mjs`,
  and `windowed-click.mjs` pass genuine seat input and independent clipboard reads.
  `tree-offscreen-reveal-light.png` was inspected.
  This process predates the final pressed-row/model click guard;
  restart before that guard's final native smoke check.
- Slint ListView's large-jump branch discarded the within-row offset:
  row 43 had bottom 672px in a 628px viewport.
  The native regression failed in `proc_88bc`.
  The tree now uses native `ScrollView` with bounded fixed-row windowing,
  retaining exact offsets and native scrolling physics.
  The corresponding viewport test passed in `proc_d499`.
- Windowed row reuse exposed a genuine pointer-release identity regression in `proc_6bed`.
  The input item now remembers the pressed row index and model identity;
  stale releases do not activate a different row.
  All ten native tests passed in `proc_1d2a`.
- The upstream layout investigation,
  runnable isolated harness,
  tested prototype patch,
  and additive comment draft are in
  `doc/troubleshooting/slint-listview-random-seek-offset.md` and its sidecars.
  No upstream message was posted and no dependency was patched.
  Original-source controls failed in `proc_2f24`;
  the completed prototype passed five control groups in `proc_3830`.
- `proc_2879` passed observed-failing identity,
  directory admission,
  source-open ordering,
  and runtime build-boundary guard controls in the disposable copy at
  `/home/user/temp/agent/ide-tree-guard-zlIbRv/package`.
  Every baseline passed,
  removing each guard caused its named assertion to fail,
  and restoring it passed again.
  Evidence is `navigation-results.json` beside that copy.
  This completes the previously outstanding runtime-helper guard-removal probe.
- `proc_1542` passed 91 library/integration tests and the complete package lint before the final windowing changes.

- `proc_3806`,
  `ide-native-tree-seat-controls`,
  serves MCP at port 9318 and control socket
  `/tmp/monochromatic-ide-native-bOrX20/control.sock`.
  Its binary predates the latest reveal-liveness,
  reader-disconnection,
  initial-directory diagnostic,
  and Tab changes;
  restart before their physical-input verification.
- `interaction.mjs` in that directory passes entirely through native seat modifiers and key events:
  mouse file opens,
  arrow/Enter tree navigation,
  Ctrl+1 alternation,
  Ctrl+0 ancestor reveal,
  failed-open retention,
  ignored typing,
  and `am a` to `was a` selection correspondence after switching files.
  Independent `wl-paste` reads the isolated clipboard.
  `tree-selection-reload.png` was inspected.
- `edge-probe.mjs` passes ignored native paste,
  outside-symlink rejection,
  external tree removal/recreation,
  root-unavailable source retention and recovery,
  and tree Home/End/PageUp/PageDown/Space controls.
  `tree-root-unavailable.png` was inspected.
- An initial probe mixed MCP modifier injection with native seat arrow events and failed its selection-copy assertion.
  It is not selection-regression evidence:
  the replacement probe keeps the entire chord on the native seat and passes.
- The nested helper now accepts `ctrl`,
  `shift`,
  `alt`,
  and `meta` key names.
  Its modifier test failed with `None` versus `Some(29)` before implementation;
  `proc_9075` then passed all 42 helper tests,
  Clippy,
  and the release build.
- Advisor raised unmatched reveal and stopped-reader liveness risks.
  `missing_reveal_keeps_the_existing_model_until_tree_changes` failed before the fix in `proc_bbf5`.
  The native code now waits for actual directory changes rather than rebuilding an identical tree every 20ms.
  A positive model-identity control proves the assertion detects real replacements.
- The proposed contained-alias defect was not reproduced:
  the canonical target row is selected and badged,
  reopening its alias preserves selection/generation,
  and model identity stays stable.
  The test passed both before and after the liveness fix.
  Canonical aliases intentionally share one history identity.
- Reader/opener disconnect tests failed before state cleanup in `proc_f52d`.
  `proc_9d01` passed after clearing the reader's busy/sender state and the opener's waiting target.
  `proc_ee8d` passed native review regressions,
  including accurate first-listing failure text and recovery,
  plus scoped Rust lint.

- `proc_ba75`,
  `ide-native-navigation-consumer-tests`,
  runs the real window callbacks for file switching,
  Ctrl+0 reading-state preservation,
  Ctrl+1 alternation,
  ancestor reveal,
  and failed-open retention through external refresh.
- `proc_d93e` passed the background file-opening tests.
- `proc_ead2` passed CLI parsing,
  real executable help/version/usage exits,
  and scoped Rust lint.
  Startup is now `monochromatic-ide PROJECT [--file FILE]`;
  native inspection tasks pass an explicit disposable project.
- `proc_247b` passed the full pre-opener suite and package lint after directory-reader integration.

- `proc_0d4b` passed the full library/integration suite after variable-font replacement,
  then exposed owned-name comparison lint findings in the new workspace tests.
  Those findings were fixed.
  `proc_e7bd` subsequently passed Clippy,
  Rust documentation/line budgets,
  and the native build.
- `proc_60a7` passed all three native tests,
  Rust documentation/line budgets,
  and Clippy after adding actual source-image typography/selection coverage.
  Native widget pixel comparisons cover request repainting and fallback distinction,
  not direct selected-font-byte introspection.
  The normal source surface remains roman 400 with color-only syntax spans.
- `proc_8ed6` passed both native headless tests under nextest:
  idle DPI changes and real widget variable-weight/italic pixel changes.
  Plain cargo test initially failed because Slint's global platform was initialized on another test thread;
  native tests now use process isolation.
- `proc_e46e`,
  `ide-variable-native-isolation`,
  stopped cleanly after variable-font verification.
  Its completed dark fixture was at
  `/tmp/monochromatic-ide-native-m6zNtt/control.sock`.
  MCP is port 9318.
  All four complete variable/italic font byte sequences were found in the binary.
  Isolated fontconfig resolves Inter Variable and JetBrains Mono to Adwaita Mono externally.
  The native middle-character ligature copy and screenshot probe passes;
  `/tmp/monochromatic-ide-native-m6zNtt/ligature-dark.png` was inspected.
- `proc_ed8c` is stopped after the pre-variable macro-path verification.

- `proc_f89f`,
  `ide-workspace-model-tests`,
  runs the IDE suite with new read-only workspace tests.
- `proc_e9fe`,
  `ide-font-cold-start`,
  is the current dark/syntax probe.
  Socket:
  `/tmp/monochromatic-ide-native-46wFSY/control.sock`.
  MCP:
  `http://127.0.0.1:9318/mcp`.
  It predates the procedural-macro integration change.
  Its font probe copied the middle `=` of `===` and its dark screenshot was inspected.

- `proc_75d5` (stopped),
  `ide-light-font-native`,
  verified the light/syntax fixture with ligature and DPI fixes.
  `/tmp/monochromatic-ide-native-SjCyvc/font-probe.mjs` copied exactly `=` from the middle of `===`.
  Selection was at x=236,
  y=32,
  with width 9.
  `ligature-light.png` in that directory was inspected.
- `proc_2d43`,
  `ide-inter-default-features`,
  passed the expanded font tests including Inter calt/dlig defaults.

- `proc_1614` (stopped),
  `ide-live-reload-native-retry`,
  was the verified dark/scroll fixture with live refresh.
  Socket:
  `/tmp/monochromatic-ide-native-zCPqiB/control.sock`.
  MCP:
  `http://127.0.0.1:9318/mcp`.
- `proc_4ae9` exited before spawning the IDE:
  private D-Bus startup timed out.
  The unchanged retry started successfully;
  no root cause or fix is established for that separate fixture-startup incident.
- `proc_b0cc` (stopped),
  `ide-minimal-clipboard-native`,
  is stopped after verifying the dark/basic fixture with the simplified UI and rebuilt clipboard-capable compositor.
  MCP is `http://127.0.0.1:9318/mcp`.
  Socket:
  `/tmp/monochromatic-ide-native-8rNGro/control.sock`.
  Consumer probe:
  `/tmp/monochromatic-ide-native-8rNGro/clipboard-probe.mjs`.
- `proc_f5f1` (stopped),
  `ide-native-wheel-probe`,
  runs the pre-cache source renderer with the rebuilt compositor.
  MCP is `http://127.0.0.1:9318/mcp`.
  Socket:
  `/tmp/monochromatic-ide-native-8CCvg2/control.sock`.
  Source:
  `/tmp/monochromatic-ide-native-8CCvg2/fixture.ts`.
  This historical baseline process is stopped.
- `proc_ea50`,
  `ide-caret-reuse-tests-build`,
  runs scoped tests then the native build.
  It completed successfully.
- `proc_37fc` and `proc_7948` are stopped.
  Their original source-view handles and binaries are obsolete.

Rediscover windows and elements after every restart.
JSON-RPC `tools/call` accepts loopback POST with
`Content-Type: application/json` and `Accept: application/json, text/event-stream`.
Tool JSON is inside `result.content[].text`.
`list_windows` returns `windowHandles`,
not `windows`.
Use `find_elements_by_id` for `AppWindow::scroll`.
Element and window handles are distinct even when their shapes coincide.
Read current `tools/list` schemas before driving input.

## Build and runtime evidence

All Cargo tasks run through package `mise.toml` in the IDE image extending the terminal build image,
with 2 GiB RAM,
2 CPUs,
512 processes,
4096 file descriptors,
and two Cargo jobs.
Only the package and dedicated Cargo volume are mounted.
Slint resolves to 1.18.1.
Its installed source is under
`~/.local/share/containers/storage/volumes/ide-cargo/_data/registry/src/`.

Root `file-enforcer.config.ts` owns the unconditional Slint dependency.
`gui = []` gates generated UI code,
not optional dependency membership.
Reintroducing `dep:slint` would reproduce Cargo's
`feature gui includes dep:slint, but slint is not an optional dependency`.
Native key comparisons use `SharedString::from(Key::...)`.
Current Slint markup uses `content-width`,
`content-height`,
and `content-y` rather than deprecated `viewport-*` names.

Font provenance,
checksums,
and original OFL licenses live in `asset/font/README.md` and adjacent license files.
Selected releases are Inter v4.1 and JetBrains Mono v2.304.
Native fontconfig resolves both absent primary families to Adwaita Mono externally,
while the app retains its embedded faces.

Read [the private theme-portal investigation][theme].
The compositor supports startup `--color-scheme dark|light` on a private D-Bus session,
and since 2026-10-05 the runtime control command `color-scheme dark|light`.
The IDE's reaction to a live switch is not yet verified.

## Helix and behavioral references

Pinned Helix revision:
`ba40e547426b0f9896c8bdc699a4ab11f2b37dbc`.
Source clone:
`~/temp/agent/slint-ide-languages.mEr8K9/helix`.
All selected Helix crates use that same revision.
Relevant inspected APIs include `compare_ropes`,
`ChangeSet::map_pos`,
`syntax::Loader`,
`Syntax`,
`TextAnnotations`,
and `helix-lsp::Client`/`Registry`.
The installed tree-house highlighter uses event offsets,
not the older start/end/source iterator shape.

`helix-loader::config::default_lang_config()` supplies the registry.
Grammar fetching/building exists in `helix-loader::grammar`,
and the initial Rust/TypeScript/TSX/JavaScript/JSDoc runtime slice is provisioned.
The remaining measured-language inventory still needs build/runtime coverage.
Respect each server's text synchronization mode.
The measured inventory includes TS/JS,
Rust,
Kotlin,
Slint,
QML,
HCL,
SQL,
shell,
C/C++,
Batch,
and configuration/markup families.
Inspected SQL,
XML/SVG,
and Batch entries have grammars but no configured LSP.

Installed `hx` reports `25.07.1 (a05c151b)`.
`hx --health typescript` found parser/query assets and typescript-language-server 6.0.0.
A fresh `hx --health` probe found the installed runtime at `/usr/lib64/helix/runtime`.
Its other reported candidates,
`~/.config/helix/runtime` and `/usr/bin/runtime`,
were absent.
Installed assets are not assumed compatible with the pinned Helix revision.

Editord reference:
`package-paused/desktop-daemon/editord`.
Recency behavior is in `src/client/recent-files.ts`,
`src/client/app/app.ts`,
and `src/client/file-tree/reveal.ts`.
The paused browser/WebSocket daemon architecture is not being revived.

## Workspace model and remaining verification details

`src/workspace.rs` opens one canonical local root,
resolves tree/search paths against it,
and returns fresh directory snapshots in filesystem order.
It preserves hidden entries and native filenames.
`tests/workspace.rs` covers normal listings,
refresh,
contained paths,
sibling-prefix/parent escapes,
symlinks,
and invalid directory inputs.
`src/file_tree.rs` and its `listing`/`rows` helpers now own lazy expansion,
visible snapshot order,
and detached-subtree pruning without filesystem I/O.
Collapsing a parent retains descendant expansion but suppresses hidden loading requests.
Directory-to-file replacement discards obsolete child caches.
Atomic snapshot validation rejects traversal-like names,
duplicate keys,
and mismatched paths;
native byte filenames remain intact.
`test:tree` passes eight cases;
Clippy,
Rust documentation/line budgets,
and Slint checks pass in `proc_1f80`.
`DirectoryRequest` now carries a private shared allocation identity across threads,
not a reusable integer or just path equality.
Superseded,
consumed,
foreign-tree,
and removed/recreated-directory replies are ignored before applying either data or errors.
A current read error releases its request slot while preserving the previous snapshot.
Asynchronous callers must use `complete_listing` rather than the synchronous `apply_listing` entry point.
`DirectoryWorker` admits at most one read or unread reply,
never blocks UI polling,
and closes input before joining its thread on shutdown.
The native tree now uses `ui/tree.slint` plus `src/native/navigation/` bindings.
Its header shows the distinguishing project name;
the full root remains available through accessibility.
It retains native paths behind lossy display labels,
shows recent-file slot badges,
and expands/reveals ancestors after successful opens.
Rows have 48px minimum dimensions;
expanded folders use both arrow direction and font weight,
and the displayed file uses selection background and weight.
Since 2026-10-05 the sidebar starts at 256px and resizes through a 48px divider cell;
the "Completed in this fan-out" list records it.

`FileOpener` reuses `ReloadWorker` for project-relative resolution,
read/diff,
and syntax on its reader thread.
Only the latest requested open can install a document;
failed opens retain the old source and do not promote history.
The ordinary displayed-file refresh worker continues independently.
`navigation_error` remains separate from `file_error`,
so successful refresh of the old file cannot erase an unrelated failed-open diagnostic.

Directory refresh currently round-robins visible expanded folders at 500ms intervals,
with missing lazy snapshots taking priority.
This is polling,
not filesystem watcher integration;
refresh latency grows with the number of expanded directories.
No event-driven latency guarantee is claimed.
Collapsing a folder dismisses its folder-scoped diagnostic;
re-expansion requests it again.
Canonical inside symlink aliases select and badge the real target row rather than creating duplicate history slots.
Successful file opens focus the source view;
Tab traversal back to the tree and Shift+Tab back to source pass with native seat input.
Both readers close their input and join on shutdown;
a filesystem operation that never returns can therefore delay shutdown.
Cancellation invalidates replies,
not a running operating-system file read.

Observed-failing guard checks passed in `proc_1d30`:
removing snapshot validation,
unknown-directory rejection,
and non-directory expansion rejection each caused its named test to fail.
Restoring all guards returned the eight-test suite to passing.
The evidence is `results.json` beside the disposable copy.
The disposable copy is `/home/user/temp/agent/ide-tree-guard-zlIbRv/package`;
its baseline passed eight tests in `proc_5274`.
`guard-check.mjs` outside that copy removes guards one at a time,
checks named failures,
restores the files,
and reruns the suite.
All Cargo work remains bounded by the copied package's container task.
Canonical path checks do not claim race-proof OS-level read confinement;
server project-write confinement remains a separate required gate.

Reference search behavior was re-read:
editord returns up to 20 smart-case substring file-path matches before up to 30 regex content matches,
one content line per file,
using concurrent ripgrep processes and cancellation.
Its tree preserves readdir order and does not turn directory symlinks into expandable directories.
Its CSS uses tab-size 2;
the current source projection still expands tabs using a four-column terminal-width calculation.
Tab-width parity and mixed-script physical tab geometry are outstanding findings,
not verified font behavior.

The runtime helper's configuration-boundary guard was removed only in the disposable copy.
`runtime_rejects_non_build_configuration_before_writing` failed,
then passed again after restoration.
No real user configuration was touched.

The compositor protocol-delivery regression failed with an unflushed sync reply,
then passed after end-of-dispatch flushing.
Its full 41-test suite,
Clippy,
and release build pass.
The rebuilt helper cold-started the native dark font probe successfully.
The earlier light-startup stall recovered before the fix,
so its exact trigger remains unproven.
See `doc/troubleshooting/nested-wayland-protocol-delivery.md`.

## Repository safety and policy proposals

Scope every commit to task files and preserve concurrent work.
Auto-push is enabled.
Generated GPL/LGPL texts under `package/desktop-app/ide/LICENSES/` are now committed unchanged.
Current unrelated linter work is concurrent work,
not something to revert.

Recent task commits:
`4af24d5c7` adds the raster probe;
`6385c1fe1` adds bounded glyph images;
`205ff25ea` splits native boundaries;
`d4e4b3973` adds caret-only image reuse.
Inspect current Git status and process state rather than assuming this snapshot is live.

Policy proposals were resolved on 2026-10-05.
The user declined a CLI `--help` rule,
a font-verification rule,
and a reference-parity rule,
and approved two rules:
`QRX` in `AGENTS.md`
(batch decisions in the question tool and re-explain each item's context in plain words)
and `QVS` in the visual-design-review skill
(show built screenshots of every option as committed local files before asking).
The `PXQ` checkpoint-continuation idea was not re-proposed;
`PXQ` already forbids ending a turn on a status report the user must answer with "continue".

[scope]: ../decision/slint-ide-0x-scope.md
[plan]: ../planning/slint-ide-implementation.md
[theme]: ../troubleshooting/slint-nested-color-scheme-portal.md
[scroll]: ../troubleshooting/slint-flickable-smooth-scroll.md
[clipboard]: ../troubleshooting/slint-nested-clipboard.md
