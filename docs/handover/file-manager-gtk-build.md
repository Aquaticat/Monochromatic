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

## Module map (as built)

`packages/desktop-app/file-manager/src/`: `main.rs` (thin bin) + `lib.rs` (bootstrap, tracing,
`GDK_DEBUG=dcomp` on Windows, module wiring, controllers kept alive for the app lifetime);
`constants.rs`, `types.rs` (domain data), `model.rs` (`PaneStripState` spawn/dedup/close state
machine), `fs.rs` (reads/metadata/sort); `window.rs` (top-level window + inbound drop target);
`strip.rs` (fixed-canvas board, `reconcile`, spawn/close glue, scroll-to-reveal, Left/Right column
keyboard nav); `pane.rs` (listing pane with single-click-activate + Ctrl-duplicate tracking + close
button, plus the preview-pane builders); `thumbs.rs` (off-thread decode + byte-bounded evicting
texture cache); `dnd.rs` (inbound drop target + cfg-branched outbound drag); `win_drag.rs` (cfg
windows, OLE shim), `mac_drag.rs` (cfg macos, AppKit shim). Tests: `fs_tests.rs`, `model_tests.rs`
(linter-exempt). Spawn/dedup/focus and keyboard nav were folded into `strip.rs`/`pane.rs` rather than
separate `spawn.rs`/`keys.rs`.

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
- 2026-07-08: Checkpoint 4b (#44 DONE): Ctrl force-duplicate + keyboard column navigation. `pane.rs`:
  `install_force_duplicate_tracking` wires a capture-phase `GestureClick` + an `EventControllerKey`
  feeding a shared `Cell<bool>`; `connect_activate` reads-and-clears it and passes `force_dup` to
  `on_activate` (now `Fn(&FileEntry, bool)`); arrow keys only move selection, so browsing never spawns.
  `strip.rs`: `spawn_from` takes `force_duplicate` -> `model.spawn_child`; tracks `focused_column`;
  `install_column_nav` adds a capture-phase key controller on the scroller mapping Left/Right to
  `focus_relative_column` (grab_focus the adjacent column's first pane), leaving Up/Down to the
  focused list; a spawn grabs focus to the new pane in `scroll_to_pane`'s idle callback.
  Build/lint/test green; autospawn spawn+close unchanged (`panes 2 -> 1`), clean exit. The modifier
  and arrow paths compile and lint; their full boundary check (real Ctrl+click / Left-Right) is manual
  (headless input can't target the window precisely), but the spawn/dedup/force-duplicate/close LOGIC
  is unit-tested. Next: off-thread thumbnails + evicting cache + preview panes (#45).
- 2026-07-08: Checkpoint 5 (off-thread thumbnails + evicting cache + preview panes, #45) DONE. Deps:
  `image` 0.25 (decode) + `async-channel` 2 (worker->main delivery, since glib removed
  `MainContext::channel`). `thumbs.rs`: `Thumbnails::start` spawns a decode worker thread
  (`image::open` -> `thumbnail(THUMB_SIZE)` -> RGBA) that delivers `(path, Option<Decoded>)` over an
  async channel drained by `glib::spawn_future_local` on the main context; `deliver` builds a
  `MemoryTexture`, inserts into a byte-bounded LRU (`evict_to_budget` keeps the total under
  `THUMB_CACHE_BYTES` = 64 MB), and fulfils every waiting `Picture`; `request` deduplicates concurrent
  requests per path and serves cache hits immediately (`touch` bumps the LRU tick). `is_image` gates
  by extension. `pane.rs`: `build_preview_pane` (header + close) over `build_preview_body` (image ->
  off-thread `Picture`, else a large themed icon + name); the preview builders live here to keep
  `strip.rs` under max-lines (split when it hit 312). `strip.rs`'s Preview arm calls it with a close
  closure; `StripInner` owns the `Thumbnails`. Verified via `FM_START_DIR=/usr/share/pixmaps
  FM_AUTOPREVIEW`: preview spawned (`panes=2`), `thumbnail ready path=.../cupsprinter.png width=256
  height=256 cache_bytes=262144` (= 256*256*4), clean exit -> decode ran off-thread, texture built +
  cached with exact byte accounting, `Picture` updated. Full browse-many-images eviction is trusted
  from the LRU logic (only one thumbnail here, well under the cap). Next: DnD wiring (#46).
- 2026-07-08: Checkpoint 6 (DnD wiring, #46) DONE. `Cargo.toml`: target-gated `windows` 0.58 + `objc2`
  0.6 shim deps (compiled only on their OS). `dnd.rs`: inbound `install_drop_target` attaches a
  `GtkDropTarget` (`GdkFileList`, copy) to the window, logging each dropped file's recovered path +
  uri (`recover_path` falls back to `glib::Uri::unescape_string` for the macOS scheme-colon encoding).
  Outbound `install_file_drag` is cfg-branched: Wayland -> `GtkDragSource` with a `text/uri-list`
  content provider; windows -> `GtkGestureDrag` -> `win_drag::start_file_drag` (OLE shim); macos ->
  `GtkGestureDrag` -> `mac_drag::start_file_drag` (AppKit shim). `win_drag.rs` + `mac_drag.rs` ported
  verbatim from the verified troubleshooting-doc/scratchpad references, with rustdoc added on their
  `use`s/`impl` so the linter (which parses all `.rs` regardless of cfg) passes. Wired: the window
  gets the drop target; a preview pane's body (Picture / icon box) gets the outbound drag.
  Build/lint:rust (checks the win/mac files too)/clippy/test all green; ran clean with DnD installed
  (no errors, clean exit). Live drag verification (real Dolphin <-> app) is MANUAL: headless cannot
  synthesize a Wayland drag gesture, and these are the exact `GtkDropTarget`/`GtkDragSource` APIs the
  spike already verified with real Dolphin. Outbound is currently from preview panes (single-file, no
  click/virtualization conflict); dragging listing ROWS out is a documented refinement (needs
  drag-vs-activate arbitration + per-row path tracking). macOS/Windows shim at-boundary verification
  rides the m1/x13-win pass. Next: #47 final at-boundary verification + README/package completeness.
- 2026-07-08: Checkpoint 7 (#47, first-pass verification + completeness) DONE. The interactive shell
  is complete on Linux. Final green sweep: `lint`, `lint:rust`, `lint:clippy`, `test` (11) all rc=0;
  15 source files. Release artifact (`build`) verified at the boundary: (A) real `$HOME` autospawn ->
  `spawned panes=2 columns=2` then `closed panes=1`, presented, exit 0; (B) `/usr/share/pixmaps`
  autopreview -> off-thread `thumbnail ready 256x256 cache_bytes=262144`, presented, exit 0. Package
  completeness (PKG): `README.md` present, zero lint errors, unit tests cover the pure exported paths
  (model spawn/dedup/close, fs read+sort); GTK-coupled paths (strip reconcile, thumbnail decode/cache,
  DnD install) are runtime-verified via the autospawn/autopreview hooks and clean-run logs.

  What is verified automatically vs still manual:
  - Automatic (at boundary, this machine): build/lint/test; native Wayland window; real-directory
    listing (108-entry `$HOME` match); spawn -> next-column child + dedup+close reconcile;
    off-thread thumbnail decode + cache byte accounting; clean teardown (exit 0) on every run.
  - Manual (needs a human / another machine): live Ctrl+click duplicate, Left/Right column focus, and
    real Dolphin <-> app drag-and-drop (headless can't synthesize Wayland pointer/drag input); and the
    Windows OLE + macOS AppKit outbound shims (compiled behind cfg + linter-clean here, at-boundary
    on the x13-win/m1 pass).

  Deferred (designed, not built this pass): session-restore persistence, single-instance IPC,
  fff-core search, the full FileOperation/UndoStack (copy/move/rename/trash/delete + inverse undo),
  native default-manager registration, packaging/signing, the AT semantics milestone, dragging listing
  ROWS out (needs drag-vs-activate arbitration + per-row path tracking; outbound is preview-pane-only
  today), and drop-INTO-a-directory as a real file operation (inbound currently accepts + logs).
