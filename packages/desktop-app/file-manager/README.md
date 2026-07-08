# file-manager

Native cross-platform file manager. The interaction model is Niri-like: an infinite horizontal
strip of columns, each column stacking panes vertically. Horizontal position is lineage depth;
vertical position accumulates the panes spawned from the previous column. Single-click spawns a
child pane in the next column and focuses it (a directory spawns a listing pane; a file spawns a
preview pane); Enter or double-click opens a file with the OS default. Panes are deduplicated by
location and die only on explicit close.

The full product specification is `docs/planning/file-manager.md`. This package reclaims the
canonical, function-named `packages/desktop-app/file-manager/` path from an earlier Slint
prototype; the toolkit is now GTK4 (gtk4-rs), chosen for native Wayland drag-and-drop on a pure
KWin session (see `docs/handover/file-manager-toolkit-exploration.md` for the decision and
`docs/handover/file-manager-gtk-build.md` for live build state).

## Why GTK4

Native OS drag-and-drop on a pure Wayland session (no XWayland) is a hard constraint. GTK4's GDK
implements drag-and-drop over `wl_data_device`; the winit-based stacks (Slint, and friends) do
not, and would need a hand-maintained protocol adapter plus a toolkit fork. GTK4 also renders on
the GPU, tears down cleanly on every platform, and keeps the UI in Rust with no separate markup
language.

## Status

Under active construction (the interactive shell). Built: the application foundation (native
Wayland window). In progress per `docs/handover/file-manager-gtk-build.md`: the domain model and
filesystem reads, the fixed-canvas column strip with spawn/dedup/focus and keyboard navigation,
off-thread thumbnail decoding with a bounded evicting cache, and drag-and-drop in both directions.
Deferred: session-restore persistence, single-instance IPC, search, file operations with undo,
native default-manager registration, and packaging.

## Build and run

Run on the host with mise (Cargo builds against the system GTK 4.22 via pkg-config):

```sh
# debug build, then run on native Wayland (GDK_BACKEND=wayland, never XWayland)
mise run //packages/desktop-app/file-manager:run
```

Other tasks: `build` (release), `lint` (cargo check), `lint:clippy` (clippy, warnings denied),
`lint:rust` (max-lines + require-rustdoc), `test` (cargo nextest).

## Platform notes

- Linux (primary): native Wayland window and drag-and-drop, no workarounds.
- Windows: GTK builds via gvsbuild; the app sets `GDK_DEBUG=dcomp` in-process so the GL renderer
  uses the GPU, and outbound file drag uses a native Win32 OLE shim (GDK's Win32 drag source does
  not deliver files to Explorer).
- macOS: inbound drops recover the path with a URI-unescape (GDK's Quartz backend percent-encodes
  the URI scheme colon), and outbound file drag uses a native AppKit shim.
