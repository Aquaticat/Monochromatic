# WebStorm comparison and the decision to keep editord

Status: decided, not deprecated
Date: 2026-05-25

editord was started because WebStorm scrolled badly.
On 2026-05-25, adding `-Dsun.java2d.vulkan=true` to WebStorm's custom VM options closed that gap:
WebStorm 2026.2 now scrolls comparably to editord.
This document records what that prompted (whether to deprecate editord),
the findings behind the answer, and the answer itself.

## Decision

Keep editord. Do not deprecate.

The original reason to build it (smooth scrolling) is gone,
but a structurally stronger reason replaced it:
editord is correct by construction on a class of WebStorm defects that JetBrains has declined to fix,
because those defects are the cost of an architecture editord deliberately does not share.
The keep is conditional on the fuzzing work described under "The condition" below;
fuzzing is what converts editord's freshness from an architectural claim into a verified one.

## Context: why the question arose

The motivation sections of [README.md](../../README.md) and [PHILOSOPHY.md](../../PHILOSOPHY.md)
both name smooth scrolling as the entire architectural point:
raw `contenteditable` delegates scrolling to the browser compositor thread,
which is why editord refuses any editor framework (CodeMirror, Monaco) that reimplements scrolling in JS.
Once WebStorm scrolls smoothly, that single differentiator no longer distinguishes editord,
and everything else editord does is explicitly WebStorm parity ("JetBrains is the reference implementation").
A 16k-line reimplementation of an IDE that already meets the one bar it was built to clear is a deprecation candidate.

## Finding 1: the original motivation is gone, and its replacement matters more

Smooth scrolling is now matched.
The first-person assessment from the person who built editord because of the scroll gap
is the most calibrated verdict available on that comparison, and it is "feels as good as ours".

The flag carrying it is a preview, not a stable default.
`sun.java2d.vulkan` is tracked as a preview in [JBR-7558] with open defects:
wrong rendering with Vulkan plus WLToolkit in 2025.2 ([IJPL-202302]),
and degraded performance under fractional scaling ([JBR-9951]).
Several are Wayland-specific, and this machine runs Fedora 44 (Wayland by default),
so anyone relying on the flag should confirm it survives a JBR upgrade and holds under their own scaling setup.

This finding does not by itself justify keeping editord.
A differentiator that a vendor erased with one runtime flag is exactly the kind that gets erased;
the durable case is the next finding.

## Finding 2: the durable advantage is file-tree freshness

WebStorm's project tree shows stale state.
This is documented expected behavior, not an incidental bug.

- WebStorm maintains a whole-project virtual file system snapshot.
  The IntelliJ Platform [VFS documentation][vfs-docs] states all access goes through the snapshot
  to avoid constant disk I/O, that the snapshot "may not always match the disk's actual contents"
  ("deleted files can still be visible in the UI for some time"),
  and that a refresh "walks through all directories and files in the refresh scope".
- The staleness is WONTFIX by design.
  On [IDEA-168617], JetBrains states there are no plans to sync external changes eagerly,
  because the IDE "may freeze in unpredictable moments" doing so on large projects.
  The drift is the price of a snapshot that scales.
- It is long-standing.
  [IDEA-121164] (project tree not refreshing on branch switch) carries a 2014-era issue number.
- There is a timestamp gap on top:
  if a file's contents change but its mtime does not, the platform does not pick up the new contents.

editord has no snapshot to drift.
`src/server/operations/watch-filesystem.ts` runs one `chokidar` watcher per expanded directory at `depth: 0`,
with `atomic: true` and `awaitWriteFinish` 150 ms,
and pushes `add`/`change`/`unlink` events straight from the inode layer.
`src/server/operations/watch-filesystem-filter.ts` ignores `.git` and `node_modules` at the watcher level.
The tree is a direct projection of live filesystem events;
there is no authoritative cache that can disagree with disk,
so there is no "Reload from disk" action and no mtime-equal corruption window.

The honest size of the claim: WebStorm is not blind to disk (it runs a native `fsnotifier` watcher).
The difference is the layer above the watcher:
WebStorm feeds events into a cached, timestamp-based snapshot that drifts;
editord feeds them straight to the tree.
The `File > Reload all from disk` menu item is the vendor's own admission of drift.

## Finding 3: "monorepo scale" is the wrong frame

An earlier framing of this comparison claimed WebStorm's snapshot exists to "open monorepos"
and that editord scoped out that scale.
That is wrong, and worth recording so it is not repeated.
Both tools open this monorepo fine.
The difference is not opening a large tree; it is keeping a whole-project model synced with one.

