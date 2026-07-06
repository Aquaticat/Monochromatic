# winit-based Rust GUI toolkits (Slint, Bevy, Iced, egui) have no native Wayland drag-and-drop; only native toolkits (GTK4, Qt) do

Choosing a Rust GUI toolkit for an app that needs OS drag-and-drop on a pure
Wayland session (the file-manager prototype, `packages/desktop-app/file-manager/`)
runs into a gap that is easy to misattribute to one toolkit. It is not
Slint-specific: it is inherited from winit, which every one of the popular Rust
toolkits (Slint, Bevy, Iced, egui) uses for windowing. This doc records the gap,
which toolkits share it, and what actually avoids it, so the toolkit choice is
made once with the evidence in view.

## Symptom

- Dragging a file from a file manager onto the app on a native Wayland session
  does nothing: no drop event ever reaches the app.
- The same app on X11 (or XWayland) receives file drops fine, because the drop
  path there goes through a different code path.
- This looks like a bug in whichever toolkit is in use, but swapping to another
  winit-based toolkit does not fix it.

## Root cause

winit is the windowing layer under Slint, Bevy, Iced, and egui, and winit 0.30
has no Wayland drag-and-drop at all. Reading winit 0.30.13's Wayland backend
(`src/platform_impl/linux/wayland/`) directly: there are no `DroppedFile` or
`HoveredFile` window events and no data-source API; the only "drag" in that
backend is interactive window move/resize. winit's X11 and macOS backends do
emit `DroppedFile`/`HoveredFile`, which is why the same app works on X11 and
macOS but not Wayland. The upstream tracking issue is
[winit#1881](https://github.com/rust-windowing/winit/issues/1881) (open), with
[winit#1499](https://github.com/rust-windowing/winit/issues/1499) as related
history.

Because the toolkits delegate windowing to winit, they inherit the gap:

- **Slint** (via `i-slint-backend-winit`): no OS file drag-and-drop on Wayland.
  Slint's in-process `DragArea`/`DropArea` cannot cross the application boundary
  (see [slint-drag-and-drop-file-lists.md](slint-drag-and-drop-file-lists.md)).
- **Bevy** (via `bevy_winit`): its own docs state "drag and drop window events
  are currently not supported on Wayland"
  ([Bevy Cheat Book](https://bevy-cheatbook.github.io/input/dnd.html)). Bevy's
  `FileDragAndDrop` event is winit's `DroppedFile`, so it is present on
  X11/Windows/macOS and absent on Wayland.
- **Iced** and **egui** (both winit-based, via `winit`/`eframe`): same gap;
  their file-drop events are winit's, which Wayland does not deliver.

The workaround every winit-based app must use is to drive the Wayland
`wl_data_device` protocol by hand on the app's own connection (the file manager
does this in `packages/desktop-app/file-manager/src/dnd_wayland.rs`, sharing
winit's connection via `Backend::from_foreign_display`). That hand-rolled
adapter is inherent to the winit family, not to Slint.

Toolkits that are NOT winit-based do not have the gap, because they are
compositor-integrated widget toolkits with first-class drag-and-drop:

- **GTK4** via [`gtk4-rs`](https://lib.rs/crates/gtk4): native Wayland
  drag-and-drop through `GtkDropTarget` / `GtkDragSource`, plus native clipboard,
  and `GtkColumnView`/`GtkListView` for virtualized column lists (the widgets
  file managers such as the Nautilus family use). No winit, no co-bound data
  device.
- **Qt** via `cxx-qt` / `qmetaobject`: native Wayland drag-and-drop and
  clipboard; heavier bindings.

## Verification

- winit source: winit 0.30.13, `src/platform_impl/linux/wayland/` has no
  `DroppedFile`/`HoveredFile`; the X11 and macOS backends do. (Read during the
  native-DnD investigation; see `docs/handover/file-manager-native-dnd.md`.)
- Upstream tracking: [winit#1881](https://github.com/rust-windowing/winit/issues/1881)
  ("Support drag and drop on wayland"), open at time of writing.
- Bevy: [Bevy Cheat Book, Drag-and-Drop (Files)](https://bevy-cheatbook.github.io/input/dnd.html)
  states Wayland is unsupported; Bevy windowing is `bevy_winit`.
- Reproduced directly for Slint: the file manager receives no OS drop on Wayland
  until the hand-rolled `wl_data_device` adapter is added, and that adapter works
  under a compositor that delivers drags correctly (verified via the Smithay
  nested compositor's `drop-file` command in `packages/cli/nested-wayland-session`).

Toolkit matrix (native Wayland OS file drag-and-drop, without hand-rolling
`wl_data_device`):

- Slint: no (winit).
- Bevy: no (winit).
- Iced: no (winit).
- egui: no (winit).
- GTK4 (`gtk4-rs`): yes (native).
- Qt (`cxx-qt`): yes (native).

## Verified workarounds

- **Stay winit-based and hand-roll `wl_data_device` (what the file manager does).**
  Share winit's Wayland connection on a second thread and drive the data-device
  protocol directly. Tradeoff: it is real protocol work, and it interacts badly
  with a toolkit that also binds a data device for its clipboard: KWin delivers a
  drag to only the first data device a client binds, so the app's device must be
  the only one (see
  [kwin-drag-only-first-data-device.md](kwin-drag-only-first-data-device.md) and
  the Slint `with_clipboard(false)` fork fix). This is the path taken because the
  toolkit was already Slint.
- **Switch to a native toolkit (GTK4 via `gtk4-rs`, or Qt).** Deletes the entire
  hand-rolled adapter and this whole class of problem: native DnD, native
  clipboard, and virtualized column widgets. Tradeoff: a UI rewrite away from
  Slint's markup and the work already invested in it.

## What does not work

- **Switching between winit-based toolkits** (for example Slint to Bevy, Iced, or
  egui) to get Wayland DnD. They all sit on winit and all inherit winit#1881.
  Bevy specifically is a game engine with no widget/list toolkit, so a file
  manager would also be a from-scratch UI, for no DnD benefit.
- **Relying on the toolkit's built-in file-drop event on Wayland.** It is winit's
  `DroppedFile`, which Wayland never delivers.

## Upstream filing decision

The upstream gap is winit's, and it already has an open tracking issue,
[winit#1881](https://github.com/rust-windowing/winit/issues/1881). Per the
duplicate-search rule, an existing issue means no new issue: this doc links it
rather than filing a second one. Adding Wayland drag-and-drop to winit is a large
backend feature, tracked upstream for years; the pragmatic client response is
already recorded here (hand-roll `wl_data_device`, or choose a native toolkit),
so there is nothing additive to post on the winit thread that it does not already
have. No fileable draft is kept.

`.out-of-scope/` was checked: no exemption covers winit, Wayland, or GUI-toolkit
drag-and-drop.

## Related docs

- [slint-drag-and-drop-file-lists.md](slint-drag-and-drop-file-lists.md): Slint's
  in-process `DragArea`/`DropArea` cannot cross the app boundary.
- [kwin-drag-only-first-data-device.md](kwin-drag-only-first-data-device.md): why
  the hand-rolled adapter still failed on KWin, and the Slint `with_clipboard`
  fork fix.
- `docs/handover/file-manager-native-dnd.md`: the native-DnD build state and the
  Smithay automated test.
