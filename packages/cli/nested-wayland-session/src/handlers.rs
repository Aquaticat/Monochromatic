//! Wayland protocol handler implementations for `Compositor`.
//!
//! Smithay dispatches each protocol's events by calling trait methods on the state.
//! This file holds the seat (input focus), data-device (clipboard), and output
//! handlers plus their `delegate_*!` glue; the compositor/shm, xdg-shell, and dmabuf
//! handlers live in the submodules declared below.

/// What:     `pub mod compositor;`. Declares the `compositor` submodule from
///           `src/handlers/compositor.rs` and re-exports it publicly.
/// Why:      Holds the surface-commit and shared-memory handlers.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as compositor from "./handlers/compositor";
/// ```
pub mod compositor;

/// What:     `pub mod xdg_shell;`. Declares the xdg-shell submodule.
/// Why:      Holds the toplevel/popup handler that maps the app fullscreen.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as xdgShell from "./handlers/xdg_shell";
/// ```
pub mod xdg_shell;

/// What:     `pub mod dmabuf;`. Declares the dmabuf submodule.
/// Why:      Holds the GPU-buffer import handler.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as dmabuf from "./handlers/dmabuf";
/// ```
pub mod dmabuf;

/// What:     Grouped `use` of the seat, output, data-device, and delegate items.
/// Why:      Bring the traits and macros the impls below need into scope.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { SeatHandler, OutputHandler, ... } from "smithay";
/// ```
use smithay::{
    delegate_data_device, delegate_output, delegate_seat,
    input::{Seat, SeatHandler, SeatState},
    reexports::wayland_server::{protocol::wl_surface::WlSurface, Resource},
    wayland::{
        output::OutputHandler,
        selection::{
            data_device::{
                set_data_device_focus, ClientDndGrabHandler, DataDeviceHandler, DataDeviceState,
                ServerDndGrabHandler,
            },
            SelectionHandler,
        },
    },
};

/// What:     `use crate::state::Compositor;`. `crate::` is "this crate's root".
/// Why:      All the handler impls are `impl Trait for Compositor`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Compositor } from "../state";
/// ```
use crate::state::Compositor;

/// Implement the seat (input focus) handler for the compositor.
///
/// What:     `impl SeatHandler for Compositor`. Declares the focus types and the
///           hooks Smithay calls when focus changes. The three associated types are
///           all `WlSurface`: keyboard, pointer, and touch focus are all surfaces.
/// Why:      Tells Smithay how focus is represented and lets us mirror keyboard focus
///           onto the data device (clipboard).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // implements SeatHandler with focus types = WlSurface
/// ```
impl SeatHandler for Compositor {
    /// Keyboard focus is a surface.
    type KeyboardFocus = WlSurface;
    /// Pointer focus is a surface.
    type PointerFocus = WlSurface;
    /// Touch focus is a surface.
    type TouchFocus = WlSurface;

    /// What:     `fn seat_state(&mut self) -> &mut SeatState<Compositor>`. Hands
    ///           Smithay a mutable borrow of our seat state.
    /// Why:      Smithay mutates seat bookkeeping through this accessor.
    fn seat_state(&mut self) -> &mut SeatState<Compositor> {
        // What:     `&mut self.seat_state`. A mutable borrow of the field (tail expr).
        // Why:      Return the seat state Smithay asked for.
        &mut self.seat_state
    }

    /// What:     `fn cursor_image(&mut self, _seat: &Seat<Self>, _image:
    ///           CursorImageStatus) {}`. Called when the client sets a cursor; both
    ///           arguments ignored.
    /// Why:      A headless testing fixture draws no cursor, so this is a no-op.
    fn cursor_image(
        &mut self,
        _seat: &Seat<Self>,
        _image: smithay::input::pointer::CursorImageStatus,
    ) {
    }

