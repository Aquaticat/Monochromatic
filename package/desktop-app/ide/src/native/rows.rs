//! The window's side of the vertical mapping: keep `State::row_map` equal to what the displayed text and its
//! annotations call for, and tell the window what follows from it.
//!
//! Every native function that places or finds a line vertically reads `State::row_map`; none multiplies a line
//! number by a row height. The markup only scrolls and draws at positions handed to it.

/// The window and the source state that owns the map.
use super::{AppWindow, State};
/// The mapping itself and the height of one code row.
use ide_app::row_map::{CODE_ROW, RowMap};
/// What: `Model` gives a list its `row_count` and row access; `VecModel` is the toolkit's growable list model.
/// Why: Line-number positions are updated row by row, so the markup keeps its text elements while scrolling.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { type Model, ArrayModel } from 'slint';
/// ```
use slint::{Model, ModelRc, VecModel};
/// `Rc` shares the persistent model between the state and the window.
use std::rc::Rc;

/// What: Rebuild `current.row_map` when the displayed text no longer has the line count the map describes, and
///       answer the previous map when it changed; `Option<RowMap>` is that map or nothing.
/// Why: Callers that move the view (a reload, a file switch) refresh before they compute an offset; the
///      renderer refreshes at its start, so no frame is painted against an outdated map.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function refresh(current: State): RowMap | undefined;
/// ```
pub(super) fn refresh(current: &mut State) -> Option<RowMap> {
    let lines = current.document.text().len_lines();
    let wanted = RowMap::plain(lines);
    if wanted == current.row_map {
        // `None`: the map already describes the displayed text.
        return None;
    }
    // What: `std::mem::replace` stores the new map and hands back the old one.
    // Why: The caller compares positions in both to keep the view still.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const previous = current.rowMap; current.rowMap = wanted; return previous;
    // ```
    let previous = std::mem::replace(&mut current.row_map, wanted);
    tracing::debug!(lines, height = current.row_map.height(), "row map rebuilt");
    return Some(previous);
}

/// What: The scroll offset that shows `row`'s code row in a view of `height` starting at `offset`, changed by
///       the smallest amount; the answer is unrounded and not clamped to the text.
/// Why: Caret keys and drags keep the caret's line in view. A line above the view becomes the top line
///      together with its virtual rows, so what is said about the caret's line is in view with it; a line
///      below the view becomes the bottom line. The code row wins when both do not fit.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function showing(map: RowMap, row: number, offset: number, height: number): number;
/// ```
pub(super) fn showing(map: &RowMap, row: usize, offset: f32, height: f32) -> f32 {
    let top = map.code_top(row);
    let mut wanted = offset;
    if top < offset {
        wanted = map.block_top(row);
    }
    if top + CODE_ROW > wanted + height {
        wanted = top + CODE_ROW - height;
    }
    return wanted;
}

/// Largest scroll offset of a view of `height` over the mapped text.
pub(super) fn limit(map: &RowMap, height: f32) -> f32 {
    return (map.height() - height).max(0.0);
}

/// What: Everything the window draws from the map, read while the state is borrowed: the scroll extent, the
///       first materialized line with the code-row top of each materialized line, the shared line-number
///       model, and the place of the line a language surface is anchored to.
/// Why: Window setters run only after the state borrow ended, so the values are collected first.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Placement = { extent: number; first: number; tops: number[]; model: ArrayModel<number>;
///   anchor: [top: number, height: number] };
/// ```
pub(super) struct Placement {
    /// Height of the whole text.
    extent: f32,
    /// First materialized line.
    first: usize,
    /// Code-row top of each materialized line.
    tops: Vec<f32>,
    /// The persistent line-number model.
    model: Rc<VecModel<f32>>,
    /// Top and height of everything the anchoring line owns.
    anchor: (f32, f32),
}

/// What: Collect the [`Placement`] of the current map; `anchor_line` is the line the window says a language
///       surface belongs to.
/// Why: The markup holds no row arithmetic; every position it uses comes from here.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function measure(current: State, anchorLine: number): Placement;
/// ```
pub(super) fn measure(current: &State, anchor_line: i32) -> Placement {
    let map = &current.row_map;
    let last = current.first.saturating_add(current.count).min(map.lines());
    let mut tops = Vec::new();
    for line in current.first..last {
        tops.push(map.code_top(line));
    }
    return Placement {
        extent: map.height(),
        first: current.first,
        tops,
        // `Rc::clone` copies the pointer to the shared model, not its rows.
        model: Rc::clone(&current.line_tops),
        anchor: anchor_place(map, anchor_line),
    };
}

/// What: Hand a [`Placement`] to the window. The line-number model is updated row by row.
/// Why: Updating in place changes numbers and positions while scrolling without rebuilding text elements.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function present(window: AppWindow, placement: Placement): void;
/// ```
pub(super) fn present(window: &AppWindow, placement: Placement) {
    window.set_content_extent(placement.extent);
    let model = &placement.model;
    let wanted = &placement.tops;
    for (index, top) in wanted.iter().enumerate() {
        if index >= model.row_count() {
            model.push(*top);
        } else if model.row_data(index) != Some(*top) {
            model.set_row_data(index, *top);
        }
    }
    while model.row_count() > wanted.len() {
        model.remove(model.row_count() - 1);
    }
    // What: `Rc::clone` copies the pointer; the window compares model pointers, so handing over the same
    //       model again changes nothing.
    // Why: The first render installs the model; later ones only confirm it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // window.lineTops = current.lineTops;
    // ```
    window.set_line_tops(ModelRc::from(Rc::clone(model)));
    window.set_first_line(placement.first as i32);
    let (top, height) = placement.anchor;
    window.set_language_anchor_y(top);
    window.set_language_anchor_height(height);
}

/// What: Top and height of everything `anchor_line` owns, its virtual rows and its code row; a pair (tuple).
/// Why: A language popup or list is placed beside that span, so it covers neither the code row nor the
///      line's own virtual rows, also when rows appear above the line while the surface is shown.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function anchorPlace(map: RowMap, anchorLine: number): [top: number, height: number];
/// ```
pub(super) fn anchor_place(map: &RowMap, anchor_line: i32) -> (f32, f32) {
    // `max(0) as usize` turns the toolkit's integer into a line index.
    let line = (anchor_line.max(0) as usize).min(map.lines() - 1);
    let top = map.block_top(line);
    return (top, map.code_bottom(line) - top);
}

/// A fresh line-number model for a new source state.
pub(super) fn line_model() -> Rc<VecModel<f32>> {
    return Rc::new(VecModel::from(Vec::new()));
}
