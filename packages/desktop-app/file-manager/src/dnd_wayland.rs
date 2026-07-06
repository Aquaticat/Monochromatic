//! Native Wayland drag-and-drop over winit's own connection (Linux only).
//!
//! winit 0.30 has no Wayland drag-and-drop, so the file manager drives the
//! `wl_data_device` protocol itself. It cannot open a second Wayland connection,
//! because the compositor delivers drag offers and pointer serials only to the
//! app's own client connection. So this module wraps winit's existing `wl_display`
//! (`Backend::from_foreign_display` + `Connection::from_backend`) and runs a second
//! event queue on a dedicated thread, co-binding its own `wl_data_device` (for
//! drops) and `wl_pointer` (for the button serial an outbound drag will need).
//! This is the architecture `smithay-clipboard` uses to add clipboard to winit
//! apps; the co-bound-pointer serial was validated first (it receives the same
//! presses winit does).
//!
//! Implemented here: INBOUND. A file dragged from the OS file manager onto the app
//! delivers its `text/uri-list` here, which is read off a pipe and handed to the
//! caller's `on_drop` callback. OUTBOUND (dragging a file out) is the next
//! milestone and will reuse the co-bound pointer's press serial.
//!
//! Comment style: this is Wayland protocol plus FFI with no clean TypeScript
//! analogue, so the concepts are explained in prose (a Wayland "serial" is a nonce
//! the compositor stamps on input; a "data offer" is an incoming clipboard/drag
//! payload; "receive" hands you a pipe file descriptor to read the bytes from)
//! rather than a per-line TypeScript rewrite of sctk trait boilerplate.

/// What:     `use std::ffi::c_void;` imports C's untyped-pointer target.
/// Why:      winit hands the `wl_display` back as `*mut c_void`.
use std::ffi::c_void;

/// What:     `use std::io::Read;` brings the `read` method into scope.
/// Why:      The dropped `text/uri-list` bytes are read from a pipe file.
use std::io::Read;

/// What:     `use std::ptr::NonNull;` imports the never-null pointer wrapper.
/// Why:      The display pointer arrives as `NonNull<c_void>`.
use std::ptr::NonNull;

/// What:     `use std::thread;` imports OS-thread spawning.
/// Why:      The Wayland event queue runs off the UI thread.
use std::thread;

/// What:     `use std::time::Duration;` imports a time span.
/// Why:      The dispatch loop wakes on a bounded timeout.
use std::time::Duration;

/// What:     `use ...::data_device::{DataDevice, DataDeviceHandler};` imports the
///           per-seat data device and the trait that reacts to drag/drop events.
/// Why:      The data device is what receives an inbound drag.
use smithay_client_toolkit::data_device_manager::data_device::{DataDevice, DataDeviceHandler};

/// What:     `use ...::data_offer::{DataOfferHandler, DragOffer};` imports the
///           incoming-offer handler trait and the in-flight drag offer type.
/// Why:      A drop is read from a `DragOffer`.
use smithay_client_toolkit::data_device_manager::data_offer::{DataOfferHandler, DragOffer};

/// What:     `use ...::data_source::DataSourceHandler;` imports the outbound-source
///           handler trait.
/// Why:      `delegate_data_device!` requires it even though outbound is not built
///           yet; its methods are empty stubs for now.
use smithay_client_toolkit::data_device_manager::data_source::DataSourceHandler;

/// What:     `use ...::data_device_manager::{DataDeviceManagerState, WritePipe};`
///           imports the manager state and the write end used by an outbound source.
/// Why:      The manager binds `wl_data_device_manager` and mints data devices.
use smithay_client_toolkit::data_device_manager::{DataDeviceManagerState, WritePipe};

/// What:     `use ...::calloop::{EventLoop, LoopHandle, PostAction};` imports the
///           event loop, its handle, and the "keep/remove this source" enum.
/// Why:      The loop multiplexes the Wayland socket and the drop-read pipe.
use smithay_client_toolkit::reexports::calloop::{EventLoop, LoopHandle, PostAction};

