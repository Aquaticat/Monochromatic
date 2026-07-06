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

## Current state (2026-07-06)

Committed:

- Baseline plus the in-process drag-and-drop spike (`drag_drop.rs`) and its
  troubleshooting doc.
- `63f72cc81` native DnD foundation: `dnd_native.rs` extracts the Wayland handles;
  verified on a real Wayland session (`backend=wayland`).
- `0540a43a3` milestone 1 (serial probe): shares winit's connection on a dedicated
  thread, co-binds a `wl_pointer`. VALIDATED: the co-bound pointer receives real
  left-button presses with serials (the one flagged risk is resolved, so the
  shared-connection approach is sound).
- `51b79e537` inbound file drop: the `wl_data_device` adapter accepts a dragged
  `text/uri-list`, reads it off the receive pipe on drop, parses `file://` URIs to
  paths, and reports them to a HUD line (`hud-f`) via a callback. Row padding and a
  `MONOCHROMATIC_FM_NO_NATIVE_DND` escape hatch added. Parsing split into
  `dnd_wayland_parse`.

- `dd6f05319` fix: create the data device in `SeatHandler::new_capability`, NOT
  `new_seat` (`new_seat` does not fire for a seat already present at startup, so the
  device was never bound). Startup now logs `data device bound on shared seat`.
- `0cbd72f2e` diagnostics: log the drag `enter` (with offered mime types),
  accept/not-accept, `leave`, and `drop_performed`.

### OPEN PROBLEM: inbound drop from dolphin does not register

After the `new_capability` fix, dragging `hello.txt` from dolphin onto the app
STILL does nothing (user: "Still doesn't work"), and the handlers were silent, so
it is unknown whether the drag even reaches the co-bound `wl_data_device`. The
`0cbd72f2e` diagnostics were added to answer that but have not been observed yet
(the manual test loop was too unreliable to get a clean signal, which is why the
approach changed to automated testing, below).

Leading hypothesis: unlike the co-bound `wl_pointer` (which the compositor
broadcasts to every pointer the client bound, VALIDATED), the compositor may not
deliver drag `enter`/`drop` to a co-bound `wl_data_device` the same way, or dolphin
under kwin routes the drag differently. This must be confirmed from the enter/drop
diagnostics under a controlled, scripted drag.

Note: `MONOCHROMATIC_FM_NO_NATIVE_DND=1` disables the whole native adapter, and the
app behaves the same, so the adapter is not breaking anything; the inbound drop
just is not arriving/handled.

## Next session: automate DnD testing in the nested compositor (decided with user)

Manual drags on the real kwin desktop gave no clean signal. The plan (user's
direction) is to make DnD testing automatic in `packages/cli/nested-wayland-session`
(a Smithay-based nested compositor that already hosts one app, injects input via its
own seat over a Unix-socket control API, and screenshots).

Key finding that shapes this: **Smithay 0.7.0 has server-originated drag-and-drop**,
so the compositor can BE the drag peer and no second app (dolphin) is needed:

- `smithay::wayland::selection::data_device::start_dnd(dh, seat, data, serial,
  pointer_start_data, touch_start_data, metadata: SourceMetadata)` starts a
  compositor-originated drag. `SourceMetadata` carries the mime types (set
  `text/uri-list`) and dnd action.
- `ServerDndGrabHandler` (trait) handles the server source's `send`/`finished`, so
  the compositor writes the `file:///path` uri-list when the hosted app requests it.
- `ClientDndGrabHandler` handles a drag the hosted app STARTS (for the outbound
  test), so the compositor can observe and complete it.
- `set_data_device_focus` / `request_data_device_client_selection` are also present.

Plan for the nested compositor (`src/state.rs` already binds `DataDeviceState`):

1. Add control commands (extend `src/protocol.rs` parse + the handler):
   - `drop-file PATH [X Y]`: the compositor `start_dnd`s a server source advertising
     `text/uri-list` = `file://PATH`, grabs the pointer, moves it over the hosted
     app (at X,Y or centre), and releases. Implement `ServerDndGrabHandler::send` to
     write the uri-list. This exercises the app's INBOUND path.
   - `drag X1 Y1 X2 Y2 [button]`: a press-move-release the app can turn into an
     outbound drag; `ClientDndGrabHandler` + reading the offered data verifies the
     app's OUTBOUND path.
2. Build the nested compositor in its Fedora container
   (`mise run //packages/cli/nested-wayland-session:build`; host lacks
   `wayland-server` dev headers, so it uses podman/Containerfile).
3. Run it hosting `monochromatic-file-manager`, script `drop-file /tmp/hello.txt`,
   `screenshot`, and read `hud-f` / the app log for `native DnD: inbound drop
   received` and the path. This finally gives a deterministic inbound test, and will
   show (via the app's enter/drop diagnostics) why the dolphin drag did not register.
4. If server-originated `start_dnd` cannot reproduce a real cross-client drag well
   enough, fall back to hosting dolphin side-by-side (the user authorized this):
   that needs a two-tile layout + pointer routing by x-position in the compositor.

Only after the inbound test passes deterministically: build the app's OUTBOUND drag
(reuse the co-bound pointer's captured `latest_serial` +
`create_drag_and_drop_source`/`start_drag` + the `DataSourceHandler` send/finish
stubs already present in `dnd_wayland.rs`), then macOS and Windows.

Smithay clone for reference (throwaway): `/tmp/agent/smithay-dnd-0.7.0`.

## Remaining milestones

1. Automated inbound test in the nested compositor (above); diagnose why the real
   dolphin drag did not register.
2. App OUTBOUND drag: `create_drag_and_drop_source` + `start_drag(latest_serial)` +
   fill the `DataSourceHandler` send/finish/cancelled stubs; verify (drop onto the
   compositor's server target, or dolphin).
3. macOS (`ssh m1`): outbound `NSDraggingSource`/`NSPasteboard` file URLs via objc2;
   inbound via winit `on_winit_window_event` + `DroppedFile` (winit HAS DnD on
   macOS, unlike Wayland).
4. Windows (`ssh x13-win`): outbound `DoDragDrop`/`IDataObject` `CF_HDROP` via the
   `windows` crate; inbound via winit `DroppedFile`.

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