    /// What:     `fn focus_changed(&mut self, seat: &Seat<Self>, focused:
    ///           Option<&WlSurface>)`. Called when keyboard focus moves; `focused` is
    ///           the newly focused surface or `None`.
    /// Why:      Keep the data device's focus in sync so clipboard offers reach the
    ///           focused client.
    fn focus_changed(&mut self, seat: &Seat<Self>, focused: Option<&WlSurface>) {
        // What:     `let dh = &self.display_handle;`. Borrow the display handle.
        // Why:      Needed to resolve a surface to its client below.
        let dh = &self.display_handle;

        // What:     `let client = focused.and_then(|s| dh.get_client(s.id()).ok());`.
        //           `.and_then(closure)` runs only when a surface is focused. `s.id()`
        //           is the surface's protocol id; `dh.get_client(id)` returns
        //           `Result<Client, _>`; `.ok()` converts that to `Option<Client>`
        //           (dropping the error). The overall result is `Option<Client>`.
        // Why:      Find which client owns the focused surface.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const client = focused ? tryGetClient(dh, focused.id()) : undefined;
        // ```
        let client = focused.and_then(|s| dh.get_client(s.id()).ok());

        // What:     `set_data_device_focus(dh, seat, client);`. Free function that
        //           points the seat's data device at that client.
        // Why:      So the focused client can read/write the clipboard selection.
        set_data_device_focus(dh, seat, client);
    }
}

// What:     `delegate_seat!(Compositor);`. A macro that generates the wayland-server
//           `Dispatch`/`GlobalDispatch` boilerplate wiring `wl_seat` to our handler.
// Why:      Without it the protocol requests would have nowhere to dispatch.
//
// In TS you'd write (pseudocode):
// ```ts
// // registerSeatDispatch(Compositor);
// ```
delegate_seat!(Compositor);

/// Implement the selection (clipboard) handler.
///
/// What:     `impl SelectionHandler for Compositor { type SelectionUserData = (); }`.
///           The associated type `()` is the unit type (an empty tuple, "no data"),
///           meaning we attach no extra data to selections.
/// Why:      Required companion trait for the data device; we keep it minimal.
impl SelectionHandler for Compositor {
    /// No extra per-selection data.
    type SelectionUserData = ();
}

/// Implement the data-device (clipboard / DnD) handler.
///
/// What:     `impl DataDeviceHandler for Compositor`. Exposes the data-device state.
/// Why:      Smithay routes clipboard requests through this accessor.
impl DataDeviceHandler for Compositor {
    /// What:     `fn data_device_state(&self) -> &DataDeviceState`. Read-only borrow.
    /// Why:      Smithay reads the data-device state through it.
    fn data_device_state(&self) -> &DataDeviceState {
        // What:     `&self.data_device_state`. Borrow the field (tail expression).
        // Why:      Hand Smithay the state.
        &self.data_device_state
    }
}

/// What:     `impl ClientDndGrabHandler for Compositor {}`. Empty impl: accept the
///           default (no custom client drag-and-drop grab behaviour).
/// Why:      Required by the data-device delegate; defaults suffice for a fixture.
impl ClientDndGrabHandler for Compositor {}

/// What:     `impl ServerDndGrabHandler for Compositor {}`. Empty impl for
///           server-initiated drag-and-drop.
/// Why:      Same as above; defaults suffice.
impl ServerDndGrabHandler for Compositor {}

// What:     `delegate_data_device!(Compositor);`. Generates the data-device dispatch glue.
// Why:      Wire `wl_data_device_manager` to our handler.
delegate_data_device!(Compositor);

/// What:     `impl OutputHandler for Compositor {}`. Empty impl; the default output
///           behaviour is all a single-output fixture needs.
/// Why:      Required to delegate `wl_output`.
impl OutputHandler for Compositor {}

// What:     `delegate_output!(Compositor);`. Generates the output dispatch glue.
// Why:      Wire `wl_output` / xdg-output to our (default) handler.
delegate_output!(Compositor);