/// What:     `use ...::calloop_wayland_source::WaylandSource;` feeds one Wayland
///           queue into the calloop loop.
/// Why:      It performs the `prepare_read` handshake so this queue shares the
///           socket with winit's dispatch without conflict.
use smithay_client_toolkit::reexports::calloop_wayland_source::WaylandSource;

/// What:     `use ...::registry::{ProvidesRegistryState, RegistryState};` imports the
///           global-registry helper and its trait.
/// Why:      Seat and data-device-manager binding go through the registry.
use smithay_client_toolkit::registry::{ProvidesRegistryState, RegistryState};

/// What:     `use ...::registry_handlers;` imports the macro listing states that
///           react to global add/remove.
/// Why:      The seat state must hear about seat hotplug.
use smithay_client_toolkit::registry_handlers;

/// What:     `use ...::seat::pointer::{...};` imports the pointer handler trait, the
///           pointer-event types, and the left-button constant.
/// Why:      The co-bound pointer captures the press serial an outbound drag needs.
use smithay_client_toolkit::seat::pointer::{
    PointerEvent, PointerEventKind, PointerHandler, BTN_LEFT,
};

/// What:     `use ...::seat::{Capability, SeatHandler, SeatState};` imports the seat
///           helper, capability enum, and handler trait.
/// Why:      The pointer and data device are minted from the seat.
use smithay_client_toolkit::seat::{Capability, SeatHandler, SeatState};

/// What:     `use smithay_client_toolkit::{delegate_data_device, delegate_pointer,
///           delegate_registry, delegate_seat};` imports the `Dispatch`-glue macros.
/// Why:      They route raw protocol events to the handler traits below.
use smithay_client_toolkit::{
    delegate_data_device, delegate_pointer, delegate_registry, delegate_seat,
};

/// What:     `use wayland_client::backend::Backend;` imports the FFI backend.
/// Why:      `Backend::from_foreign_display` shares winit's connection.
use wayland_client::backend::Backend;

/// What:     `use wayland_client::globals::registry_queue_init;` imports the global
///           enumerator that returns a fresh event queue.
/// Why:      This thread gets its own queue on the shared connection.
use wayland_client::globals::registry_queue_init;

/// What:     `use wayland_client::protocol::{...};` imports the protocol object types
///           the handlers name: the data device, drag actions, the data source, the
///           pointer, the seat, and the surface (in the drag-enter signature).
/// Why:      Handler signatures and state fields use these types.
use wayland_client::protocol::{
    wl_data_device::WlDataDevice, wl_data_device_manager::DndAction,
    wl_data_source::WlDataSource, wl_pointer::WlPointer, wl_seat::WlSeat,
    wl_surface::WlSurface,
};

/// What:     `use wayland_client::{Connection, QueueHandle};` imports the shared
///           connection wrapper and the per-queue handle.
/// Why:      Everything is created against these.
use wayland_client::{Connection, QueueHandle};

/// What:     `const URI_LIST: &str = "text/uri-list";` is the MIME type OS file
///           managers use for a dragged file list.
/// Why:      The one type the app accepts on an inbound drag.
const URI_LIST: &str = "text/uri-list";

/// What:     `const DISPATCH_TIMEOUT_MS: u64 = 200;` bounds one dispatch wait.
/// Why:      Wake periodically so a future stop-flag or command is noticed.
const DISPATCH_TIMEOUT_MS: u64 = 200;

/// What:     `const READ_CHUNK: usize = 4096;` is the pipe read buffer size.
/// Why:      Read the dropped uri-list in page-sized chunks.
const READ_CHUNK: usize = 4096;

/// What:     `type OnDrop = Box<dyn Fn(Vec<String>) + Send>;` is the callback the app
///           supplies to receive the paths of an inbound drop. `Box<dyn Fn ...>` is
///           an owned, heap-stored closure; `+ Send` lets it cross to this thread.
/// Why:      The adapter is generic UI-wise: it just reports dropped paths.
type OnDrop = Box<dyn Fn(Vec<String>) + Send>;

