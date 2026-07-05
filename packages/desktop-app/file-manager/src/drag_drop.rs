//! The internal pane-to-pane drag-and-drop handlers, the Rust half of the
//! drag-and-drop spike. Slint 1.17.0's in-process `DragArea`/`DropArea` carry an
//! opaque `data-transfer` value whose app-local payload is set and read through
//! host-language callbacks; this module implements those callbacks. A dragged row
//! packs its (pane, row) identity into the transfer's `user_data`, and the pane a
//! drop lands on reads it back, so the drop knows exactly which row moved where
//! and whether it was a copy or a move. The payload carries ONLY `user_data` (no
//! plain text, no image), which keeps the drag fully in-window on every backend:
//! Slint only offers a native OS drag when the payload has serializable text or
//! image, so a `user_data`-only drag never leaves the window and behaves the same
//! on the winit and Qt backends. None of these mutate the columns model, so they
//! never rebuild a column or disturb scrolling.

/// What:     `use std::rc::Rc;` imports single-thread reference counting (siblings:
///           `Arc` for cross-thread sharing, `Box` for a unique owner).
/// Why:      The drag payload is handed to Slint as an `Rc<dyn Any>`, the shared
///           pointer `DataTransfer::set_user_data` stores.
use std::rc::Rc;

/// What:     `use slint::language::{DragAction, DropEvent};` imports the drop event
///           struct and the negotiated-action enum, both made public in Slint
///           1.17.0 (they were private builtins in 1.16.1).
/// Why:      The drop callbacks receive a `DropEvent` and return a `DragAction`.
use slint::language::{DragAction, DropEvent};

/// What:     `use slint::private_unstable_api::re_exports::DataTransfer;` imports the
///           opaque drag-payload type. In crates.io Slint 1.17.0 this is the ONLY
///           reachable path: the crate-root `slint::DataTransfer` alias landed after
///           1.17.0, and the bare `private_unstable_api::DataTransfer` is a private
///           glob import (E0603). The stable public path is the `pub use` inside the
///           `pub mod re_exports`, even though the enclosing module is `#[doc(hidden)]`
///           ("compatibility is not guaranteed"). This is a spike-scale accommodation;
///           a production build should pin a Slint that re-exports it at the crate root.
/// Why:      `make_drag_data` constructs one of these to hand back to the UI.
use slint::private_unstable_api::re_exports::DataTransfer;

/// What:     `use crate::controller::Controller;` imports the app-state owner this
///           module adds a method to.
/// Why:      This file is a fourth `impl Controller` block, beside `menu.rs`.
use crate::controller::Controller;

/// What:     `struct DragIdentity { source_pane_id: i32, source_row: i32 }` is the
///           typed payload attached to a drag via `DataTransfer::set_user_data`.
///           A plain record of two 32-bit signed integers (`i32`, matching Slint's
///           `int`; sibling widths `i64`/`u32` are not used because the ids come
///           straight from and go straight back to Slint's `int`).
/// Why:      The drop target downcasts the transfer's `user_data` back to this to
///           learn which row the drag came from.
struct DragIdentity {
    /// What:     `source_pane_id: i32` is the id of the pane the drag started in.
    /// Why:      Identifies the source pane for the recorded drop.
    source_pane_id: i32,
    /// What:     `source_row: i32` is the row index within that pane.
    /// Why:      Identifies the source row for the recorded drop.
    source_row: i32,
}

/// What:     `pub fn make_drag_data(pane_id: i32, row_index: i32) -> DataTransfer`
///           builds the drag payload for one row. It is a free function (not a
///           `Controller` method) so the UI can call it while evaluating the
///           `DragArea.data` binding without borrowing the shared `Controller`.
/// Why:      Slint reads `DragArea.data` when a drag begins; this packs the row's
///           app-local identity into that payload.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function makeDragData(paneId: number, rowIndex: number): DataTransfer {
///   const t = new DataTransfer();
///   t.userData = { sourcePaneId: paneId, sourceRow: rowIndex };
///   return t;
/// }
/// ```
pub fn make_drag_data(pane_id: i32, row_index: i32) -> DataTransfer {
    // What:     `let mut transfer = DataTransfer::default();` makes an empty payload
    //           (no text, no image, no user data). `mut` because the next line
    //           mutates it through `&mut self` methods.
    // Why:      Start from empty and attach only the app-local identity.
    let mut transfer = DataTransfer::default();
    // What:     `transfer.set_user_data(Rc::new(DragIdentity { ... }));`. `Rc::new`
    //           heap-allocates the identity and hands back a shared pointer, which
    //           coerces to the `Rc<dyn Any>` the setter takes. NO `set_plain_text`
    //           and NO `set_image` are called.
    // Why:      Keeping the payload `user_data`-only means Slint never offers a
    //           native OS drag for it, so the drag stays in-window on every backend
    //           and is deterministic to drive headlessly.
    transfer.set_user_data(Rc::new(DragIdentity {
        source_pane_id: pane_id,
        source_row: row_index,
    }));
    // What:     `transfer` is the tail expression (no trailing `;`), so it is the
    //           return value.
    // Why:      Hand the populated payload back to the UI's `DragArea.data`.
    transfer
}

/// What:     `fn drag_action_label(action: DragAction) -> &'static str` maps the
///           negotiated action to a short word. `&'static str` is a borrowed string
///           slice that lives for the whole program (the literals are baked into
///           the binary), so no allocation and no owner is needed.
/// Why:      The HUD read-back and the log show "move"/"copy"/"link"/"none" so a
///           reader can confirm copy and move are distinguishable end to end.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function dragActionLabel(action: DragAction): string { ... }
/// ```
fn drag_action_label(action: DragAction) -> &'static str {
    // What:     An if/else chain over the enum (this crate forbids `match` for
    //           simple control flow and forbids `switch`); each arm is a tail
    //           string. `DragAction::Copy` etc. name the enum's variants.
    // Why:      Turn the action into a stable label.
    if action == DragAction::Copy {
        "copy"
    } else if action == DragAction::Move {
        "move"
    } else if action == DragAction::Link {
        "link"
    } else {
        "none"
    }
}

