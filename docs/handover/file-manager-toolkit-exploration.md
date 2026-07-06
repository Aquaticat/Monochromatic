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
  list, and clean teardown, all verified end to end, owning nothing. Fast-scroll 60 fps is
  being measured now. Linux-first; macOS and Windows are second-class.
- Decision: not final. It reduces to Linux-cleanliness (GTK4) vs cross-platform-native
  (Qt, with the exit crash and perf tuning). Awaiting the GTK fps number and the user's
  call.

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
- Strong point: first-class native on macOS and Windows. Weak points: pre-1.0 cxx-qt API
  churn, DIY macOS/Windows Qt bundling, the teardown crash.

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
- Owns nothing: no fork, no hand-rolled protocol, no accepted crash.
- Rationale it works: GNOME Files (Nautilus) is GTK4, so file-manager-scale DnD, columns,
  and huge directories are its home turf.
- Not yet done: fast-scroll 60 fps measurement (in progress, image-thumbnail benchmark);
  outbound drag; macOS and Windows (GTK there is second-class).

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

- Measure GTK4 fast-scroll fps with image thumbnails (current task); update the status
  table above with the honest number.
- If GTK4 holds up: build the real column-strip file manager in GTK4 (GtkColumnView or
  nested lists), wire outbound drag (`GtkDragSource`) and clipboard, then test on macOS and
  Windows.
- If Qt is chosen instead: build the Rust `QAbstractListModel` app (M1), apply the
  `process::exit` clean-exit, and accept the cross-platform bundling work.
- Either way: verify inbound and outbound DnD on macOS (`m1`) and Windows (`x13-win`).

## How to run the spikes

- Qt: `mise run //packages/desktop-app/file-manager-qt:run` (forces `QT_QPA_PLATFORM=wayland`).
- GTK: `mise run //packages/desktop-app/file-manager-gtk:run` (forces `GDK_BACKEND=wayland`).