/// What:     `pub fn start<F>(display: NonNull<c_void>, on_drop: F)` spawns the
///           drag-and-drop thread. `F: Fn(Vec<String>) + Send + 'static` is the
///           drop callback; `display` is winit's `wl_display`.
/// Why:      Called once, after the window is realized, so the connection is live.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function start(display: Pointer, onDrop: (paths: string[]) => void): void { ... }
/// ```
pub fn start<F>(display: NonNull<c_void>, on_drop: F)
where
    F: Fn(Vec<String>) + Send + 'static,
{
    // What:     `let display_addr = display.as_ptr() as usize;` launders the pointer
    //           through an integer so it can cross the thread boundary (a raw pointer
    //           is not `Send`, but the address is, and libwayland is thread-safe).
    // Why:      `thread::spawn` requires `Send` captures.
    let display_addr = display.as_ptr() as usize;
    // What:     `let on_drop: OnDrop = Box::new(on_drop);` boxes the callback.
    // Why:      Store it uniformly regardless of the concrete closure type.
    let on_drop: OnDrop = Box::new(on_drop);
    // What:     Spawn the named Wayland thread running `run`.
    // Why:      Keep Wayland dispatch off the UI thread.
    let spawned = thread::Builder::new()
        .name("dnd-wayland".to_owned())
        .spawn(move || run(display_addr as *mut c_void, on_drop));
    // What:     Log a failed spawn instead of panicking the caller.
    // Why:      A missing DnD thread degrades to "no native drag", not a crash.
    if let Err(error) = spawned {
        tracing::error!(%error, "native DnD: failed to spawn Wayland thread");
    }
}

