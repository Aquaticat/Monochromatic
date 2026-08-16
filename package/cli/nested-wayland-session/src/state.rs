//! The compositor's central state and its construction.
//!
//! `Compositor` is the single value the calloop event loop carries. It owns every
//! Wayland protocol sub-state (compositor, xdg-shell, shm, output, seat,
//! data-device), the desktop `Space` the one window lives on, the winit rendering
//! backend, and the dmabuf import state. Smithay compositors are structured as one
//! big owning struct like this; the per-protocol behaviour is split into the
//! `handler` module.

/// What:     `use std::{ffi::OsString, process::Child, sync::Arc};`. Three std types:
///             - `OsString`: an owned, OS-native string (bytes the OS uses for names;
///               sibling: the UTF-8 `String`). Wayland socket names come back as this.
///             - `Child`: a handle to a spawned OS process (from `std::process`).
///             - `Arc<T>`: an Atomically Reference-Counted shared owner of a heap
///               value (thread-safe sibling of the single-threaded `Rc<T>`; both
///               unlike `Box<T>`, which is a single owner).
/// Why:      The socket name is stored owned; the hosted app is a `Child`; new
///           Wayland clients are inserted behind an `Arc` because wayland-server
///           shares client data across threads.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // OsString ~ string; Child ~ a Node ChildProcess handle; Arc<T> ~ a shared ref.
/// ```
use std::{ffi::OsString, process::Child, sync::Arc};

/// What:     A grouped `use` of Smithay items. Each path names a type used below; the
///           braces just avoid repeating the common `smithay::...` prefix.
/// Why:      Bring the compositor building blocks into scope.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Space, Window, Seat, ... } from "smithay";
/// ```
use smithay::{
    backend::renderer::{damage::OutputDamageTracker, gles::GlesRenderer},
    backend::winit::WinitGraphicsBackend,
    desktop::{PopupManager, Space, Window},
    input::{Seat, SeatState},
    output::Output,
    reexports::{
        calloop::{generic::Generic, EventLoop, Interest, LoopHandle, LoopSignal, Mode, PostAction},
        wayland_server::{
            backend::{ClientData, ClientId, DisconnectReason},
            Display, DisplayHandle,
        },
    },
    utils::{Logical, Point},
    wayland::{
        compositor::{CompositorClientState, CompositorState},
        dmabuf::{DmabufFeedback, DmabufGlobal, DmabufState},
        output::OutputManagerState,
        selection::data_device::DataDeviceState,
        shell::xdg::XdgShellState,
        shm::ShmState,
        socket::ListeningSocketSource,
    },
};

/// The whole compositor, carried by the calloop event loop as its shared data.
///
/// What:     `pub struct Compositor { ... }`. A large record type owning every piece
///           of compositor state. Fields prefixed `_` (like `_dmabuf_global`) are
///           kept only so their `Drop` does not run early (dropping a global would
///           tear down that Wayland global); the leading underscore silences the
///           "unused field" lint.
/// Why:      Smithay dispatches protocol events by calling handler methods on one
///           `&mut State`, so all state a handler might touch lives here together.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Compositor { startTime; socketName; space; seat; backend; /* ... */ }
/// ```
pub struct Compositor {
    /// Monotonic clock start, used to timestamp frame-callback events to clients.
    ///
    /// What:     `pub start_time: std::time::Instant`. `Instant` is an opaque
    ///           monotonic timestamp (not a wall clock; siblings: `SystemTime`).
    /// Why:      `Window::send_frame` wants elapsed time since start.
    pub start_time: std::time::Instant,

    /// Name of the Wayland socket this compositor listens on, e.g. `wayland-1`.
    ///
    /// What:     `pub socket_name: OsString`. Owned OS string.
    /// Why:      Passed to the hosted child via `WAYLAND_DISPLAY` so it connects here.
    pub socket_name: OsString,

    /// Cloneable handle to the wayland-server display for inserting clients / globals.
    ///
    /// What:     `pub display_handle: DisplayHandle`. A cheap clone of the display's
    ///           control handle.
    /// Why:      Handlers create globals and look up clients through it.
    pub display_handle: DisplayHandle,

