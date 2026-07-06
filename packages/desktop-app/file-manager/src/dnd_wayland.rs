//! Native Wayland drag-and-drop over winit's own connection (Linux only).
//!
//! winit 0.30 has no Wayland drag-and-drop, so the file manager drives the
//! `wl_data_device` protocol itself. It cannot open a second Wayland connection,
//! because a drag's `start_drag` needs the input SERIAL of the pointer button
//! press that the compositor delivered to THIS client, and only the app's own
//! connection sees those. So this module wraps winit's existing `wl_display`
//! (`Backend::from_foreign_display` + `Connection::from_backend`) and runs a
//! second event queue on a dedicated thread, co-binding its own `wl_pointer` to
//! observe the same button presses (and their serials) winit sees. This is the
//! same architecture `smithay-clipboard` uses to add clipboard to winit apps.
//!
//! This first cut is the make-or-break probe the research flagged: prove that a
//! co-bound `wl_pointer` on the shared connection actually receives button
//! presses with serials. If it does, the drag source and drop destination are
//! ordinary sctk `data_device_manager` plumbing on top. If it does not, the whole
//! shared-connection approach is dead and the fix moves into a winit fork.
//!
//! Comment style: this is Wayland protocol plus FFI with no clean TypeScript
//! analogue, so per the project's Rust-comment rule the gnarly bits are wrapped in
//! small helpers and the concepts are explained in prose (a Wayland "serial" is a
//! monotonically increasing nonce the compositor stamps on input events; an
//! "event queue" is one dispatch lane over the shared socket; a "seat" is one
//! set of input devices), rather than a mechanical per-line TypeScript rewrite of
//! sctk trait boilerplate that has no TypeScript equivalent.

/// What:     `use std::ffi::c_void;` imports C's untyped-pointer target (`void`).
/// Why:      winit hands the `wl_display` back as a `*mut c_void`.
use std::ffi::c_void;

/// What:     `use std::ptr::NonNull;` imports the never-null pointer wrapper.
/// Why:      The display pointer comes in as `NonNull<c_void>` from the raw handle.
use std::ptr::NonNull;

/// What:     `use std::thread;` imports OS-thread spawning.
/// Why:      The Wayland event queue runs on its own thread so it never blocks
///           Slint's UI event loop.
use std::thread;

/// What:     `use std::time::Duration;` imports a time span.
/// Why:      The dispatch loop wakes on a bounded timeout.
use std::time::Duration;

/// What:     `use smithay_client_toolkit::reexports::calloop::EventLoop;` imports
///           the event loop that multiplexes the Wayland socket (and, later, a
///           command channel and drop pipes) on this thread.
/// Why:      sctk's data-device pipe reading and the drag command channel all
///           register as calloop sources, so the loop owns them uniformly.
use smithay_client_toolkit::reexports::calloop::EventLoop;

/// What:     `use ...::calloop_wayland_source::WaylandSource;` imports the adapter
///           that feeds one Wayland `EventQueue` into a calloop loop.
/// Why:      It performs the `prepare_read`/read dance that lets this queue share
///           the socket with winit's own dispatch without conflict.
use smithay_client_toolkit::reexports::calloop_wayland_source::WaylandSource;

/// What:     `use smithay_client_toolkit::registry::{ProvidesRegistryState,
///           RegistryState};` imports the global-registry helper and its trait.
/// Why:      Binding `wl_seat` (and later the data-device manager) goes through the
///           registry.
use smithay_client_toolkit::registry::{ProvidesRegistryState, RegistryState};

/// What:     `use smithay_client_toolkit::registry_handlers;` imports the macro that
///           lists which states react to global add/remove.
/// Why:      The seat state must be told when seats appear or vanish.
use smithay_client_toolkit::registry_handlers;

/// What:     `use smithay_client_toolkit::seat::{...};` imports the seat helper, its
///           capability enum, its handler trait, and the pointer handler plus the
///           left-button constant and pointer-event types.
/// Why:      This probe co-binds a pointer from the seat and reads its presses.
use smithay_client_toolkit::seat::{
    pointer::{PointerEvent, PointerEventKind, PointerHandler, BTN_LEFT},
    Capability, SeatHandler, SeatState,
};

/// What:     `use smithay_client_toolkit::{delegate_pointer, delegate_registry,
///           delegate_seat};` imports the macros that generate the low-level
///           `Dispatch` glue for those objects.
/// Why:      They wire compositor events to the handler traits implemented below.
use smithay_client_toolkit::{delegate_pointer, delegate_registry, delegate_seat};