/// What:     `fn run(display: *mut c_void, on_drop: OnDrop)` is the thread body:
///           attach to winit's connection, bind the seat, data device, and pointer,
///           and dispatch forever.
/// Why:      All Wayland work for the adapter happens here.
fn run(display: *mut c_void, on_drop: OnDrop) {
    // What:     Wrap winit's existing `wl_display` in a backend without a new
    //           connection. `unsafe`: the caller promises the display outlives this
    //           thread (it lives as long as the app's event loop).
    // Why:      Sharing the connection is what delivers the same drag offers and
    //           serials this client sees.
    let backend = unsafe { Backend::from_foreign_display(display.cast()) };
    // What:     Build the high-level connection over that shared backend.
    // Why:      sctk and the event queue work through a `Connection`.
    let connection = Connection::from_backend(backend);
    // What:     Enumerate globals and make this thread's own event queue.
    // Why:     A second queue dispatches independently of winit.
    let (globals, event_queue) = match registry_queue_init::<State>(&connection) {
        Ok(pair) => pair,
        Err(error) => {
            tracing::error!(%error, "native DnD: registry init failed");
            return;
        }
    };
    // What:     `let qh = event_queue.handle();` tags new objects to this queue.
    // Why:      Every bind/get call needs it.
    let qh = event_queue.handle();
    // What:     Create the calloop loop that owns the Wayland source and drop pipes.
    // Why:      It multiplexes the socket with each drop's read pipe.
    let mut event_loop: EventLoop<State> = match EventLoop::try_new() {
        Ok(loop_) => loop_,
        Err(error) => {
            tracing::error!(%error, "native DnD: calloop init failed");
            return;
        }
    };
    // What:     `let loop_handle = event_loop.handle();` is the token used to add the
    //           per-drop read pipes as sources.
    // Why:     A drop's `receive` pipe is registered on this handle.
    let loop_handle = event_loop.handle();
    // What:     Feed the Wayland queue into the loop.
    // Why:      Ties socket readiness to calloop, coexisting with winit's dispatch.
    if let Err(error) =
        WaylandSource::new(connection.clone(), event_queue).insert(event_loop.handle())
    {
        tracing::error!(error = %error.error, "native DnD: WaylandSource insert failed");
        return;
    }
    // What:     Build the dispatch state, binding the data-device manager global now.
    // Why:      sctk threads every event through this one value; the manager mints
    //           the per-seat data device that receives drops.
    let mut state = State {
        registry_state: RegistryState::new(&globals),
        seat_state: SeatState::new(&globals, &qh),
        data_device_manager_state: DataDeviceManagerState::bind(&globals, &qh)
            .expect("wl_data_device_manager global should be present"),
        pointer: None,
        data_device: None,
        loop_handle,
        on_drop,
        latest_serial: 0,
    };
    // What:     Log that the shared connection attached.
    // Why:      Confirms the FFI wrap and registry init on a real session.
    tracing::info!("native DnD: attached to winit Wayland connection, awaiting drops");
    // What:     Pump the loop forever, waking at least every 200 ms.
    // Why:      Drive Wayland and drop-pipe events until the app exits.
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

/// What:     `struct State { ... }` is the dispatch state: registry and seat helpers,
///           the data-device manager, the co-bound pointer and per-seat data device,
///           the loop handle for registering drop pipes, the drop callback, and the
///           latest press serial (for the future outbound drag).
/// Why:      One value carries everything the handler callbacks read and write.
struct State {
    /// What:     `registry_state: RegistryState` tracks compositor globals.
    /// Why:      Required by sctk to route seat hotplug.
    registry_state: RegistryState,
    /// What:     `seat_state: SeatState` mints input devices and the data device.
    /// Why:      The pointer and data device come from it.
    seat_state: SeatState,
    /// What:     `data_device_manager_state: DataDeviceManagerState` is the bound
    ///           `wl_data_device_manager`.
    /// Why:      It creates the per-seat data device.
    data_device_manager_state: DataDeviceManagerState,
    /// What:     `pointer: Option<WlPointer>` is the co-bound pointer once a seat
    ///           announces the capability.
    /// Why:      Holding it keeps its events (and serials) arriving; read for the
    ///           `is_none` guard so it is not rebound.
    pointer: Option<WlPointer>,
    /// What:     `data_device: Option<DataDevice>` is the per-seat data device.
    /// Why:      Inbound drags arrive on it; read in the drop handler.
    data_device: Option<DataDevice>,
    /// What:     `loop_handle: LoopHandle<'static, State>` registers drop read pipes.
    /// Why:      A drop's `receive` returns a pipe that is read as a calloop source.
    loop_handle: LoopHandle<'static, State>,
    /// What:     `on_drop: OnDrop` is the app's dropped-paths callback.
    /// Why:      The adapter reports paths without knowing the UI.
    on_drop: OnDrop,
    /// What:     `latest_serial: u32` is the most recent left-button press serial.
    /// Why:      The outbound drag (next milestone) quotes it in `start_drag`; kept
    ///           now so the pointer plumbing that captures it is in place.
    latest_serial: u32,
}

/// What:     `impl SeatHandler for State { ... }` reacts to seats, minting the data
///           device on a new seat and co-binding a pointer on the pointer capability.
/// Why:      Both are needed: the data device for drops, the pointer for serials.
impl SeatHandler for State {
    /// What:     Hand sctk the seat helper.
    /// Why:      sctk mutates it during dispatch.
    fn seat_state(&mut self) -> &mut SeatState {
        &mut self.seat_state
    }

    /// What:     `fn new_seat(...)` fires when a seat appears; create its data device.
    /// Why:      Inbound drags are delivered on the seat's data device.
    fn new_seat(&mut self, _conn: &Connection, qh: &QueueHandle<Self>, seat: WlSeat) {
        // What:     `if self.data_device.is_none() { ... }` creates the device once.
        // Why:      One window means one seat of interest.
        if self.data_device.is_none() {
            self.data_device = Some(self.data_device_manager_state.get_data_device(qh, &seat));
            tracing::info!("native DnD: data device bound on shared seat");
        }
    }

    /// What:     `fn new_capability(...)` co-binds a pointer when announced.
    /// Why:      The pointer supplies the press serial for a future outbound drag.
    fn new_capability(
        &mut self,
        _conn: &Connection,
        qh: &QueueHandle<Self>,
        seat: WlSeat,
        capability: Capability,
    ) {
        // What:     Bind the first pointer, once.
        // Why:      One pointer is enough; avoid duplicates.
        if capability == Capability::Pointer && self.pointer.is_none() {
            match self.seat_state.get_pointer(qh, &seat) {
                Ok(pointer) => self.pointer = Some(pointer),
                Err(error) => tracing::error!(%error, "native DnD: get_pointer failed"),
            }
        }
    }

    /// What:     `fn remove_capability(...)` drops the pointer if it went away.
    /// Why:      Do not use an object the compositor invalidated.
    fn remove_capability(
        &mut self,
        _: &Connection,
        _: &QueueHandle<Self>,
        _: WlSeat,
        capability: Capability,
    ) {
        if capability == Capability::Pointer {
            self.pointer = None;
        }
    }

    /// What:     `fn remove_seat(...)` fires when a seat vanishes; nothing to do.
    /// Why:      The device/pointer are handled elsewhere.
    fn remove_seat(&mut self, _: &Connection, _: &QueueHandle<Self>, _: WlSeat) {}
}

/// What:     `impl PointerHandler for State { ... }` records the serial of each
///           left-button press.
/// Why:      The outbound drag will `start_drag` with that serial.
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
        // What:     Walk the frame; store the serial of a left-button press. The
        //           let-chain matches the press AND the left button in one condition.
        // Why:      Keep the latest grab serial ready for an outbound drag.
        for event in events {
            if let PointerEventKind::Press { button, serial, .. } = event.kind
                && button == BTN_LEFT
            {
                self.latest_serial = serial;
            }
        }
    }
}