    /// The two-dimensional plane the single hosted window is mapped onto.
    ///
    /// What:     `pub space: Space<Window>`. `Space` maps `Window`s and `Output`s onto
    ///           a shared coordinate plane and drives rendering.
    /// Why:      Even a single-app fixture uses `Space` so it can reuse Smithay's
    ///           `render_output` helper.
    pub space: Space<Window>,

    /// Signal used to stop the event loop from anywhere (e.g. child exit).
    ///
    /// What:     `pub loop_signal: LoopSignal`. A handle whose `.stop()` ends the loop.
    /// Why:      The child-exit timer and the `CloseRequested` event both stop the loop.
    pub loop_signal: LoopSignal,

    /// wl_compositor / wl_subcompositor protocol state.
    ///
    /// What:     `pub compositor_state: CompositorState`.
    /// Why:      Tracks surface trees and buffer commits for all clients.
    pub compositor_state: CompositorState,

    /// xdg-shell protocol state (toplevels and popups).
    ///
    /// What:     `pub xdg_shell_state: XdgShellState`.
    /// Why:      The hosted app's main window is an xdg_toplevel.
    pub xdg_shell_state: XdgShellState,

    /// wl_shm (shared-memory buffers) protocol state.
    ///
    /// What:     `pub shm_state: ShmState`.
    /// Why:      Advertised for completeness; the GPU app uses dmabuf, but clients
    ///           expect wl_shm to exist, and cursor themes may use it.
    pub shm_state: ShmState,

    /// wl_output / xdg-output manager state.
    ///
    /// What:     `pub output_manager_state: OutputManagerState`.
    /// Why:      Advertises the nested screen's geometry to the client.
    pub output_manager_state: OutputManagerState,

    /// Seat (input device group) protocol state.
    ///
    /// What:     `pub seat_state: SeatState<Compositor>`. Generic over the state type
    ///           so it can call back into focus handling.
    /// Why:      Owns the keyboard/pointer the fixture injects synthetic input through.
    pub seat_state: SeatState<Compositor>,

    /// wl_data_device (clipboard / drag-and-drop) protocol state.
    ///
    /// What:     `pub data_device_state: DataDeviceState`.
    /// Why:      Needed so keyboard focus can carry a data-device offer; clients
    ///           expect it to exist.
    pub data_device_state: DataDeviceState,

    /// Tracker for xdg-shell popups (menus, tooltips).
    ///
    /// What:     `pub popups: PopupManager`.
    /// Why:      Slint may open popups; this keeps them configured and cleaned up.
    pub popups: PopupManager,

    /// The single seat all input flows through.
    ///
    /// What:     `pub seat: Seat<Compositor>`.
    /// Why:      Synthetic pointer/keyboard events are sent via this seat's handles.
    pub seat: Seat<Compositor>,

    /// The single nested output (screen) the app fills.
    ///
    /// What:     `pub output: Output`. A cloneable output handle.
    /// Why:      Resizing changes its mode; rendering and frame callbacks reference it.
    pub output: Output,

    /// The winit graphics backend: the nested window plus its GLES/EGL renderer.
    ///
    /// What:     `pub backend: WinitGraphicsBackend<GlesRenderer>`. Parameterised by
    ///           the renderer type it drives.
    /// Why:      Rendering, dmabuf import, and screenshot readback all go through it.
    pub backend: WinitGraphicsBackend<GlesRenderer>,

    /// Damage tracker that decides which screen regions need redrawing.
    ///
    /// What:     `pub damage_tracker: OutputDamageTracker`.
    /// Why:      `render_output` needs it to compute and submit damage efficiently.
    pub damage_tracker: OutputDamageTracker,

    /// dmabuf (GPU buffer sharing) protocol state.
    ///
    /// What:     `pub dmabuf_state: DmabufState`.
    /// Why:      The `DmabufHandler` imports client GPU buffers through it; this is
    ///           the whole point of hosting the real GPU render path.
    pub dmabuf_state: DmabufState,

