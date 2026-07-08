//! Keyboard column navigation for the pane strip.
//!
//! Left/Right move keyboard focus between columns (walking the lineage), captured before the
//! focused list so its Up/Down row navigation is untouched. Split into its own module so `strip.rs`
//! stays under the max-lines budget; it reaches into `StripInner`'s shared state.

/// What: imports the reference-counted pointer and its weak companion.
/// Why: the key controller holds a `Weak<StripInner>` and upgrades it per key press.
use std::rc::Rc;

/// What: imports the GTK widget-extension traits (`add_controller`, `grab_focus`).
/// Why: the controller is added to the scroller and moves focus to a pane via prelude traits.
use gtk4::prelude::*;
/// What: imports the key-symbol type.
/// Why: the handler matches Left/Right.
use gtk4::gdk::Key;
/// What: imports the key event controller, its propagation phase, and the glib module.
/// Why: a capture-phase `EventControllerKey` intercepts Left/Right and returns a `glib::Propagation`.
use gtk4::{EventControllerKey, PropagationPhase, glib};

/// What: imports the strip's shared inner state.
/// Why: navigation reads the columns and widgets and updates the focused-column tracker.
use crate::strip::StripInner;

/// What: install a capture-phase key controller on the scroller that moves keyboard focus between
///       columns on Left/Right.
/// Why: horizontal navigation is keyboard-primary; capture phase intercepts Left/Right before the
///      focused list, leaving its Up/Down row navigation untouched.
pub(crate) fn install_column_nav(inner: &Rc<StripInner>) {
    let keys = EventControllerKey::new();
    keys.set_propagation_phase(PropagationPhase::Capture);
    let weak = Rc::downgrade(inner);
    keys.connect_key_pressed(move |_, key, _, _| {
        let Some(inner) = weak.upgrade() else {
            return glib::Propagation::Proceed;
        };
        match key {
            Key::Left => focus_relative_column(&inner, -1),
            Key::Right => focus_relative_column(&inner, 1),
            _ => glib::Propagation::Proceed,
        }
    });
    inner.outer.add_controller(keys);
}

/// What: move keyboard focus to the first pane of the column `delta` away, if it exists, and record
///       it as the focused column.
/// Why: Left/Right walk the lineage; an out-of-range move is ignored and the key passes through.
fn focus_relative_column(inner: &Rc<StripInner>, delta: i32) -> glib::Propagation {
    let target = inner.focused_column.get() as i32 + delta;
    let columns = inner.state.borrow().column_count() as i32;
    if target < 0 || target >= columns {
        return glib::Propagation::Proceed;
    }
    let target = target as usize;
    let first = inner.state.borrow().first_pane_in_column(target);
    let Some(id) = first else {
        return glib::Propagation::Proceed;
    };
    let Some(widget) = inner.widgets.borrow().get(&id).cloned() else {
        return glib::Propagation::Proceed;
    };
    widget.grab_focus();
    inner.focused_column.set(target);
    glib::Propagation::Stop
}