/// What:     `impl DataDeviceHandler for State { ... }` reacts to an inbound drag:
///           accept `text/uri-list` on enter, read it on drop.
/// Why:      This is the inbound half of native drag-and-drop.
impl DataDeviceHandler for State {
    /// What:     `fn enter(...)` fires when a drag enters the window; accept the
    ///           uri-list mime and a copy action so the compositor offers the drop.
    /// Why:      A drag not accepted here delivers no drop.
    fn enter(
        &mut self,
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
        _device: &WlDataDevice,
        _x: f64,
        _y: f64,
        _surface: &WlSurface,
    ) {
        // What:     Get the in-flight drag offer, or bail if this is our own drag.
        // Why:      Only external drags carry a uri-list to accept.
        let Some(offer) = self.data_device.as_ref().and_then(|dd| dd.data().drag_offer()) else {
            return;
        };
        // What:     `if offers_uri_list(&offer) { ... }` accepts only when a file list
        //           is on offer.
        // Why:      Reject drags that are not files.
        if offers_uri_list(&offer) {
            offer.accept_mime_type(offer.serial, Some(URI_LIST.to_string()));
            offer.set_actions(DndAction::Copy, DndAction::Copy);
        }
    }

    /// What:     `fn motion(...)` fires as the drag moves; nothing to track yet.
    /// Why:      Pane-level drop targeting is a later refinement.
    fn motion(&mut self, _: &Connection, _: &QueueHandle<Self>, _: &WlDataDevice, _: f64, _: f64) {}

    /// What:     `fn leave(...)` fires when the drag leaves; nothing to undo.
    /// Why:      No per-drag visual state is held yet.
    fn leave(&mut self, _: &Connection, _: &QueueHandle<Self>, _: &WlDataDevice) {}

    /// What:     `fn selection(...)` fires for a clipboard offer; ignored (this is
    ///           drag-and-drop, not clipboard).
    /// Why:      Only drops are handled here.
    fn selection(&mut self, _: &Connection, _: &QueueHandle<Self>, _: &WlDataDevice) {}

