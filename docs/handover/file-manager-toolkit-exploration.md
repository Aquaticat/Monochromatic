# File manager toolkit exploration: Slint, then Qt, then GTK4 (handover)

Cross-session state for choosing the GUI toolkit for a native cross-platform file manager.
The hard constraint is native OS drag-and-drop on a pure Wayland session (KWin), no
XWayland. The fleet is Linux (primary, this KWin machine), macOS (`ssh m1`), Windows
(`ssh x13-win`). This doc is kept live; sections marked "measuring" or "not built" are
updated as work proceeds.

## Status at a glance

- Slint (winit): rejected for this app. No native Wayland DnD; needs a hand-rolled
  `wl_data_device` adapter plus a Slint fork. Painful, and we would own both.
- Qt (cxx-qt): works, but `reuseItems` (required for 60 fps fast scroll) segfaults on
  teardown, accepted as an on-exit crash. Native DnD proven at the framework level, not
  yet wired into our spike. First-class on macOS and Windows.
- GTK4 (gtk4-rs): native Wayland window, native inbound DnD from Dolphin, virtualized
  list, and clean teardown, all verified end to end, owning nothing. The faithful 2D grid of
  ~14400 mixed panes (previews and small lists) scrolls diagonally at a steady ~60 fps, as long
  as thumbnail decode is off the render path (synchronous per-frame decode drops it to ~4 fps).
  Linux-first; macOS and Windows are second-class.
- Decision: not final, and the criterion has been narrowed. Styling, macOS/Windows native
  feel, and packaging are explicitly NOT deciding factors (they are solvable, and complexity
  is not a blocker). The deciding factor is developer experience: how nice each toolkit is to
  work with. Gate: build and run both spikes on macOS (`m1`) and Windows (`x13-win`) first,
  then choose on developer experience. The Windows machine is currently off, so this is paused.

## Decision criteria (corrected)

What does NOT decide it: styling and native look (out of scope; we style until it aligns);
which toolkit has a flagship file manager (both do, Nautilus is GTK and Dolphin is Qt);
macOS/Windows foreign look and packaging (solvable, complexity is not a blocker); raw
cross-platform reach (both reach all three targets).

What DOES decide it: developer experience, how nice each is to work with, plus passing the
macOS and Windows build-and-run gate.

Developer-experience read (from building both spikes hands-on, preliminary):

- GTK4 (gtk4-rs): mature bindings (0.11, stable API), pure Rust, idiomatic (builder pattern
  and closures), UI in Rust with no separate markup language, no C++ shim. The spike was about
  90 lines and mostly worked first try. Nicer to work with so far.
- Qt (cxx-qt): pre-1.0 (0.9.1) with an API that churns across 0.x bumps; the UI lives in QML
  (a separate markup and JS language, a Rust/QML split); a hand-written C++ shim was needed
  just to route Qt's logging off-thread; the bridge macro forbids doc comments on extern
  blocks and has other sharp edges. More powerful cross-platform, but more friction.

This read is preliminary and must be confirmed by actually building each on macOS and Windows.

## Verified findings per toolkit

### Slint (winit) — rejected

- winit 0.30 has no Wayland DnD (winit#1881); inherited by every winit toolkit (Slint,
  Bevy, Iced, egui). See `docs/troubleshooting/winit-toolkits-no-wayland-drag-and-drop.md`.
- An earlier session got inbound Dolphin drops working by hand-rolling a `wl_data_device`
  adapter on winit's Wayland connection, but only after forking Slint to add
  `BackendBuilder::with_clipboard(false)`, because KWin delivers a drag to only a client's
  FIRST data device and Slint's clipboard device took that slot. See
  `docs/troubleshooting/kwin-drag-only-first-data-device.md` and
  `docs/handover/file-manager-native-dnd.md`. Roughly 1345 lines of DnD plumbing plus a
  maintained Slint fork. Ownership too high.

### Qt (cxx-qt) — works, with an accepted on-exit crash

- cxx-qt 0.9.1 against system Qt 6.11.1. Native Wayland QML window verified on KWin
  (`xdg_toplevel`, no XWayland). Package: `packages/desktop-app/file-manager-qt`.
- Fast scroll needs `ListView { reuseItems: true }`: naive create/destroy delegates hit
  11 fps at fast scroll, `reuseItems` + async incubation + cacheBuffer holds 60 fps (after
  a ~3 s warmup). Measured with the standalone `qml` runtime, not yet the integrated
  cxx-qt app. See `docs/troubleshooting/qt-qml-listview-fast-scroll-recycling.md`.
