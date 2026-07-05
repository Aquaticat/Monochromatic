//! The row context-menu handlers, split from `controller.rs` for the line budget.
//! These are the Rust half of the Slint issue #12354 workaround: the row's own
//! `TouchArea` grabs the right-click (the built-in `ContextMenuArea` never sees
//! it), so the UI forwards the click here to record which (pane, row) the menu
//! targets, then a chosen command reads that identity back. None of these mutate
//! the columns model, so they never rebuild a column or disturb scrolling.

/// What:     `use crate::controller::Controller;` imports the app-state owner this
///           module adds methods to.
/// Why:      This file is a third `impl Controller` block.
use crate::controller::Controller;

/// What:     `impl Controller` attaches the context-menu handlers.
/// Why:      Keep the menu plumbing in one place, separate from scroll/nav.
impl Controller {
    /// What:     `pub fn on_row_activate(&mut self, pane_id: i32, row_index: i32)`
    ///           records a clicked/right-clicked row as the current menu target.
    /// Why:      A following menu command (mouse) and the highlight both read this
    ///           target; a left-click also sets it so a later keyboard menu on this
    ///           row carries the same identity. It does NOT move `active_column`/
    ///           `active_pane`, so no column rebuilds and the ListView scroll holds.
    pub fn on_row_activate(&mut self, pane_id: i32, row_index: i32) {
        // What:     `self.active_row = row_index.max(0) as usize;` clamps a negative
        //           (never expected) index to zero and narrows `i32` to `usize`.
        // Why:      The keyboard menu key targets this row on the active pane.
        self.active_row = row_index.max(0) as usize;
        // What:     `self.instrumentation.record_menu_target(pane_id, row_index);`
        //           stores the target for the highlight and the command identity.
        // Why:      One source of truth the HUD mirror and the row highlight read.
        self.instrumentation.record_menu_target(pane_id, row_index);
    }

    /// What:     `pub fn on_menu_key(&mut self)` sets the menu target to the active
    ///           pane's active row, for the keyboard menu-key path.
    /// Why:      The keyboard menu has no click position, so its target is the
    ///           focused pane plus the active row.
    pub fn on_menu_key(&mut self) {
        // What:     `let pane_id = self.active_pane_id() as i32;` reads the active
        //           pane's id and narrows it to Slint's `int` width.
        // Why:      The target is stored as `i32` to match the HUD/highlight.
        let pane_id = self.active_pane_id() as i32;
        // What:     `let row = self.active_row as i32;` narrows the active row.
        // Why:      Same width as the stored target.
        let row = self.active_row as i32;
        // What:     `self.instrumentation.record_menu_target(pane_id, row);` stores
        //           the keyboard target the same way the mouse path does.
        // Why:      The chosen command reads the same field regardless of path.
        self.instrumentation.record_menu_target(pane_id, row);
    }

    /// What:     `pub fn on_menu_action(&self, command: &str)` resolves a chosen
    ///           menu command against the current target and records it for the HUD.
    ///           `&self` (not `&mut self`) because it only reads the target and
    ///           writes through interior mutability.
    /// Why:      This is the read-back that proves the command received the correct
    ///           (pane, row) identity.
    pub fn on_menu_action(&self, command: &str) {
        // What:     `let pane_id = self.instrumentation.menu_target_pane_id.get();`
        //           reads the targeted pane id from the shared `Cell`.
        // Why:      The identity the command runs against.
        let pane_id = self.instrumentation.menu_target_pane_id.get();
        // What:     `let row = self.instrumentation.menu_target_row.get();` reads the
        //           targeted row.
        // Why:      Completes the (pane, row) identity.
        let row = self.instrumentation.menu_target_row.get();
        // What:     `self.instrumentation.set_last_menu(format!(...));` formats the
        //           command plus identity and stores it. `format!` builds an owned
        //           `String` (like a template literal).
        // Why:      The HUD mirrors this exact string as the read-back.
        self.instrumentation
            .set_last_menu(format!("{command} on pane #{pane_id} row {row}"));
        // What:     `tracing::info!(...)` logs the command with structured fields.
        //           `tracing` is Rust's structured logger (analogue of the tagged
        //           TS logger); the trailing string is the message.
        // Why:      A terminal run shows each menu command and its target.
        tracing::info!(command, pane_id, row, "context menu command");
    }

    /// What:     `fn active_pane_id(&self) -> u64` returns the id of the active
    ///           pane, or `0` when the indices are somehow out of range.
    /// Why:      The keyboard menu needs the active pane's identity.
    fn active_pane_id(&self) -> u64 {
        // What:     `if self.active_column >= self.strip.columns.len() { return 0; }`
        //           guards a stale column index.
        // Why:      Never index past the strip after a close.
        if self.active_column >= self.strip.columns.len() {
            return 0;
        }
        // What:     `let column = &self.strip.columns[self.active_column];` borrows
        //           the active column read-only (`&`, a lend, not a move).
        // Why:      Read its panes without taking ownership.
        let column = &self.strip.columns[self.active_column];
        // What:     `if self.active_pane >= column.panes.len() { return 0; }` guards
        //           a stale pane index.
        // Why:      Never index past the column.
        if self.active_pane >= column.panes.len() {
            return 0;
        }
        // What:     `column.panes[self.active_pane].id` reads the pane id; tail
        //           expression, so it is returned.
        // Why:      Hand back the active pane's identity.
        column.panes[self.active_pane].id
    }
}