    /// The dmabuf global, kept alive for the program's lifetime.
    ///
    /// What:     `pub _dmabuf_global: DmabufGlobal`. Underscore-prefixed: never read,
    ///           only held so dropping it does not remove the `zwp_linux_dmabuf_v1`
    ///           global from the display.
    /// Why:      Advertise dmabuf support to the client for as long as we run.
    pub _dmabuf_global: DmabufGlobal,

    /// The dmabuf v4 default feedback, or `None` when we fell back to v3.
    ///
    /// What:     `pub _dmabuf_feedback: Option<DmabufFeedback>`. Held for its lifetime.
    /// Why:      Keeps the negotiated modifier feedback alive; `None` means v3 (no
    ///           feedback) was used instead.
    pub _dmabuf_feedback: Option<DmabufFeedback>,

    /// The single hosted client process, if it has been spawned.
    ///
    /// What:     `pub child: Option<Child>`. `Some(child)` once spawned, `None` before.
    /// Why:      The exit-poll timer calls `try_wait` on it and stops the loop when it
    ///           exits, propagating the app's exit code.
    pub child: Option<Child>,

    /// Deadline for force-stopping client that ignores compositor close request.
    pub shutdown_deadline: Option<std::time::Instant>,

    /// The hosted app's exit code once it has exited, else `None`.
    ///
    /// What:     `pub child_exit_code: Option<i32>`. Signed 32-bit, matching a process
    ///           exit status code.
    /// Why:      `main` propagates this as its own exit code.
    pub child_exit_code: Option<i32>,

    /// The active 60fps frame recorder, if `record` is running.
    ///
    /// What:     `pub recorder: Option<crate::recorder::Recorder>`. `Some` while recording.
    /// Why:      Holds the capture timer registration, encoder pool, and counters; taken
    ///           out during each tick so the readback can borrow the rest of the state.
    pub recorder: Option<crate::recorder::Recorder>,

    /// A cloneable handle to the event loop, for registering the recorder's timer.
    ///
    /// What:     `pub loop_handle: LoopHandle<'static, Compositor>`. calloop's refcounted
    ///           handle; storing it in the loop's own data is a supported calloop pattern.
    /// Why:      The `record` control command (which only has `&mut Compositor`) needs it to
    ///           insert the capture timer source.
    pub loop_handle: LoopHandle<'static, Compositor>,

    /// The `text/uri-list` bytes an in-flight `drop-file` drag will hand the app.
    ///
    /// What:     `pub pending_dnd_uri_list: Option<Vec<u8>>`. `Some(bytes)` while a
    ///           compositor-originated drag is being driven toward the hosted app; `None`
    ///           otherwise. Sibling shapes: a `String` would force UTF-8, but the wire
    ///           format is raw bytes written to the client's receive fd.
    /// Why:      `ServerDndGrabHandler::send` (called when the app requests the drag data)
    ///           has only `&mut Compositor`, so the payload must be reachable from state.
    pub pending_dnd_uri_list: Option<Vec<u8>>,
}

/// Owning bundle of the pieces the winit backend produces before the state exists.
///
/// What:     `pub struct BackendPieces { ... }`. A small carrier so `run` can build
///           the backend, output, and dmabuf state, then hand them to
///           `Compositor::new` as one argument instead of six positional ones.
/// Why:      Keeps `Compositor::new` to a single grouped parameter (clearer than a
///           long positional list) and matches the repo's named-parameter preference.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type BackendPieces = { backend; output; dmabufState; dmabufGlobal; dmabufFeedback };
/// ```
pub struct BackendPieces {
    /// The winit backend (window + GLES renderer).
    pub backend: WinitGraphicsBackend<GlesRenderer>,
    /// The nested output.
    pub output: Output,
    /// dmabuf protocol state.
    pub dmabuf_state: DmabufState,
    /// The dmabuf global to keep alive.
    pub dmabuf_global: DmabufGlobal,
    /// The dmabuf v4 feedback, or `None` for v3.
    pub dmabuf_feedback: Option<DmabufFeedback>,
}