    /// What:     `fn drop_performed(...)` fires on release over the window; read the
    ///           dropped uri-list off a pipe and report the paths.
    /// Why:      This is where an inbound file drop is finally delivered to the app.
    fn drop_performed(
        &mut self,
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
        _device: &WlDataDevice,
    ) {
        // What:     Get the drag offer, or bail (an internal drop has none here).
        // Why:      Only an external drop carries a uri-list to read.
        let Some(offer) = self.data_device.as_ref().and_then(|dd| dd.data().drag_offer()) else {
            return;
        };
        // What:     Bail if it did not offer a file list.
        // Why:      Nothing to read otherwise.
        if !offers_uri_list(&offer) {
            return;
        }
        // What:     `let read_pipe = match offer.receive(...) { ... }` asks the source
        //           to write the uri-list into a pipe, returning the read end.
        // Why:      Wayland transfers the payload out-of-band through a pipe fd.
        let read_pipe = match offer.receive(URI_LIST.to_string()) {
            Ok(pipe) => pipe,
            Err(error) => {
                tracing::error!(%error, "native DnD: receive failed");
                return;
            }
        };
        // What:     Confirm the action so the source completes the drop.
        // Why:      The source waits for a finalized action before sending.
        offer.accept_mime_type(offer.serial, Some(URI_LIST.to_string()));
        offer.set_actions(DndAction::Copy, DndAction::Copy);
        // What:     `let mut buffer = Vec::new();` accumulates bytes across reads.
        // Why:      The pipe may deliver the uri-list in several chunks.
        let mut buffer: Vec<u8> = Vec::new();
        // What:     `let offer = offer.clone();` keeps the offer alive to finish it.
        // Why:      The read closure finishes/destroys it on EOF.
        let offer = offer.clone();
        // What:     Register the pipe as a calloop source; the closure reads until EOF
        //           then parses the uri-list, reports the paths, and finishes the
        //           offer. `move` captures `buffer` and `offer` across re-entries.
        // Why:      Non-blocking, off the render path; the loop wakes it as data lands.
        let inserted = self.loop_handle.insert_source(read_pipe, move |_, file, state| {
            // What:     `let file: &mut std::fs::File = unsafe { file.get_mut() };`
            //           reborrows the pipe as a file. `unsafe`: valid as long as the
            //           fd is not closed here.
            // Why:      Read the bytes the source is writing.
            let file: &mut std::fs::File = unsafe { file.get_mut() };
            // What:     `let mut chunk = [0u8; READ_CHUNK];` is a stack read buffer.
            // Why:      Read a page at a time.
            let mut chunk = [0u8; READ_CHUNK];
            // What:     `match file.read(&mut chunk) { ... }` reads once.
            // Why:      Accumulate, finish on EOF, retry on interrupt.
            match file.read(&mut chunk) {
                // What:     `Ok(0)` is EOF: parse and report, then finish the offer.
                // Why:      The whole uri-list has arrived.
                Ok(0) => {
                    let paths = crate::dnd_wayland_parse::parse_uri_list(&buffer);
                    tracing::info!(count = paths.len(), "native DnD: inbound drop received");
                    (state.on_drop)(paths);
                    offer.finish();
                    offer.destroy();
                    PostAction::Remove
                }
                // What:     `Ok(n)` accumulates the `n` bytes read.
                // Why:      More may follow.
                Ok(n) => {
                    buffer.extend_from_slice(&chunk[..n]);
                    PostAction::Continue
                }
                // What:     `Err` of kind Interrupted/WouldBlock retries later.
                // Why:      Transient; the source fires again when readable.
                Err(error)
                    if matches!(
                        error.kind(),
                        std::io::ErrorKind::Interrupted | std::io::ErrorKind::WouldBlock
                    ) =>
                {
                    PostAction::Continue
                }
                // What:     Any other error abandons the read and finishes the offer.
                // Why:      Do not leak the offer or spin on a broken pipe.
                Err(error) => {
                    tracing::error!(%error, "native DnD: drop read failed");
                    offer.finish();
                    offer.destroy();
                    PostAction::Remove
                }
            }
        });
        // What:     Log a failed source registration.
        // Why:      Surface the rare case the pipe could not be watched.
        if let Err(error) = inserted {
            tracing::error!(%error, "native DnD: could not watch drop pipe");
        }
    }
}

