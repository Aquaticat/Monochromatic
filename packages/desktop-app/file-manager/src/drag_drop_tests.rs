// What:     Unit tests for `drag_drop.rs`, pulled in by
//           `#[cfg(test)] #[path = "drag_drop_tests.rs"] mod tests;` at the bottom
//           of `drag_drop.rs`. Reaches the parent items via `use super::*`.
// Why:      Cover the two deterministic halves of the drag-and-drop logic: the
//           payload carries the row identity, and copy and move are distinguishable.
//           The event-driven accept/reject branches are exercised by the headless
//           MCP drag, because Slint's `DropEvent` is `#[non_exhaustive]` and cannot
//           be constructed outside the Slint crate.

// What:     `use super::*;` glob-imports the parent `drag_drop` module's items,
//           including `make_drag_data`, `drag_action_label`, `DragIdentity`, and the
//           `Rc`/`DataTransfer`/`DragAction` names it imports.
// Why:      Tests call them directly.
use super::*;

// What:     `#[test]` marks a test function (the analogue of a single `test(...)`
//           block); `fn make_drag_data_round_trips_identity()` builds a payload and
//           reads it back.
// Why:      Prove the drag payload carries the structured app-local (pane, row).
#[test]
fn make_drag_data_round_trips_identity() {
    // What:     `let transfer = make_drag_data(20, 3);` builds the payload for pane
    //           #20 row 3.
    // Why:      The value a dragged row would hand to Slint.
    let transfer = make_drag_data(20, 3);
    // What:     `let identity = transfer.user_data().and_then(|rc|
    //           rc.downcast::<DragIdentity>().ok()).expect("payload carries a
    //           DragIdentity");`. `user_data()` returns the `Option<Rc<dyn Any>>`;
    //           `downcast::<DragIdentity>()` reinterprets it, `.ok()` turns the
    //           `Result` into an `Option`, and `.expect(...)` unwraps or panics with
    //           the message.
    // Why:      Recover the typed identity the drop side would read.
    let identity = transfer
        .user_data()
        .and_then(|rc| rc.downcast::<DragIdentity>().ok())
        .expect("payload carries a DragIdentity");
    // What:     `assert_eq!(identity.source_pane_id, 20);` checks the pane id field.
    // Why:      The identity must survive the round trip unchanged.
    assert_eq!(identity.source_pane_id, 20);
    // What:     `assert_eq!(identity.source_row, 3);` checks the row field.
    // Why:      Same, for the row.
    assert_eq!(identity.source_row, 3);
    // What:     `assert!(!transfer.has_plain_text());` confirms no text was set.
    // Why:      A text-free payload is what keeps the drag in-window on every
    //           backend, so this guards that invariant.
    assert!(!transfer.has_plain_text());
    // What:     `assert!(!transfer.has_image());` confirms no image was set.
    // Why:      Same in-window invariant for the image channel.
    assert!(!transfer.has_image());
}

// What:     `fn drag_action_label_distinguishes_copy_and_move()` checks the label
//           map used in the HUD read-back and the log.
// Why:      "copy and move are distinguishable" is a spike pass criterion.
#[test]
fn drag_action_label_distinguishes_copy_and_move() {
    // What:     `assert_eq!(drag_action_label(DragAction::Copy), "copy");` checks the
    //           copy label. `DragAction::Copy` names the enum variant.
    // Why:      A copy drop must read back as "copy".
    assert_eq!(drag_action_label(DragAction::Copy), "copy");
    // What:     `assert_eq!(drag_action_label(DragAction::Move), "move");` checks the
    //           move label.
    // Why:      A move drop must read back as "move".
    assert_eq!(drag_action_label(DragAction::Move), "move");
    // What:     `assert_ne!(drag_action_label(DragAction::Copy),
    //           drag_action_label(DragAction::Move));` asserts the two differ.
    // Why:      The whole point: copy and move are not confusable.
    assert_ne!(
        drag_action_label(DragAction::Copy),
        drag_action_label(DragAction::Move)
    );
    // What:     `assert_eq!(drag_action_label(DragAction::Link), "link");` and the
    //           `None` case check the remaining variants.
    // Why:      Every variant maps to a distinct, expected word.
    assert_eq!(drag_action_label(DragAction::Link), "link");
    assert_eq!(drag_action_label(DragAction::None), "none");
}

// What:     `fn foreign_user_data_is_not_our_identity()` builds a payload whose
//           `user_data` is a different type and confirms it does NOT downcast to
//           `DragIdentity`.
// Why:      This is the discriminator `pane_can_drop`/`on_pane_dropped` rely on to
//           reject drags that are not one of our rows.
#[test]
fn foreign_user_data_is_not_our_identity() {
    // What:     `let mut transfer = DataTransfer::default();` makes an empty payload.
    //           `mut` because the next line mutates it.
    // Why:      Start from empty, then attach a foreign payload.
    let mut transfer = DataTransfer::default();
    // What:     `transfer.set_user_data(Rc::new(999_u32));` stores an `Rc<u32>` (a
    //           type that is not `DragIdentity`) as the app-local payload.
    // Why:      Stand in for a payload from some other drag source.
    transfer.set_user_data(Rc::new(999_u32));
    // What:     `let is_ours = transfer.user_data().and_then(|rc|
    //           rc.downcast::<DragIdentity>().ok()).is_some();` runs the same
    //           discriminator the drop callbacks use.
    // Why:      Reproduce the accept/reject test in isolation.
    let is_ours = transfer
        .user_data()
        .and_then(|rc| rc.downcast::<DragIdentity>().ok())
        .is_some();
    // What:     `assert!(!is_ours);` asserts the foreign payload is rejected.
    // Why:      A `u32` payload must never be mistaken for one of our rows.
    assert!(!is_ours);
}