Measured against this repository on 2026-05-25:

- 104,632 files on disk, of which 5,011 are git-tracked source.
  The gap is overwhelmingly the 1.6 GB of `node_modules` (84 directories) that editord's watcher ignores outright.
- 101 workspace packages; 68 MB `.git`.
- 5,209 source directories total.
  If every one were expanded at once (which never happens in normal use),
  editord would hold 5,209 inotify watches against a budget of 524,288 on this machine, roughly 1 percent.
  The lazy per-directory watch model has two orders of magnitude of headroom at this scale.

editord works on a 104k-file monorepo because it never builds a 104k-file snapshot:
it materializes only the directories that are expanded,
and delegates project-wide concerns elsewhere (see Finding 4).
The freshness advantage and the monorepo-friendliness are the same decision, not two.

## Finding 4: the stale tree and the diagnostics delay share one root

The sharp version of "JetBrains solves problems at the wrong layers" is layer-collapse.
IntelliJ fuses three concerns into one IDE-owned subsystem:
file state (an operating-system concern), semantic intelligence (a language-server concern),
and text search (a separate-tool concern).
Because file state is coupled to the index and refresh machinery,
the platform cannot refresh file state eagerly without risking an index-refresh freeze, so it defers both.

Two visible bugs fall out of that one coupling:

- The stale tree (Finding 2): the snapshot refresh is deferred, so the tree lags disk.
- Delayed diagnostics: inspections are computed against the same deferred index, so they lag too.
  Verified as a current class: [IJPL-28967] ("Inspections do not re-evaluate/refresh during editing"),
  [WI-77076] ("Live inspection not updating to reflect code changes some times", WebStorm tracker),
  [WEB-40610] ("Inspections and syntax analysis very slow"),
  with the documented pattern of warnings freezing until the block is re-edited or the IDE restarts.

editord cannot have either bug by construction, because the layers are independent:
`chokidar` owns freshness, the LSP servers (oxlint, tsgo, dprint) own semantics, and ripgrep owns text search.
None can block or stale another.
A freshness fix is never gated by an indexing concern, because they are not the same subsystem.
Diagnostics specifically: editord holds no diagnostic state;
the LSP servers compute and push, and the `DiagnosticStore` only aggregates the push per source,
so diagnostics are exactly as fresh as the server's analysis.

This rests on two architectural bets that modern conditions make sound, but that should be stated, not assumed:

- The OS page cache already provides, coherently, what the VFS snapshot provides incoherently.
  On a local filesystem a read sees the latest write, and inotify supplies change notification without polling.
  editord assumes a local filesystem (it is a localhost daemon), which is where this holds.
- LSP is the right home for semantic operations in editord's scope (TS/JS),
  because tsgo and oxlint already build and cache their own project graphs;
  a second IDE-owned semantic index duplicates them.

## Finding 5: footprint (secondary, measured)

Measured with WebStorm 2026.2 running on this machine on 2026-05-25:
its top 10 processes alone sum to more than 4.9 GB resident
(a 3.8 GB JVM core, a 260 MB Node TypeScript language service,
and roughly 700 MB of embedded JCEF Chromium processes), and the list is truncated at 10.
editord has no equivalent of the JVM core:
a Bun server, one Chrome tab, and the same class of LSP subprocesses, with a 436 KB client bundle.
This is a real advantage, especially on constrained machines,
but it is secondary to the correctness findings; footprint alone would not justify maintaining the package.

## What editord gives up

The keep decision is not "editord wins".
editord is a feature subset of WebStorm by design, and trades real things away.

- No semantic index of its own.
  Find Usages, Rename, and symbol navigation come from the LSP servers, which must be running and warm;
  project text search comes from ripgrep, which is text, not semantic.
  The claim "nobody needs semantic search across the project" is overstated:
  Find Usages and Rename are semantic operations ripgrep cannot perform.
  The accurate claim is that the LSP provides them,
  so a separate IDE-owned index is redundant in this scope, not that they are unneeded.
- Only as good as the LSP.
  Moving semantics into the LSP layer is correct, but it is not free:
  if tsgo is slow or crashes, diagnostics and navigation are slow or absent,
  and editord's graceful degradation can mean no diagnostics at all.
- A documented feature gap.
  The README lists capabilities WebStorm has and editord omits on purpose:
  minimap, split panes, terminal, git, extensions, settings UI, multi-window, multi-project,
  remote development, and large-file handling.