/// What:     `impl DataOfferHandler for State { ... }` negotiates the offer's action.
/// Why:      The compositor asks which action the target wants.
impl DataOfferHandler for State {
    /// What:     `fn source_actions(...)` reports what the source allows; pin to copy.
    /// Why:      This prototype treats an inbound drop as a copy.
    fn source_actions(
        &mut self,
        _: &Connection,
        _: &QueueHandle<Self>,
        offer: &mut DragOffer,
        _actions: DndAction,
    ) {
        offer.set_actions(DndAction::Copy, DndAction::Copy);
    }

    /// What:     `fn selected_action(...)` reports the chosen action; nothing to do.
    /// Why:      Copy is the only action this prototype performs.
    fn selected_action(
        &mut self,
        _: &Connection,
        _: &QueueHandle<Self>,
        _: &mut DragOffer,
        _: DndAction,
    ) {
    }
}

/// What:     `impl DataSourceHandler for State { ... }` handles OUTBOUND source
///           events. Every method is an empty stub for now.
/// Why:      `delegate_data_device!` requires the trait; the outbound drag milestone
///           will fill these in (write the uri-list on `send_request`, clean up on
///           `cancelled`/`dnd_finished`).
impl DataSourceHandler for State {
    /// What:     `fn accept_mime(...)`: a drop target accepted a mime; unused yet.
    /// Why:      Outbound not built.
    fn accept_mime(&mut self, _: &Connection, _: &QueueHandle<Self>, _: &WlDataSource, _: Option<String>) {}

    /// What:     `fn send_request(...)`: write the payload to `_pipe`; unused yet.
    /// Why:      Outbound not built.
    fn send_request(&mut self, _: &Connection, _: &QueueHandle<Self>, _: &WlDataSource, _: String, _pipe: WritePipe) {}

    /// What:     `fn cancelled(...)`: the drag was cancelled; unused yet.
    /// Why:      Outbound not built.
    fn cancelled(&mut self, _: &Connection, _: &QueueHandle<Self>, _: &WlDataSource) {}

    /// What:     `fn dnd_dropped(...)`: the drop happened; unused yet.
    /// Why:      Outbound not built.
    fn dnd_dropped(&mut self, _: &Connection, _: &QueueHandle<Self>, _: &WlDataSource) {}

    /// What:     `fn dnd_finished(...)`: the drag finished; unused yet.
    /// Why:      Outbound not built.
    fn dnd_finished(&mut self, _: &Connection, _: &QueueHandle<Self>, _: &WlDataSource) {}

    /// What:     `fn action(...)`: negotiated action changed; unused yet.
    /// Why:      Outbound not built.
    fn action(&mut self, _: &Connection, _: &QueueHandle<Self>, _: &WlDataSource, _: DndAction) {}
}

/// What:     `impl ProvidesRegistryState for State { ... }` exposes the registry and
///           lists the seat state as the one reacting to global changes.
/// Why:      `delegate_registry!` and seat hotplug need it.
impl ProvidesRegistryState for State {
    /// What:     Hand back the registry helper.
    /// Why:      sctk mutates it on global events.
    fn registry(&mut self) -> &mut RegistryState {
        &mut self.registry_state
    }
    // What:     Declare the seat state as the dynamically-tracked global.
    // Why:      Only the seat is hotplug-tracked here.
    registry_handlers![SeatState];
}

/// What:     `fn offers_uri_list(offer: &DragOffer) -> bool` reports whether the drag
///           offers a `text/uri-list` (a file list).
/// Why:      The app accepts only file drops.
fn offers_uri_list(offer: &DragOffer) -> bool {
    // What:     `offer.with_mime_types(|mimes| mimes.iter().any(|m| m == URI_LIST))`
    //           inspects the offered mime list. `.any(...)` is true if one matches.
    // Why:      Presence of the uri-list mime is the "is a file drop" test.
    offer.with_mime_types(|mimes| mimes.iter().any(|mime| mime == URI_LIST))
}

// What:     The `delegate_*!` macros generate the `Dispatch` impls routing raw
//           protocol events to the handler traits above.
// Why:      Without them the compositor's events would not reach the handlers.
delegate_seat!(State);
delegate_pointer!(State);
delegate_data_device!(State);
delegate_registry!(State);