/// Constructors and helpers for the compositor state.
///
/// What:     `impl Compositor { ... }`. The inherent method block: construction, the
///           Wayland listener setup, and surface hit-testing.
/// Why:      Group the state's own (non-trait) behaviour.
impl Compositor {
    /// Build the full compositor state from an event loop, a display, and the
    /// already-initialised winit/dmabuf backend pieces.
    ///
    /// What:     `pub fn new(event_loop: &mut EventLoop<Compositor>, display:
    ///           Display<Compositor>, pieces: BackendPieces) -> Self`. Takes a mutable
    ///           borrow of the loop (to register sources and read its stop signal),
    ///           consumes the `display` by value (it is moved into an event source),
    ///           and consumes the backend pieces. Returns a fully built `Self`.
    /// Why:      One place that wires every protocol global and the client-listening
    ///           socket, then packages it all into the state value the loop carries.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// static new(eventLoop, display, pieces): Compositor { ... }
    /// ```
    ///
    /// @example
    /// ```ts
    /// const state = Compositor.new(eventLoop, display, pieces);
    /// ```
    pub fn new(
        event_loop: &mut EventLoop<'static, Compositor>,
        display: Display<Compositor>,
        pieces: BackendPieces,
    ) -> Self {
        // What:     `let start_time = std::time::Instant::now();`. Reads the monotonic
        //           clock now.
        // Why:      Baseline for frame-callback timestamps.
        let start_time = std::time::Instant::now();

        // What:     `let dh = display.handle();`. `.handle()` returns a cheap,
        //           cloneable `DisplayHandle` without consuming the display.
        // Why:      Global constructors below need the handle; the display itself is
        //           moved into the client-dispatch source afterwards.
        let dh = display.handle();

        // What:     `CompositorState::new::<Self>(&dh)`. The `::<Self>` turbofish tells
        //           the constructor which state type implements the handler trait;
        //           `&dh` lends the display handle read-only.
        // Why:      Registers the `wl_compositor` global.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const compositorState = CompositorState.new(dh);
        // ```
        let compositor_state = CompositorState::new::<Self>(&dh);

        // What:     `XdgShellState::new::<Self>(&dh)`. Registers `xdg_wm_base`.
        // Why:      The hosted app creates its window through xdg-shell.
        let xdg_shell_state = XdgShellState::new::<Self>(&dh);

        // What:     `ShmState::new::<Self>(&dh, vec![])`. `vec![]` is an empty `Vec` of
        //           extra SHM formats (the mandatory ARGB/XRGB are always added).
        // Why:      Advertise `wl_shm` even though the GPU app uses dmabuf.
        let shm_state = ShmState::new::<Self>(&dh, vec![]);

        // What:     `OutputManagerState::new_with_xdg_output::<Self>(&dh)`. Registers
        //           `wl_output` plus the `xdg-output` extension.
        // Why:      Report the nested screen's logical geometry to the client.
        let output_manager_state = OutputManagerState::new_with_xdg_output::<Self>(&dh);

        // What:     `let mut seat_state = SeatState::new();`. Mutable because
        //           `new_wl_seat` below borrows it mutably to create the seat.
        // Why:      Owns the collection of seats (we create exactly one).
        let mut seat_state = SeatState::new();

        // What:     `DataDeviceState::new::<Self>(&dh)`. Registers `wl_data_device_manager`.
        // Why:      Clipboard / DnD plumbing focus handling expects.
        let data_device_state = DataDeviceState::new::<Self>(&dh);

        // What:     `PopupManager::default()`. Builds an empty popup tracker.
        // Why:      Ready to track any popups the app opens.
        let popups = PopupManager::default();

        // What:     `let mut seat: Seat<Self> = seat_state.new_wl_seat(&dh, "winit");`.
        //           Creates a named seat and its `wl_seat` global. `mut` so we can add
        //           input capabilities to it next.
        // Why:      The single seat all synthetic input is routed through.
        let mut seat: Seat<Self> = seat_state.new_wl_seat(&dh, "winit");

        // What:     `seat.add_keyboard(Default::default(), 200, 25).unwrap();`.
        //           `Default::default()` supplies a default `XkbConfig` (US layout);
        //           `200, 25` are the key repeat delay (ms) and rate (keys/s).
        //           `.unwrap()` panics if keymap compilation fails (it should not with
        //           the default layout).
        // Why:      Advertise a keyboard so the app accepts synthetic key input.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // seat.addKeyboard(defaultXkbConfig, 200, 25); // throws on keymap failure
        // ```
        seat.add_keyboard(Default::default(), 200, 25).unwrap();

        // What:     `seat.add_pointer();`. Adds a pointer capability, returning a
        //           `PointerHandle` we ignore here (fetched later via `get_pointer`).
        // Why:      Advertise a pointer so the app accepts synthetic clicks.
        seat.add_pointer();

        // What:     `let mut space = Space::default();`. Empty plane. `mut` because we
        //           map the output into it next.
        // Why:      Holds the output and (later) the one window.
        let mut space = Space::default();

        // What:     `space.map_output(&pieces.output, (0, 0));`. Places the output at
        //           origin `(0, 0)` on the plane. `(0, 0)` is an `(i32, i32)` tuple
        //           coerced into Smithay's `Point`.
        // Why:      The window is rendered relative to this output's position.
        space.map_output(&pieces.output, (0, 0));

        // What:     `let damage_tracker = OutputDamageTracker::from_output(&pieces.output);`.
        //           Builds a damage tracker sized to the output.
        // Why:      `render_output` needs it to compute per-frame damage.
        let damage_tracker = OutputDamageTracker::from_output(&pieces.output);

        // What:     `let socket_name = Self::init_wayland_listener(display, event_loop);`.
        //           Consumes the display (moves it into the client-dispatch source) and
        //           returns the chosen socket name.
        // Why:      Start accepting Wayland client connections; capture the name for the
        //           child's `WAYLAND_DISPLAY`.
        let socket_name = Self::init_wayland_listener(display, event_loop);

        // What:     `let loop_signal = event_loop.get_signal();`. A handle to stop the
        //           loop later.
        // Why:      Stored so child-exit / close handling can end the program.
        let loop_signal = event_loop.get_signal();

        // What:     `let loop_handle = event_loop.handle();`. A cloneable registration
        //           handle for the loop.
        // Why:      Stored so the recorder can insert its capture timer from the control
        //           handler (which only receives `&mut Compositor`).
        let loop_handle = event_loop.handle();

        // What:     `Self { ... }`. Construct and return the state (tail expression).
        //           Shorthand fields reuse local names; the dmabuf pieces are unpacked
        //           from `pieces`.
        // Why:      Package every wired-up piece into the loop's shared data.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { startTime, socketName, displayHandle: dh, space, /* ... */ };
        // ```
        Self {
            start_time,
            socket_name,
            display_handle: dh,
            space,
            loop_signal,
            compositor_state,
            xdg_shell_state,
            shm_state,
            output_manager_state,
            seat_state,
            data_device_state,
            popups,
            seat,
            output: pieces.output,
            backend: pieces.backend,
            damage_tracker,
            dmabuf_state: pieces.dmabuf_state,
            _dmabuf_global: pieces.dmabuf_global,
            _dmabuf_feedback: pieces.dmabuf_feedback,
            child: None,
            shutdown_deadline: None,
            child_exit_code: None,
            recorder: None,
            loop_handle,
            pending_dnd_uri_list: None,
        }
    }

