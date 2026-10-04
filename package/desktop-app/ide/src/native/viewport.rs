//! Native scrolling retains fractional offsets between raster tile updates.

/// Parent state owns the document and the currently displayed tile.
use super::{AppWindow, State, render};
/// ComponentHandle supplies weak references for callback lifetimes.
use slint::ComponentHandle;
/// Checked shared ownership remains confined to the UI thread.
use std::{cell::RefCell, rc::Rc};

/// Retain pixel scrolling; update the raster only at viewport tile boundaries.
pub(super) fn bind_viewport(owner: &AppWindow, shared: &Rc<RefCell<State>>) {
    let state = Rc::clone(shared);
    let weak = owner.as_weak();
    owner.on_viewport_changed(move |horizontal, offset, viewport_width, height| {
        let first = (offset.max(0.0) / 24.0) as usize;
        let count = (height.max(0.0) / 24.0).ceil() as usize + 3;
        let tile_x = ((horizontal.max(0.0) / 128.0).floor() * 128.0 - 128.0).max(0.0);
        let width = viewport_width.max(1.0);
        let mut current = state.borrow_mut();
        if current.first == first.saturating_sub(1) && current.count == count
            && current.horizontal == tile_x && current.width == width {
            return;
        }
        current.first = first.saturating_sub(1);
        current.count = count;
        current.horizontal = tile_x;
        current.width = width;
        let text = current.document.text();
        let line = first.min(text.len_lines().saturating_sub(1));
        let mut position = current.document.position();
        position.viewport = text.line_to_char(line);
        current.document.select(position);
        drop(current);
        if let Some(window) = weak.upgrade() {
            render(&window, &state);
        }
    });
}