/// What:     `pub fn pane_can_drop(event: &DropEvent) -> DragAction` decides whether
///           a hovering drag may drop on a pane, and with which action. `&DropEvent`
///           borrows the event read-only (a lend, not a move). It is a free function
///           because the decision needs no `Controller` state.
/// Why:      The `DropArea.can-drop` callback runs on every drag-move; accepting our
///           own payloads is a cheap, stateless test.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function paneCanDrop(event: DropEvent): DragAction {
///   return event.data.userData instanceof DragIdentity ? event.proposedAction : DragAction.None;
/// }
/// ```
pub fn pane_can_drop(event: &DropEvent) -> DragAction {
    // What:     `event.data.user_data()` returns `Option<Rc<dyn Any>>` (the payload
    //           or nothing); `.and_then(|rc| rc.downcast::<DragIdentity>().ok())`
    //           tries to reinterpret that shared pointer as our identity type,
    //           turning the `Result` into an `Option` with `.ok()`; `.is_some()`
    //           reports whether it worked.
    // Why:      Only accept drags that carry one of our rows.
    let is_ours = event
        .data
        .user_data()
        .and_then(|rc| rc.downcast::<DragIdentity>().ok())
        .is_some();
    // What:     `if is_ours { event.proposed-action } else { none }`. `throw + return
    //           early` shape: reject up front when it is not our payload.
    // Why:      Mirror the action the runtime negotiated from the modifier keys.
    if !is_ours {
        // What:     `return DragAction::None;` rejects the drop; early return.
        // Why:      A foreign payload is not droppable in this in-app spike.
        return DragAction::None;
    }
    // What:     `event.proposed_action` is the action the runtime settled from the
    //           source's allowed set and any held modifier; tail expression.
    // Why:      Accept with whatever move/copy the negotiation chose.
    event.proposed_action
}

/// What:     `impl Controller` attaches the drop handler that records a completed
///           drag for the HUD and the log.
/// Why:      The drop is the one step that needs the shared instrumentation, so it
///           lives on the controller, unlike the two stateless free functions above.
impl Controller {
    /// What:     `pub fn on_pane_dropped(&self, event: &DropEvent, target_pane_id: i32)
    ///           -> DragAction` records a drop and returns the action performed.
    ///           `&self` (not `&mut self`) because it only writes through the shared
    ///           instrumentation's interior mutability.
    /// Why:      This is the read-back that proves the drag carried the correct
    ///           app-local identity across to the target, and that move and copy are
    ///           distinguishable.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// onPaneDropped(event: DropEvent, targetPaneId: number): DragAction { ... }
    /// ```
    pub fn on_pane_dropped(&self, event: &DropEvent, target_pane_id: i32) -> DragAction {
        // What:     `let Some(identity) = event.data.user_data().and_then(|rc|
        //           rc.downcast::<DragIdentity>().ok()) else { return None };`. This
        //           `let ... else` binds the downcast payload or bails on the `else`.
        // Why:      A drop with no recognizable payload records nothing.
        let Some(identity) = event
            .data
            .user_data()
            .and_then(|rc| rc.downcast::<DragIdentity>().ok())
        else {
            // What:     `return DragAction::None;` rejects an unrecognized drop.
            // Why:      Nothing to record or move.
            return DragAction::None;
        };
        // What:     `let action = event.proposed_action;` reads the negotiated action
        //           (move/copy/link) copied out of the event.
        // Why:      Both the return value and the recorded label use it.
        let action = event.proposed_action;
        // What:     `self.instrumentation.set_last_drop(format!(...));` formats the
        //           source (pane, row), the target pane, and the action word, then
        //           stores it. `format!` builds an owned `String` (like a template
        //           literal). `identity.source_pane_id` reads the payload's field.
        // Why:      The HUD mirrors this exact string as the drop read-back.
        self.instrumentation.set_last_drop(format!(
            "row {} of pane #{} -> pane #{} ({})",
            identity.source_row,
            identity.source_pane_id,
            target_pane_id,
            drag_action_label(action),
        ));
        // What:     `tracing::info!(...)` logs the drop with structured fields
        //           (`tracing` is Rust's structured logger, the analogue of the
        //           tagged TS logger); the trailing string is the message.
        // Why:      A terminal run shows each drop, its identity, and its action.
        tracing::info!(
            source_pane_id = identity.source_pane_id,
            source_row = identity.source_row,
            target_pane_id,
            action = drag_action_label(action),
            "internal pane-to-pane drop",
        );
        // What:     `action` is the tail expression, returned to the `DropArea` (and
        //           on to the source's `drag-finished`).
        // Why:      Report the action the runtime should finalize.
        action
    }
}

/// What:     `#[cfg(test)] #[path = "drag_drop_tests.rs"] mod tests;` declares the
///           unit tests from the flat sibling file only in test builds. `#[cfg(test)]`
///           gates it to `cargo test`; `#[path = "..."]` points at the sibling file
///           instead of a `tests/` subdirectory, matching `window`/`preview`.
/// Why:      Keep the copy/move-distinction test beside the code without spending
///           this file's line budget (test files are exempt from the linter).
#[cfg(test)]
#[path = "drag_drop_tests.rs"]
mod tests;
