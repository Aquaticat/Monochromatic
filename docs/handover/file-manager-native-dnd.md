# Handover: file-manager native drag-and-drop

Cross-session state for building hand-written per-OS native drag-and-drop into the
file-manager prototype (`packages/desktop-app/file-manager/`), so files can be
dragged between the app and the OS file manager.
Started 2026-07-05.
Update this doc after each milestone.

## Goal and hard constraint

Slint's in-process `DragArea`/`DropArea` cannot cross the application boundary, so
real file drag-and-drop needs native adapters per OS.
Ordering chosen with the user: inbound is cross-platform and comes first; outbound
is per-OS, starting with **Linux**, then macOS (`ssh m1`), then Windows
(`ssh x13-win`).

Hard constraint from the user:
the app must behave correctly on a **pure Wayland** session (no XWayland/XDND
shortcut).

## Pivotal finding that shapes everything

winit 0.30 (which Slint's winit backend wraps) has **zero** Wayland drag-and-drop:
no `DroppedFile`/`HoveredFile` events, no data-source API (checked winit 0.30.13
`src/platform_impl/linux/wayland/` directly; the only "drag" there is window
move/resize).
Those events exist only in winit's X11 and macOS backends.

Consequences:

- The easy cross-platform inbound path (`WinitWindowAccessor::on_winit_window_event`
  observing winit's `DroppedFile`) works on X11, macOS, and Windows, but NOT on
  pure Wayland.
- On pure Wayland, BOTH directions must be driven by hand over the `wl_data_device`
  protocol, on winit's own connection (a drag's `start_drag` needs the pointer
  press SERIAL the compositor delivered to this client, which only the app's own
  connection sees).

## Architecture (Linux / Wayland)

Share winit's Wayland connection and run a second event queue on a dedicated
thread (the exact pattern `smithay-clipboard` uses to add clipboard to winit
apps):

1. Get winit's `wl_display`/`wl_surface` from the Slint window via the winit raw
   handle (`dnd_native::wayland_handles`).
2. `Backend::from_foreign_display(display)` + `Connection::from_backend` wrap that
   existing connection without opening a new one.
3. `registry_queue_init` makes this thread's own event queue on the shared
   connection.
4. Co-bind our own `wl_seat` + `wl_pointer` (and later `wl_keyboard`) to observe
   the same button presses winit sees, tracking the latest press **serial**.
5. Drive `wl_data_device` via smithay-client-toolkit's `data_device_manager`:
   outbound `create_drag_and_drop_source(["text/uri-list"], Copy|Move)` +
   `start_drag(&data_device, &origin_surface, None, serial)`; inbound
   `DragOffer` accept/`set_actions`/`receive` then read the `text/uri-list` pipe.

The window only has a live winit window once the event loop is active, so the
adapter starts from a single-shot timer after `run()`, not at `AppWindow::new()`.

### The one flagged risk (spike early)

`start_drag` + a co-bound pointer + a shared/foreign winit connection is
reasoned-correct (per-seat implicit grab, global serials) but not shown in any
shipping crate; smithay-clipboard only proves the co-bound-pointer serial for
clipboard `set_selection`.
So milestone 1 validates just this: does a co-bound `wl_pointer` on winit's shared
connection receive button presses with serials?
If not, the whole shared-connection approach is dead and the fix moves into a winit
fork.

## Version pins (must stay unified with winit)

winit 0.30 already pulls these on Linux, so matching versions makes Cargo unify to
a single compiled `wayland-client`/`wayland-backend` and the foreign display is
genuinely shared:

- `smithay-client-toolkit` 0.19.2 (features `calloop`; re-exports `calloop` and
  `calloop_wayland_source`)
- `wayland-client` 0.31
- `wayland-backend` 0.3 (feature `client_system`, gives `from_foreign_display`)

Hard rule: never pull anything on `wayland-client` 0.30 / `wayland-backend` 0.2
(an old sctk ≤0.18), or the foreign display splits into two incompatible backends.
Reference: sctk 0.19.2 `examples/data_device.rs` is the complete both-directions
template.

## Verification infrastructure (this machine)

- Session: KDE Plasma, `kwin_wayland` compositor, native Wayland (`WAYLAND_DISPLAY`
  set; the app logs `backend=wayland`).
- Drop target: `dolphin` (the only installed file manager).
- Synthetic input for scripted drags: `ydotool` (present; needs its daemon +
  uinput). `wtype`/`wlrctl` absent.
- The user is present and can perform a real drag by hand when scripted input is
  impractical.

## Current state (2026-07-05)

Committed:

- `227...`-era baseline plus the in-process drag-and-drop spike (`drag_drop.rs`)
  and its troubleshooting doc.
- `63f72cc81` native DnD foundation: `dnd_native.rs` extracts the Wayland
  handles; verified on a real Wayland session (`backend=wayland`).

In progress (not yet committed):

- `dnd_wayland.rs` milestone 1: share winit's connection on a dedicated thread,
  co-bind a `wl_pointer`, log left-button press serials. Cargo deps added
  (Linux-gated). Wired: `dnd_native::start` (called from the app's single-shot
  timer) spawns it on Wayland.
- Next action: compile, run, click the window, and confirm the thread logs
  `co-bound pointer saw a left-button press (serial captured)`. That is the
  make-or-break for the whole approach.

## Milestones

1. Serial probe (co-bound pointer receives presses + serials) — code written,
   awaiting run verification.
2. Outbound: `create_drag_and_drop_source` + `start_drag` with the press serial,
   advertise a real temp file's `text/uri-list`; drag into dolphin, confirm a file
   copies. Needs a calloop command channel (UI thread to DnD thread) and the
   `DataSourceHandler` send/finish/cancelled handlers.
3. Inbound: `DataDeviceHandler` enter/motion/drop + `DragOffer` receive; read the
   `text/uri-list` pipe non-blocking; deliver paths to the UI (HUD + log).
4. Wire the Slint UI: a row drag triggers the native outbound drag; dropped paths
   surface in a HUD line.
5. macOS (`ssh m1`): outbound `NSDraggingSource`/`NSPasteboard` file URLs via
   objc2, inbound via winit `on_winit_window_event` + `DroppedFile`.
6. Windows (`ssh x13-win`): outbound `DoDragDrop`/`IDataObject` `CF_HDROP` via the
   `windows` crate, inbound via winit `DroppedFile`.

## Key files and commands

- `packages/desktop-app/file-manager/src/dnd_native.rs`: raw-handle extraction +
  per-OS `start` dispatch.
- `packages/desktop-app/file-manager/src/dnd_wayland.rs`: the Wayland
  `wl_data_device` adapter (Linux only).
- `packages/desktop-app/file-manager/src/app.rs`: single-shot timer calls
  `dnd_native::start(app.window())` once the window is realized.
- Build/lint/test: `mise run //packages/desktop-app/file-manager:{lint:clippy,lint:rust,test}`.
- Run the GUI (needs the Wayland session): `mise run //packages/desktop-app/file-manager:run`.
  The binary is `monochromatic-file-manager`; stop it with
  `pkill -f monochromatic-file-manager`.

## Related docs

- `docs/troubleshooting/slint-drag-and-drop-file-lists.md`: why stock Slint has no
  OS file drag-and-drop (the source trace + upstream `#1967` decision).
- `docs/planning/file-manager.md`: the plan and the drag-and-drop spike result.
- `docs/handover/slint-file-manager-assessment.md`: the earlier stack assessment.