/// What:     `use wayland_client::backend::Backend;` imports the FFI backend that
///           can wrap an existing `wl_display` pointer.
/// Why:      `Backend::from_foreign_display` is how this shares winit's connection.
use wayland_client::backend::Backend;

/// What:     `use wayland_client::globals::registry_queue_init;` imports the helper
///           that enumerates globals and returns a fresh event queue.
/// Why:      The shared connection gets its own second queue this way.
use wayland_client::globals::registry_queue_init;

/// What:     `use wayland_client::protocol::{wl_pointer::WlPointer,
///           wl_seat::WlSeat};` imports the two protocol object types held below.
/// Why:      The state stores the co-bound pointer and the seat it came from.
use wayland_client::protocol::{wl_pointer::WlPointer, wl_seat::WlSeat};

/// What:     `use wayland_client::{Connection, QueueHandle};` imports the shared
///           connection wrapper and the per-queue handle passed to sctk calls.
/// Why:      Everything is created against this connection and queue handle.
use wayland_client::{Connection, QueueHandle};

/// What:     `pub fn start(display: NonNull<c_void>)` spawns the drag-and-drop
///           thread that attaches to winit's Wayland connection. `NonNull<c_void>`
///           is winit's `wl_display` pointer, guaranteed non-null by the caller.
/// Why:      Called once, after the window is realized, so the pointer is live.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function start(display: Pointer): void { spawnThread(() => run(display)); }
/// ```
pub fn start(display: NonNull<c_void>) {
    // What:     `let display_addr = display.as_ptr() as usize;` copies the pointer
    //           as a plain integer so it can cross the thread boundary. A raw
    //           pointer is not `Send`, but the address value is, and libwayland's
    //           `wl_display` is safe to use from another thread.
    // Why:      `thread::spawn` requires everything it captures to be `Send`.
    // Gotcha:   This deliberately launders the pointer through `usize`; the safety
    //           argument (the display outlives the thread, libwayland is
    //           thread-safe) is the caller's contract, not the type system's.
    let display_addr = display.as_ptr() as usize;
    // What:     `thread::Builder::new().name(...).spawn(move || { ... })` starts a
    //           named OS thread running the Wayland loop.
    // Why:      Keep the Wayland dispatch off the UI thread; a name aids debugging.
    let spawned = thread::Builder::new()
        .name("dnd-wayland".to_owned())
        .spawn(move || {
            // What:     Rebuild the pointer from the integer inside the thread.
            // Why:      `run` wants the `wl_display` pointer back.
            run(display_addr as *mut c_void);
        });
    // What:     `if let Err(error) = spawned { ... }` logs a failed spawn instead of
    //           panicking the caller.
    // Why:      A missing DnD thread should degrade to "no native drag", not crash.
    if let Err(error) = spawned {
        tracing::error!(%error, "native DnD: failed to spawn Wayland thread");
    }
}