- `reuseItems` segfaults on teardown (use-after-free in
  `QQmlReusableDelegateModelItemsPool::drain`), triggered by any `Loader` wrapping a nested
  reuseItems `ListView`, by three or more nested levels, or even a mixed 2-level layout.
  Qt 6.12 does not fix it (the crash-site change is a pure refactor). Resolution: accept
  the on-exit crash, or `std::process::exit(0)` after `exec()` for a clean exit; no Qt
  fork or backport (ownership). See
  `docs/troubleshooting/qt-qml-reuseitems-teardown-segfault.md`.
- Native DnD is a Qt capability (Dolphin itself is Qt on Wayland), but our Qt spike does
  not yet wire a `DropArea`, so DnD is not verified end to end in our code.
- Non-blocking logging is done: `tracing` on a `tracing-appender` NonBlocking writer, plus
  a `qInstallMessageHandler` C++ shim routing Qt's own logs into the same off-thread sink
  (`src/qt_log.rs`, `src/qt_log.cpp`).
- Cross-platform native feel is first-class, but that is not a deciding factor here (styling
  is out of scope). What counts against Qt on the deciding axis (developer experience): pre-1.0
  cxx-qt API churn, the UI split into QML (a separate markup and JS language), a hand-written
  C++ shim needed just to route logging, and the bridge-macro sharp edges.

### GTK4 (gtk4-rs) — cleanest so far

- gtk4-rs 0.11 (feature `v4_10`) against system GTK 4.22. Package:
  `packages/desktop-app/file-manager-gtk`. About 90 lines.
- Verified end to end on this KWin session:
  - Native Wayland window (`xdg_toplevel`, 114 protocol msgs, no xcb/XWayland).
  - Virtualized `ListView` over a 100000-row model (only ~28 rows realized; screenshot).
  - Clean teardown, `rc=0` (exactly where Qt segfaults).
  - Native inbound DnD: a real Dolphin drop of `~/Downloads/hello.txt` landed via a stock
    `GtkDropTarget` (`GdkFileList` over `wl_data_device`), logged as `inbound file drop`.
  - Non-blocking `tracing`, same as the Qt spike.
  - Fast scroll: the diagonal 2D grid of ~14400 mixed panes (previews and small lists,
    `src/main.rs` under FMGTK_BENCH) holds a steady ~60 fps with thumbnails decoded off the
    render path; naive synchronous per-frame decode drops it to ~4 fps. Clean teardown (rc 0)
    throughout, unlike Qt (no `reuseItems`-style teardown crash).
- Owns nothing: no fork, no hand-rolled protocol, no accepted crash.
- Correction: "Nautilus is GTK4" is not a differentiator over Qt, since Dolphin (a flagship
  Qt file manager) shows Qt is equally proven for this use case. Both are battle-tested; this
  is dropped as a reason.
- Not yet done: outbound drag (`GtkDragSource`); a real off-thread thumbnail decoder (the
  benchmark caches; the app needs a worker plus eviction like `preview.rs`); macOS and Windows
  (GTK there is second-class).

## Branches and worktrees

- `feat/file-manager-qt` at `/var/home/user/worktrees/file-manager-qt`: the Qt spike, the
  three Qt/winit troubleshooting docs, and a require-rustdoc linter change (cxx-qt files
  exempt `use` and trait-impl items). Pushed to `Aquaticat/Monochromatic`.
- `feat/file-manager-gtk` at `/var/home/user/worktrees/file-manager-gtk`: the GTK spike and
  this handover. Pushed.
- `main`: the earlier Slint native-DnD work and the winit-toolkit survey doc.

## Key decisions made

- Leave Slint (its winit base cannot do Wayland DnD without a fork we own).
- Do not fork or backport Qt for the teardown crash; accept the on-exit crash instead.
- Log off-thread in both spikes (tracing NonBlocking; Qt logs bridged in).
- Toolchains layered live via `rpm-ostree install --apply-live` (Qt6 devel; gtk4-devel).

## Open items and next steps

- PAUSED HERE (decision gate): build and run BOTH spikes on macOS (`m1`) and Windows
  (`x13-win`), judging the developer experience of getting each toolkit built and running on
  each. The Windows machine is currently off, so this is paused; macOS (`m1`) can be probed
  when resumed.
- Then decide GTK4 vs Qt on developer experience (not styling or cross-platform polish).
- After choosing, build the real column/pane UI. For GTK, a `GtkColumnView` or nested lists
  with an off-thread thumbnail decoder plus eviction (like `preview.rs`), and wire outbound
  `GtkDragSource` and clipboard. For Qt, the Rust `QAbstractListModel` app (M1) with the
  `process::exit` clean-exit and DnD wired in.
- Either way, verify inbound and outbound DnD on macOS and Windows.

## How to run the spikes

- Qt: `mise run //packages/desktop-app/file-manager-qt:run` (forces `QT_QPA_PLATFORM=wayland`).
- GTK: `mise run //packages/desktop-app/file-manager-gtk:run` (forces `GDK_BACKEND=wayland`).