    /// Create the client-listening socket and register both it and the display with
    /// the event loop, returning the socket name.
    ///
    /// What:     `fn init_wayland_listener(display: Display<Compositor>, event_loop:
    ///           &mut EventLoop<Compositor>) -> OsString`. Private helper; consumes the
    ///           display (moves it into a loop source), returns the chosen socket name.
    /// Why:      Wayland needs two event sources: one accepting new client connections,
    ///           one dispatching existing clients' requests.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function initWaylandListener(display, eventLoop): string { ... }
    /// ```
    fn init_wayland_listener(
        display: Display<Compositor>,
        event_loop: &mut EventLoop<Compositor>,
    ) -> OsString {
        // What:     `let source = ListeningSocketSource::new_auto().unwrap();`. Creates
        //           a listening Unix socket, auto-picking the next free `wayland-N`
        //           name in `$XDG_RUNTIME_DIR`. `.unwrap()` panics on failure (no
        //           runtime dir).
        // Why:      This is the socket the hosted child connects to.
        let source = ListeningSocketSource::new_auto().unwrap();

        // What:     `let socket_name = source.socket_name().to_os_string();`.
        //           `.socket_name()` borrows the name as `&OsStr`; `.to_os_string()`
        //           copies it into an owned `OsString`.
        // Why:      Return an owned name that outlives the source.
        let socket_name = source.socket_name().to_os_string();

        // What:     `let handle = event_loop.handle();`. A cloneable handle used to
        //           register sources.
        // Why:      Needed to insert both sources below.
        let handle = event_loop.handle();

        // What:     `handle.insert_source(source, move |stream, _, state| { ... })`.
        //           Registers the listening socket; the `move` closure takes ownership
        //           of nothing here but captures by move per calloop's requirement. On
        //           each new connection it receives the client `stream`, the source
        //           metadata (`_`, ignored), and `&mut Compositor` (`state`).
        // Why:      Insert every arriving client into the display with its per-client data.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // handle.insertSource(source, (stream, _, state) => {
        //   state.displayHandle.insertClient(stream, new ClientState());
        // });
        // ```
        handle
            .insert_source(source, move |stream, _, state: &mut Compositor| {
                // What:     `state.display_handle.insert_client(stream,
                //           Arc::new(ClientState::default())).unwrap();`. Registers the
                //           new client. `Arc::new(...)` puts the per-client data on the
                //           heap behind a shared, thread-safe pointer (wayland-server
                //           requires `Arc`, not `Box`, because it may access the data
                //           from its own threads). `.unwrap()` panics on insert failure.
                // Why:      Give the client a place to keep its compositor-side state.
                state
                    .display_handle
                    .insert_client(stream, Arc::new(ClientState::default()))
                    .unwrap();
            })
            .expect("failed to register the Wayland listening socket");

        // What:     `handle.insert_source(Generic::new(display, Interest::READ,
        //           Mode::Level), |_, display, state| { ... })`. Wraps the display's
        //           file descriptor as a generic readable source. On readability it
        //           dispatches queued client requests.
        // Why:      This is what actually processes client protocol messages.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // handle.insertSource(new Generic(display, READ, LEVEL), (_, display, state) => {
        //   display.dispatchClients(state);
        //   return Continue;
        // });
        // ```
        handle
            .insert_source(
                Generic::new(display, Interest::READ, Mode::Level),
                |_, display, state: &mut Compositor| {
                    // What:     `unsafe { display.get_mut().dispatch_clients(state).unwrap(); }`.
                    //           `unsafe` marks a block whose safety the compiler cannot
                    //           check: here it is sound because we never drop the display
                    //           while dispatching. `get_mut` yields the inner `Display`;
                    //           `dispatch_clients` runs queued requests against `state`.
                    // Why:      Advance every connected client's protocol state.
                    // Gotcha:   `unsafe` in Rust does not mean "wrong"; it means the
                    //           caller vouches for an invariant (display stays alive).
                    unsafe {
                        display.get_mut().dispatch_clients(state).unwrap();
                    }
                    // What:     `Ok(PostAction::Continue)`. Tell calloop the source is
                    //           healthy and should keep listening. Tail expression.
                    // Why:      Keep dispatching on future readiness.
                    Ok(PostAction::Continue)
                },
            )
            .expect("failed to register the Wayland display source");

        // What:     `socket_name`. Bare tail expression returning the owned name.
        // Why:      Hand the chosen socket name back to `new`.
        socket_name
    }