/// What:     `fn run(display: *mut c_void)` is the thread body: attach to winit's
///           connection, bind the seat, co-bind a pointer, and dispatch forever.
/// Why:      All Wayland work for the drag-and-drop adapter happens here.
fn run(display: *mut c_void) {
    // What:     `let backend = unsafe { Backend::from_foreign_display(display.cast())
    //           };` wraps winit's existing `wl_display` in a backend without opening
    //           a new connection. `.cast()` reinterprets `*mut c_void` as the
    //           `*mut wl_display` the function wants.
    // Why:      Sharing the connection is what makes the compositor deliver the same
    //           input serials to this client's co-bound pointer.
    // Gotcha:   `unsafe`: the caller promises the display stays valid for this
    //           thread's life (it lives as long as the app's event loop).
    let backend = unsafe { Backend::from_foreign_display(display.cast()) };
    // What:     `let connection = Connection::from_backend(backend);` builds the
    //           high-level connection over that shared backend.
    // Why:      sctk and the event queue work through a `Connection`.
    let connection = Connection::from_backend(backend);
    // What:     `let (globals, event_queue) = match registry_queue_init(...) { ... }`
    //           enumerates the compositor's globals and creates THIS thread's own
    //           event queue on the shared connection; a failure aborts the thread.
    // Why:      A second queue lets this thread dispatch independently of winit.
    let (globals, event_queue) = match registry_queue_init::<State>(&connection) {
        Ok(pair) => pair,
        Err(error) => {
            tracing::error!(%error, "native DnD: registry init failed");
            return;
        }
    };
    // What:     `let qh = event_queue.handle();` is the token sctk calls tag new
    //           objects with so their events route to this queue.
    // Why:      Every bind/get call needs it.
    let qh = event_queue.handle();
    // What:     `let mut event_loop = match EventLoop::try_new() { ... }` creates the
    //           calloop loop that will own the Wayland source.
    // Why:      calloop multiplexes the socket with (later) the drag command channel.
    let mut event_loop: EventLoop<State> = match EventLoop::try_new() {
        Ok(loop_) => loop_,
        Err(error) => {
            tracing::error!(%error, "native DnD: calloop init failed");
            return;
        }
    };
    // What:     `WaylandSource::new(connection.clone(), event_queue).insert(...)`
    //           registers the Wayland queue with the loop so reads are driven by it.
    // Why:      Ties socket readiness to calloop dispatch, with the correct
    //           `prepare_read` handshake that coexists with winit's dispatch.
    if let Err(error) =
        WaylandSource::new(connection.clone(), event_queue).insert(event_loop.handle())
    {
        tracing::error!(error = %error.error, "native DnD: WaylandSource insert failed");
        return;
    }
    // What:     `let mut state = State { ... }` builds the dispatch state: the
    //           registry helper, the seat helper, no pointer yet, and a zero serial.
    // Why:      sctk threads all events through this one mutable value.
    let mut state = State {
        registry_state: RegistryState::new(&globals),
        seat_state: SeatState::new(&globals, &qh),
        pointer: None,
        latest_serial: 0,
    };
    // What:     `tracing::info!(...)` records that the shared connection attached.
    // Why:      Confirms the FFI wrap and registry init succeeded on a real session.
    tracing::info!("native DnD: attached to winit Wayland connection, awaiting input");
    // What:     `loop { if event_loop.dispatch(...).is_err() { break; } }` pumps the
    //           loop forever, waking at least every 200 ms.
    // Why:      Drive Wayland (and later drag) events until the app exits; a dispatch
    //           error means the connection died, so stop.
    loop {
        if event_loop
            .dispatch(Duration::from_millis(DISPATCH_TIMEOUT_MS), &mut state)
            .is_err()
        {
            tracing::info!("native DnD: Wayland dispatch ended");
            break;
        }
    }
}

/// What:     `const DISPATCH_TIMEOUT_MS: u64 = 200;` bounds one dispatch wait.
/// Why:      Wake periodically so a future stop-flag or command is noticed promptly.
const DISPATCH_TIMEOUT_MS: u64 = 200;

/// What:     `struct State { ... }` is the dispatch state sctk mutates: the registry
///           helper, the seat helper, the co-bound pointer once it exists, and the
///           latest button-press serial observed.
/// Why:      One value carries everything the handler callbacks read and write.
struct State {
    /// What:     `registry_state: RegistryState` tracks compositor globals.
    /// Why:      Required by sctk to route seat hotplug.
    registry_state: RegistryState,
    /// What:     `seat_state: SeatState` tracks seats and mints input devices.
    /// Why:      The pointer is created from it.
    seat_state: SeatState,
    /// What:     `pointer: Option<WlPointer>` is the co-bound pointer, once a seat
    ///           announces the pointer capability. `Option` because it does not
    ///           exist until then.
    /// Why:      Holding it keeps it alive so its events keep arriving.
    pointer: Option<WlPointer>,
    /// What:     `latest_serial: u32` is the serial of the most recent left-button
    ///           press this client saw.
    /// Why:      A drag's `start_drag` must quote this serial; the probe just logs it.
    latest_serial: u32,
}

/// What:     `impl SeatHandler for State { ... }` reacts to seats and their
///           capabilities, co-binding a pointer when one is announced.
/// Why:      The pointer is the source of button-press serials.
impl SeatHandler for State {
    /// What:     `fn seat_state(&mut self) -> &mut SeatState` hands sctk the seat
    ///           helper.
    /// Why:      sctk mutates it during dispatch.
    fn seat_state(&mut self) -> &mut SeatState {
        &mut self.seat_state
    }

    /// What:     `fn new_seat(...)` fires when a seat appears; nothing to do.
    /// Why:      Devices are created on capability, not on seat creation.
    fn new_seat(&mut self, _: &Connection, _: &QueueHandle<Self>, _: WlSeat) {}

