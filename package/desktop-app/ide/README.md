# Read-only Slint IDE

Implementation in progress.
The accepted [0.x scope][scope] and [build approach][plan] define the completion criteria.
This package is not yet a completed application.
Use the [handover][handover] for current verification,
running-process details,
and the next implementation action.

## Implementation queue

- [ ] Complete the source view:
  shaped selection/copy,
  initial real syntax,
  font fidelity,
  and native external-change correspondence pass;
  annotations and remaining keyboard navigation are pending.
- [x] Native tree,
  asynchronous file switching,
  and recent-file reveal.
  Sidebar resizing and event-driven directory invalidation remain parity work.
- [x] Combined path/content search.
- [ ] In-file find.
- [ ] Required language-intelligence feature paths.
- [ ] Measured Helix-supported language inventory and private server state.
- [ ] Native interaction tests and behavior-difference documentation.

## Project startup

Run `monochromatic-ide PROJECT` for one explicit local root,
or `monochromatic-ide PROJECT --file FILE` to initially display a file inside it.
Relative `FILE` paths start at `PROJECT`,
not the shell's working directory.
`--help` and `--version` exit before filesystem or native-display startup.
The executable no longer substitutes example source when no file is selected.

Native tree and file switching pass callback tests and real nested Wayland input checks.
Long-distance reveal uses fixed-row windowing over native `ScrollView`;
see the [ListView investigation][listview].
Directory reads and later source opens run in bounded background workers.
Failed opens retain the displayed source and do not enter recent-file history.
Ctrl+0 through Ctrl+9 use session-local promotion and ancestor reveal.

[listview]: ../../../doc/troubleshooting/slint-listview-random-seek-offset.md

## Combined search

Double-Shift opens transient search.
Filename matches precede content matches;
prefix the input with `%` to show only content results.
Up/Down wrap the selected result,
Enter or a click opens it,
and Escape or an outside click closes the overlay.
Content results navigate to their matching source line.
The scope is the last-focused tree directory or a focused file's parent,
falling back to the project root.

Input changes cancel old work immediately and debounce the next search by 150 ms.
The worker runs filename and content searches concurrently through ripgrep.
It retains at most 20 filename matches and 30 content matches,
with at most one matching line per file.
Filename matching is smart-case literal substring;
content matching is smart-case regular expression.
A content-search failure does not discard usable filename results.

Record and retained-diagnostic bounds limit memory,
not total bytes scanned or query duration.
The application kills and reaps cancelled search children;
inherited ripgrep configuration,
preprocessors,
and archive decompression are disabled.
Canonical scope validation is not an OS-enforced filesystem sandbox.
Native dark/light input and clipboard probes verify result opening and content-line navigation.
Headless tests cover late replies, close cancellation, pending-open focus, and result-model pointer lifetime.
In-file find is not implemented yet.

## Fonts and appearance

Official variable roman and real italic fonts for JetBrains Mono and Inter are bundled under `asset/font`
with their original OFL notices.
The Slint compiler is configured to embed imported font bytes.
The UI binds to the system palette.
Native dark/light rendering and font isolation are verified.
Programming ligatures retain per-character caret,
selection,
and copy behavior.
Inter's default kerning,
continuous weights,
optical-size controls,
and real italic selection are covered by font-stack tests.
Native widget snapshots also verify intermediate weights and italic cache invalidation.
Inter's normal Slint UI request currently retains the optical-axis default,
not automatic optical sizing.
Idle DPI changes are covered by a native headless window-event regression.
Live system-theme change and physical-output scale migration remain to be verified.

## Current reader behavior

Copy selected source with Ctrl+C.
There is no read-only badge,
Copy button,
or permanent diagnostic footer.
Source positions,
painting,
and selection share native shaped-row geometry.

The displayed file is reread by a bounded background worker at 250 ms intervals.
External changes map the latest caret,
selection,
and viewport through Helix correspondence,
even while text remains selected.
Read failures retain the last readable source and show a diagnostic until recovery.
The concrete caret and replacement-selection cases in the accepted scope pass through the native GUI.
This polling boundary is not yet a workspace tree watcher or language-server synchronization loop.

## Build boundary

Application builds and tests run in the IDE container extending the repository's native-app image,
with 2 GiB RAM,
2 CPUs,
a 512-process limit,
and a 4096-descriptor limit.
The container receives this package and a dedicated Cargo cache,
not the user's home or credentials.
The source documentation/line-budget task invokes the repository's Rust linter separately.

The `runtime` task prepares the pinned Rust/TypeScript/TSX/JavaScript/JSDoc grammar slice,
matching query assets,
and license notices beside built binaries.
It is a build-only operation,
not an application-triggered downloader.
Full measured-language coverage remains in the queue.

Helix crates share a pinned upstream revision.
Helix code and runtime assets retain their own license obligations;
the application does not inherit Helix's modal commands or editing features.

[handover]: ../../../doc/handover/slint-ide-0x.md
[scope]: ../../../doc/decision/slint-ide-0x-scope.md
[plan]: ../../../doc/planning/slint-ide-implementation.md