    /// Find the surface (and its position) under a point on the plane, if any.
    ///
    /// What:     `pub fn surface_under(&self, pos: Point<f64, Logical>) ->
    ///           Option<(WlSurface, Point<f64, Logical>)>`. Borrows self read-only,
    ///           takes a floating-point logical point, returns the topmost surface
    ///           there plus its origin, or `None`.
    /// Why:      Pointer input needs to know which surface a click lands on so it can
    ///           set that surface as the pointer focus.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// surfaceUnder(pos): [WlSurface, Point] | undefined { ... }
    /// ```
    pub fn surface_under(
        &self,
        pos: Point<f64, Logical>,
    ) -> Option<(smithay::reexports::wayland_server::protocol::wl_surface::WlSurface, Point<f64, Logical>)>
    {
        // What:     `self.space.element_under(pos).and_then(|(window, location)| { ... })`.
        //           `element_under` returns `Option<(&Window, Point<i32, Logical>)>`.
        //           `.and_then(closure)` runs the closure only when present, and the
        //           closure itself returns an `Option`, flattening the result. The
        //           closure destructures the tuple into `window` and `location`.
        // Why:      Delegate hit-testing to the window's own surface tree.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const hit = space.elementUnder(pos);
        // if (!hit) return undefined;
        // const [window, location] = hit;
        // ...
        // ```
        self.space.element_under(pos).and_then(|(window, location)| {
            // What:     `window.surface_under(pos - location.to_f64(),
            //           WindowSurfaceType::ALL).map(|(s, p)| (s, (p + location).to_f64()))`.
            //           `location.to_f64()` converts the integer point to floating so it
            //           can be subtracted from `pos`. `surface_under` returns the surface
            //           under that window-local point. `.map(closure)` rewrites the
            //           found `(surface, point)` back into plane coordinates by adding
            //           `location`.
            // Why:      Translate between plane and window-local coordinates for the hit.
            window
                .surface_under(
                    pos - location.to_f64(),
                    smithay::desktop::WindowSurfaceType::ALL,
                )
                .map(|(surface, point)| (surface, (point + location).to_f64()))
        })
    }
}

