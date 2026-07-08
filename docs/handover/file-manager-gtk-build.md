# Building the real GTK4 file manager (Niri column-strip UI) — handover

Live cross-session state for the implementation of the real file manager on GTK4, following the
approved plan. Kept updated as the build proceeds. The toolkit exploration that chose GTK4 is a
separate, finished doc (`file-manager-toolkit-exploration.md`); this one tracks the product build.

## Authoritative sources (do not re-derive these)

- Product UX + domain model + milestones: `docs/planning/file-manager.md` (product decisions
  resolved 2026-07-05). Everything there stands EXCEPT the stack.
- Stack decision (supersedes the planning doc's Slint sections): GTK4 (gtk4-rs). Evidence in
  `docs/handover/file-manager-toolkit-exploration.md`.
- Perf architecture: fixed-position panes on a canvas, GPU render-node cache, off-thread decode.
  Same handover's "Windows results"; tile principle by analogy from `docs/decisions/vector-design.md`
  (which is a DIFFERENT project's doc; only the tile/worker/eviction philosophy is borrowed).
- DnD reference implementations (verified): `docs/troubleshooting/gtk4-windows-outbound-file-drag.md`
  (Win32 OLE shim), `docs/troubleshooting/gtk4-macos-file-dnd.md` (objc2 AppKit shim + inbound
  macOS URI-unescape), `docs/troubleshooting/gtk4-windows-gvsbuild-directcomposition.md`
  (`GDK_DEBUG=dcomp` needed in-process for GPU rendering on Windows).

## Locked decisions

- Package: the GTK4 app reclaims the canonical, function-named `packages/desktop-app/file-manager/`
  (planning doc mandates it so bundle IDs survive a stack fallback). The old Slint sources and their
  fork `[patch.crates-io]` are deleted outright (task #30); nothing salvaged from them. The
  `file-manager-gtk` spike package is retired into this one. `file-manager-qt` is kept as evidence.
- Package identity: crate `file-manager`, lib `file_manager`, bin `monochromatic-file-manager`
  (lib+bin split so the domain model unit-tests without GTK).
- Scope of this pass: the interactive shell (Foundation -> directory listing -> pane strip with
  spawn/dedup/focus + keyboard -> off-thread thumbnails + eviction -> DnD both directions).
  Deferred: session-restore persistence, single-instance IPC transport, fff-core search, the full
  FileOperation/UndoStack, native default-manager registration, packaging, and the AT milestone.

## Interaction model being implemented (from the planning doc)

Niri-like infinite horizontal strip of columns; each column stacks panes vertically. Horizontal =
lineage depth, vertical = panes spawned from the previous column. Single-click spawns a child in the
next column and auto-focuses it (directory -> listing pane; file -> select + preview pane;
Enter/double-click -> open with OS default). Dedup-first (clicking an entry whose pane exists focuses
it); Ctrl+click forces a duplicate; keyboard selection follows the same rules. Panes die only on
explicit close; off-screen panes evict content (snapshots, decoded bitmaps) but never identity;
bulk-close gestures early. Keyboard-primary throughout.

## Module map (target)

`packages/desktop-app/file-manager/src/`: `main.rs`+`lib.rs` (bootstrap, tracing, GDK_DEBUG=dcomp on
Windows), `model.rs`/`types.rs`/`constants.rs` (domain), `fs.rs` (reads/metadata/sort), `strip.rs`
(fixed-canvas board), `pane.rs` (listing + preview variants), `spawn.rs` (spawn/dedup/focus),
`thumbs.rs` (off-thread decode + evicting cache), `dnd.rs` (+ `win_drag.rs`, `mac_drag.rs`),
`keys.rs` (keyboard nav).

## How to build / run

`mise run //packages/desktop-app/file-manager:run` (debug build, runs on native Wayland via
`GDK_BACKEND=wayland`). Tests: `//packages/desktop-app/file-manager:test`. Rust linter (max-lines +
require-rustdoc): `//packages/desktop-app/file-manager:lint:rust`. Types/clippy:
`//packages/desktop-app/file-manager:lint:clippy`.

## Progress log

- 2026-07-08: Plan approved (`/home/user/.claude/plans/lively-zooming-pillow.md`). Handover started.
  Verified the two target packages are standalone crates with no workspace/package.json references
  (only doc-comments in `cli/nested-wayland-session`), so the reclaim needs no registration changes.
- 2026-07-08: Checkpoint 1 (reclaim + Foundation) DONE. Cleared the Slint deck (#30): deleted every
  old Slint source + the fork `[patch.crates-io]`; retired the `file-manager-gtk` spike. Scaffolded
  the GTK4 package at the canonical path (crate `file-manager`, bin `monochromatic-file-manager`,
  lib+bin split): `Cargo.toml` (gtk4 0.11 `v4_10` + tracing trio), `mise.toml` (build/lint/lint:rust/
  test/run, `GDK_BACKEND=wayland`), `README.md`. `src/`: `lib.rs` (`run`: non-blocking tracing +
  `Application` + `GDK_DEBUG=dcomp` on Windows before GDK init + `FM_QUIT_MS` self-quit), `window.rs`
  (`build_window`), `constants.rs`, `main.rs` (thin bin). Calibration: the repo rust linter flags
  every `use` for missing rustdoc (the retired spike never passed it) — code here documents each
  `use`. Verified: debug build clean (30s); `lint:rust` and `lint:clippy` both rc=0; ran the binary
  on native Wayland (`WAYLAND_DISPLAY=wayland-0`) -> `presented top-level window`, self-quit, exit 0.
- 2026-07-08: Checkpoint 2 (domain model + fs reads, #42) DONE. Pure, GTK-free, unit-tested.
  `types.rs` (`PaneId`, `EntryKind`, `PaneLocation`, `FileEntry`, `DirectorySnapshot`), `fs.rs`
  (`read_directory` -> sorted `DirectorySnapshot`; dirs-first case-insensitive sort; best-effort
  per-entry metadata; a bad single entry is skipped with a warning, only a failed dir-open
  propagates), `model.rs` (`PaneStripState`: `open_root`/`spawn_child` with dedup + force-duplicate,
  `focus`, `close`/`close_column`/`close_right_of`, `columns`/`active` accessors). Modules are `pub`
  so they unit-test without GTK and avoid `dead_code` on fields not yet rendered. 11 tests
  (`fs_tests.rs`, `model_tests.rs`, both linter-exempt) cover sort, read+metadata, missing-dir error,
  dedup-and-focus, Ctrl-duplicate, close-clears-dedup, bulk close-column/close-right-of. lint:rust +
  lint:clippy rc=0 (calibration: the linter also requires rustdoc on tuple fields; clippy prefers a
  let-chain over a nested `if`). Next: directory-listing pane rendering a real directory (#43).
- 2026-07-08: Checkpoint 3 (directory-listing pane, #43) DONE. `pane.rs`: `build_listing_pane` builds
  a virtualized `GtkListView` over a `DirectorySnapshot` (`gio::ListStore` of `BoxedAnyObject`-wrapped
  `FileEntry`; `SignalListItemFactory` setup/bind; each row = themed icon by kind + name label) under
  a header showing the directory path. `window.rs` now reads `$HOME` (fallback cwd) via
  `fs::read_directory` and shows the listing pane, or an honest error label on failure. Verified: it
  listed real `$HOME` with `entries=108` (matches `ls -1A | wc -l`), presented the window, zero GTK
  errors, clean exit. A full-screen screenshot was intentionally skipped (it would capture personal
  desktop content, and single-window capture is not reliably targetable here); verification is the
  entry-count match plus the clean render log. Next: fixed-canvas pane strip + spawn/dedup/focus +
  keyboard (#44).
- 2026-07-08: Checkpoint 4a (fixed-canvas strip + spawn/dedup + close, part of #44) DONE.
  `constants.rs` adds `PANE_WIDTH/HEIGHT/GAP` + `FM_AUTOSPAWN`. `strip.rs`: `StripController` over a
  `GtkFixed` inside a `ScrolledWindow`; panes at `(column*(W+GAP), slot*(H+GAP))`, empty cells = no
  widget; `reconcile()` = `remove_stale` + `ensure_pane_widget` (move existing / build+put new, sized
  to the fixed pane box); `spawn_from` maps an activated `FileEntry` to Directory/Preview, calls
  `model.spawn_child` (dedup + column+1), reconciles, idle-defers a scroll-to-reveal, returns the new
  id; `close_pane` closes + reconciles. `pane.rs`: `single_click_activate` + `connect_activate` ->
  `on_activate`; header = ellipsized path label + a `window-close-symbolic` button -> `on_close`.
  `window.rs` returns the controller; `lib.rs` holds controllers for the app lifetime (pane closures
  hold only a `Weak`, so no reference cycle). Verified via `FM_AUTOSPAWN`: spawn -> `panes=2
  columns=2`, then close -> `panes=1`, presented, clean exit. Remaining for #44: Ctrl+click
  force-duplicate and Left/Right keyboard column focus.