The thesis holds only inside editord's scope:
a focused, single-language (TS/JS), local-filesystem, small-to-medium project (no 1000+ entry directories),
modern-machine, LSP-comfortable editor.
WebStorm's monolith is the cost of a broader mandate
(polyglot, framework-aware analysis, intelligence without a running language server,
fast warm start from persistent caches).
It is over-built for this scope, not wrong in the abstract.
The day the scope changes (cross-language framework intelligence, robustness without an LSP),
the monolith starts buying back its cost.

## The condition: fuzzing earns the keep

editord's freshness advantage is architectural but unverified at the edges.
Fuzzing converts "better by architecture" into "verified correct", so the keep depends on it.
The harness must hit the surfaces where editord's own freshness can fail, not only protocol-level sanity:

- Linux inotify watch budget.
  The `depth: 0` lazy model mitigates exhaustion but does not remove it,
  and queue overflow (`IN_Q_OVERFLOW`) silently drops events.
- Atomic-save rename races.
  `atomic: true`, `awaitWriteFinish` 150 ms, the `.editord.<hex>~` temp filter,
  and the 500 ms `SUPPRESS_MS` window form a four-piece interaction that a fuzzer should hammer.
- Rapid create/delete/rename bursts.
  The TODO already flags concurrent expand fetches with no cancellation.
- Symlinks and bind mounts.
  `followSymlinks: false` is a decision to pin behavior against.
- The self-save suppression window.
  The 500 ms `SUPPRESS_MS` is itself a narrow editord-side staleness window:
  an external change to a just-saved file landing inside it is dropped,
  the same failure class editord faults WebStorm for, far shorter.
  Prove it is bounded or close it.

Suggested shape: a `mktemp -d` scratch tree,
a randomized operation stream (create, modify, rename, delete, atomic-save, burst),
and an oracle that diffs editord's pushed tree state against a ground-truth `readdir` after quiescence.

## Reversibility

The decision is cheaply reversible in both directions.
Deprecation would not delete code; it would mark the package and stop investment, leaving it runnable.
Because `sun.java2d.vulkan` is a preview,
editord should stay runnable through at least one JBR upgrade cycle regardless,
so a Vulkan regression has a fallback.
The fuzzing is also the falsification test:
if it shows chokidar and inotify leak events as readily as the VFS drifts,
the evidence to deprecate arrives on its own and is stronger than anything available today.

## References

Source files (paths relative to the package root):

- `src/server/operations/watch-filesystem.ts`: per-directory chokidar watcher, suppression, orphan-temp sweep.
- `src/server/operations/watch-filesystem-filter.ts`: ignore rules, `AWAIT_WRITE_FINISH_MS`, `SUPPRESS_MS`.
- `src/server/lsp/diagnostic-store.ts`: multi-source push aggregation.
- [README.md](../../README.md), [PHILOSOPHY.md](../../PHILOSOPHY.md):
  motivation, non-goals, browser-as-platform rationale.

External sources (fetched 2026-05-25):

- [JBR-7558]: `sun.java2d.vulkan` WLToolkit rendering preview status.
- [IJPL-202302]: wrong rendering with Vulkan plus WLToolkit, IntelliJ 2025.2.
- [JBR-9951]: degraded performance under fractional scaling with Vulkan.
- [IDEA-168617]: external changes not picked up until VFS refresh; WONTFIX-by-design rationale.
- [IDEA-121164]: project tree not refreshing on branch switch.
- [IJPL-28967]: inspections do not re-evaluate during editing.
- [WI-77076]: live inspection not updating to reflect code changes.
- [WEB-40610]: inspections and syntax analysis slow.
- [VFS documentation][vfs-docs]: IntelliJ Platform snapshot and refresh model.

[JBR-7558]: https://youtrack.jetbrains.com/issue/JBR-7558
[IJPL-202302]: https://youtrack.jetbrains.com/issue/IJPL-202302
[JBR-9951]: https://youtrack.jetbrains.com/issue/JBR-9951
[IDEA-168617]: https://youtrack.jetbrains.com/issue/IDEA-168617
[IDEA-121164]: https://youtrack.jetbrains.com/issue/IDEA-121164
[IJPL-28967]: https://youtrack.jetbrains.com/issue/IJPL-28967
[WI-77076]: https://youtrack.jetbrains.com/issue/WI-77076
[WEB-40610]: https://youtrack.jetbrains.com/issue/WEB-40610
[vfs-docs]: https://plugins.jetbrains.com/docs/intellij/virtual-file-system.html