/// Per-client compositor-side state stored behind an `Arc` for each Wayland client.
///
/// What:     `#[derive(Default)] pub struct ClientState { pub compositor_state:
///           CompositorClientState }`. `#[derive(Default)]` auto-generates a
///           `default()` constructor. Holds the compositor's per-client bookkeeping.
/// Why:      wayland-server hands this back whenever it needs client-scoped data (for
///           example, which `CompositorClientState` a surface belongs to).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class ClientState { compositorState = new CompositorClientState(); }
/// ```
#[derive(Default)]
pub struct ClientState {
    /// The compositor protocol's per-client sub-state.
    pub compositor_state: CompositorClientState,
}

/// Implement the wayland-server `ClientData` hooks for our per-client state.
///
/// What:     `impl ClientData for ClientState { ... }`. `ClientData` is the trait
///           wayland-server calls on connect/disconnect. Both hooks are empty here.
/// Why:      We do not need to react to client lifecycle beyond default behaviour, but
///           the trait must be implemented for `insert_client` to accept the type.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // implements ClientData { initialized() {} disconnected() {} }
/// ```
impl ClientData for ClientState {
    /// What:     `fn initialized(&self, _client_id: ClientId) {}`. Called once the
    ///           client is registered; the id is ignored (underscore prefix).
    /// Why:      Nothing to do on connect.
    fn initialized(&self, _client_id: ClientId) {}

    /// What:     `fn disconnected(&self, _client_id: ClientId, _reason:
    ///           DisconnectReason) {}`. Called when the client goes away.
    /// Why:      Nothing to do on disconnect; the exit-poll timer handles shutdown.
    fn disconnected(&self, _client_id: ClientId, _reason: DisconnectReason) {}
}