    /// What:     `fn new_capability(...)` fires when a seat gains a device class; a
    ///           pointer capability makes this co-bind its own `wl_pointer`.
    /// Why:      This co-bound pointer is what receives the same presses winit sees.
    fn new_capability(
        &mut self,
        _conn: &Connection,
        qh: &QueueHandle<Self>,
        seat: WlSeat,
        capability: Capability,
    ) {
        // What:     `if capability == Capability::Pointer && self.pointer.is_none()`
        //           only binds the first pointer, once.
        // Why:      One pointer is enough to observe presses; avoid duplicates.
        if capability == Capability::Pointer && self.pointer.is_none() {
            // What:     `match self.seat_state.get_pointer(qh, &seat) { ... }` asks
            //           the compositor for a pointer object on this shared seat.
            // Why:      This is the co-bound pointer whose serials mirror winit's.
            match self.seat_state.get_pointer(qh, &seat) {
                Ok(pointer) => {
                    tracing::info!("native DnD: co-bound wl_pointer on shared seat");
                    self.pointer = Some(pointer);
                }
                Err(error) => tracing::error!(%error, "native DnD: get_pointer failed"),
            }
        }
    }

    /// What:     `fn remove_capability(...)` fires when a device class disappears;
    ///           drop the pointer if it was the one removed.
    /// Why:      Release the object so it is not used after the compositor drops it.
    fn remove_capability(
        &mut self,
        _: &Connection,
        _: &QueueHandle<Self>,
        _: WlSeat,
        capability: Capability,
    ) {
        // What:     `if capability == Capability::Pointer { self.pointer = None; }`
        //           forgets the pointer.
        // Why:      A gone capability means the pointer object is invalid.
        if capability == Capability::Pointer {
            self.pointer = None;
        }
    }

    /// What:     `fn remove_seat(...)` fires when a seat vanishes; nothing to do.
    /// Why:      The pointer is already handled by `remove_capability`.
    fn remove_seat(&mut self, _: &Connection, _: &QueueHandle<Self>, _: WlSeat) {}
}

/// What:     `impl PointerHandler for State { ... }` receives batched pointer events
///           and records the serial of each left-button press.
/// Why:      Confirms the co-bound pointer really gets presses + serials, which is
///           the whole point of this probe.
impl PointerHandler for State {
    /// What:     `fn pointer_frame(...)` delivers one atomic batch of pointer events.
    /// Why:      Wayland groups related pointer events into a frame.
    fn pointer_frame(
        &mut self,
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
        _pointer: &WlPointer,
        events: &[PointerEvent],
    ) {
        // What:     `for event in events { ... }` walks each event in the frame.
        // Why:      A frame may carry motion plus a press together.
        for event in events {
            // What:     `if let PointerEventKind::Press { button, serial, .. } =
            //           event.kind { ... }` matches only button-press events, pulling
            //           the button code and the compositor's serial.
            // Why:      Presses are the events a drag's serial must come from.
            if let PointerEventKind::Press { button, serial, .. } = event.kind {
                // What:     `if button == BTN_LEFT { ... }` keeps only left-button
                //           presses. `BTN_LEFT` is the Linux input code for the main
                //           button.
                // Why:      A drag is started with the primary button.
                if button == BTN_LEFT {
                    // What:     `self.latest_serial = serial;` stores the serial.
                    // Why:      A real drag would quote this in `start_drag`.
                    self.latest_serial = serial;
                    // What:     `tracing::info!(serial, "...")` proves the co-bound
                    //           pointer received the press with its serial.
                    // Why:      This log is the pass/fail signal of the probe.
                    tracing::info!(
                        serial,
                        "native DnD: co-bound pointer saw a left-button press (serial captured)"
                    );
                }
            }
        }
    }
}

/// What:     `impl ProvidesRegistryState for State { ... }` exposes the registry and
///           lists which states handle global changes.
/// Why:      `delegate_registry!` and seat hotplug need it.
impl ProvidesRegistryState for State {
    /// What:     `fn registry(&mut self) -> &mut RegistryState` hands back the helper.
    /// Why:      sctk mutates it during global events.
    fn registry(&mut self) -> &mut RegistryState {
        &mut self.registry_state
    }
    // What:     `registry_handlers![SeatState];` declares the seat state as the one
    //           that reacts to global add/remove.
    // Why:      Only the seat is dynamically tracked in this probe.
    registry_handlers![SeatState];
}

// What:     The `delegate_*!` macros generate the `Dispatch` trait impls that route
//           raw protocol events to the handler traits above. They are separate from
//           the trait impls because sctk splits "what to do" (the handler traits)
//           from "wire the objects" (these macros).
// Why:      Without them the compositor's events would not reach the handlers.
delegate_seat!(State);
delegate_pointer!(State);
delegate_registry!(State);
