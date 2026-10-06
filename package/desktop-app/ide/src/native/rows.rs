//! The window's side of the vertical mapping: keep `State::row_map` equal to what the displayed text and its
//! annotations call for, and tell the window what follows from it.
//!
//! Every native function that places or finds a line vertically reads `State::row_map`; none multiplies a line
//! number by a row height. The markup only scrolls and draws at positions handed to it.

/// The window, the source state that owns the map, the stamp of the displayed text, and the choice of the
/// materialized lines for an offset.
use super::{AppWindow, State, annotate::displayed, viewport::place};
/// What: `Assoc` says which side of inserted text a mapped position stays on; `ChangeSet` is Helix's edit list.
/// Why: Rows of a replaced text keep their space above the lines their old lines became.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Assoc, type ChangeSet } from 'helix-core';
/// ```
use helix_core::{Assoc, ChangeSet};
/// Space held open above a line of a reloaded text, and the rank that orders severities.
use ide_app::annotation::{Held, rank};
/// The mapping itself and the height of one code row.
use ide_app::row_map::{CODE_ROW, RowMap};
/// The stamp naming a displayed text, and one line's block of virtual rows.
use ide_app::{language::identity::DocumentStamp, virtual_row::Block};
/// What: `Model` gives a list its `row_count` and row access; `VecModel` is the toolkit's growable list model.
/// Why: Line-number positions are updated row by row, so the markup keeps its text elements while scrolling.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { type Model, ArrayModel } from 'slint';
/// ```
use slint::{Model, ModelRc, VecModel};
/// `Rc` shares the persistent model between the state and the window; `Duration` and `Instant` time held space.
use std::{
    rc::Rc,
    sync::Arc,
    time::{Duration, Instant},
};

/// What: How long the view must have stood still before a change of rows may move the scroll offset.
/// Why: The toolkit animates a wheel notch for 180 ms (`WHEEL_SCROLL_DURATION` in Slint 1.18.1's
///      `internal/core/items/flickable.rs`) through a binding on the offset, and assigning the offset removes
///      that binding: the scroll would stop short. Waiting slightly longer than the animation lets it finish.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const SCROLL_QUIET = 200; // milliseconds
/// ```
const SCROLL_QUIET: Duration = Duration::from_millis(200);

/// What: What the map key is made of: the displayed text's stamp, the annotation store's change counter, and
///       the display scale as exact bits; `type` names the tuple once.
/// Why: Blocks are assembled again only when one of the three changed.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type RowKey = [stamp: DocumentStamp, version: number, scale: number];
/// ```
pub(super) type RowKey = (DocumentStamp, u64, u32);

/// What: A freshly assembled vertical layout that is not installed yet: its key, the blocks of every annotated
///       line, and the map they call for.
/// Why: Whether the view can take it now is decided before anything in the state changes.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Rebuilt = { key: RowKey; blocks: Block[]; map: RowMap };
/// ```
pub(super) struct Rebuilt {
    /// What the layout was built from.
    key: RowKey,
    /// Blocks of virtual rows, in line order.
    blocks: Vec<Arc<Block>>,
    /// The mapping the blocks call for.
    map: RowMap,
}

/// The key the displayed text, its annotations, and the display `scale` call for now.
fn wanted_key(current: &State, scale: f32) -> RowKey {
    // `to_bits` turns the float into an integer that compares exactly.
    return (
        displayed(current),
        current.annotations.version(),
        scale.to_bits(),
    );
}

/// What: Assemble the blocks and the map the displayed text, its annotations, and the display `scale` call for,
///       or nothing when the state's layout was built from exactly these; `Option<Rebuilt>` is that result.
/// Why: Blocks are assembled only when the text, the annotation store, or the scale changed, which the stored
///      key records. Nothing in the state changes here except the store's packing cache.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function rebuilt(current: State, scale: number): Rebuilt | undefined;
/// ```
fn rebuilt(current: &mut State, scale: f32) -> Option<Rebuilt> {
    let key = wanted_key(current, scale);
    if current.row_key == Some(key) {
        // `None`: nothing a block depends on changed.
        return None;
    }
    // What: Destructuring `&mut State` lends three fields separately.
    // Why: Assembly changes the store's packing cache and uses the shaper while the document is only read.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const { document, shaper, annotations } = current;
    // ```
    let State {
        document,
        shaper,
        annotations,
        ..
    } = &mut *current;
    let blocks = annotations.assemble(key.0, document, shaper, scale);
    let mut raised = Vec::new();
    for block in &blocks {
        raised.push((block.line, block.height()));
    }
    let map = RowMap::new(document.text().len_lines(), &raised);
    // `Some(...)` hands the assembled layout to the caller, which decides when to install it.
    return Some(Rebuilt { key, blocks, map });
}

/// What: Make `layout` the state's layout and answer the previous map when positions changed;
///       `Option<RowMap>` is that map or nothing. `Rebuilt` is moved in.
/// Why: The caller compares positions in both maps to keep the view still.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function install(current: State, layout: Rebuilt): RowMap | undefined;
/// ```
fn install(current: &mut State, layout: Rebuilt) -> Option<RowMap> {
    current.blocks = layout.blocks;
    current.row_key = Some(layout.key);
    if layout.map == current.row_map {
        return None;
    }
    // What: `std::mem::replace` stores the new map and hands back the old one.
    // Why: The old positions are needed once more, to keep the view still.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const previous = current.rowMap; current.rowMap = layout.map; return previous;
    // ```
    let previous = std::mem::replace(&mut current.row_map, layout.map);
    tracing::debug!(
        lines = current.row_map.lines(),
        blocks = current.blocks.len(),
        height = current.row_map.height(),
        "row map rebuilt"
    );
    return Some(previous);
}

/// What: Bring `current.blocks` and `current.row_map` up to date at once and answer the previous map when
///       positions changed.
/// Why: Callers that place the view themselves (a reload, a file switch, a revealed line) refresh before they
///      compute an offset.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function refresh(current: State, scale: number): RowMap | undefined;
/// ```
pub(super) fn refresh(current: &mut State, scale: f32) -> Option<RowMap> {
    // `?` leaves with nothing when the layout is already current.
    let layout = rebuilt(current, scale)?;
    return install(current, layout);
}

/// Whether the reader scrolled so recently that a wheel animation may still be running.
fn scrolling(current: &State) -> bool {
    // `is_some_and` answers false when the view never scrolled and otherwise asks the closure.
    return current
        .scrolled_at
        .is_some_and(|at| return at.elapsed() < SCROLL_QUIET);
}

/// What: Bring the vertical mapping up to date for a render and, when it changed, keep the view still: the
///       answer is the scroll offset the window must take, or nothing. `view` holds the horizontal offset, the
///       vertical offset, the width, and the height of the view in logical pixels.
/// Why: Rows that appear, change, or vanish above the first visible code row must move nothing visible, so
///      the offset follows them; the materialized lines are chosen again for the offset that results.
///      While the reader is scrolling, a change that would move the offset waits: the rows it brings are
///      above the view anyway, and assigning the offset would cut the toolkit's scroll animation short.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function settle(current: State, scale: number, view: [number, number, number, number]): number | undefined;
/// ```
pub(super) fn settle(current: &mut State, scale: f32, view: (f32, f32, f32, f32)) -> Option<f32> {
    let (left, offset, width, height) = view;
    let layout = rebuilt(current, scale)?;
    let kept = anchored(&current.row_map, &layout.map, offset).min(limit(&layout.map, height));
    // A layout for the same text may wait; one for another text never does, its caller placed the view.
    let same_text = current
        .row_key
        .is_some_and(|(stamp, _, _)| return stamp == layout.key.0);
    // What: `abs()` is the distance without its sign; the window's offset differs from the last one placed when
    //       a scroll step is under way whose change handler has not run yet.
    // Why: Under load a render can come between a wheel animation's last step and its change handler; that step
    //      is scrolling too, and the rows must not cut it short.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const moving = Math.abs(offset - current.offset) > 0.01;
    // ```
    let moving = (offset - current.offset).abs() > 0.01;
    if kept != offset && same_text && (moving || scrolling(current)) {
        tracing::debug!(
            offset,
            "rows above the view wait until scrolling has stopped"
        );
        return None;
    }
    // `?` leaves with nothing when no position changed.
    install(current, layout)?;
    place(current, left, kept, width, height);
    tracing::debug!(
        before = offset,
        after = kept,
        "kept the view still across a change of virtual rows"
    );
    if kept == offset {
        return None;
    }
    return Some(kept);
}

/// What: Whether the window must render now for the vertical mapping's sake: held space ran out of time, or
///       rows that waited for scrolling to stop can be shown.
/// Why: Neither comes with an event of its own; the source refresh timer asks every tick.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function due(current: State, scale: number): boolean;
/// ```
pub(super) fn due(current: &mut State, scale: f32) -> bool {
    let expired = current.annotations.expire(Instant::now());
    let waiting = current.row_key.is_some()
        && current.row_key != Some(wanted_key(current, scale))
        && !scrolling(current);
    return expired || waiting;
}

/// What: The scroll offset in `next` that shows what `offset` showed in `previous`: the code row of the line
///       at the view's top edge keeps its distance from that edge.
/// Why: Virtual rows that appear, change, or vanish above the first visible code row must move nothing that
///      is visible. A view at the very top of the text stays there, so rows arriving for the first lines push
///      the text down instead of hiding above the top edge.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function anchored(previous: RowMap, next: RowMap, offset: number): number;
/// ```
pub(super) fn anchored(previous: &RowMap, next: &RowMap, offset: f32) -> f32 {
    if offset <= 0.0 {
        return 0.0;
    }
    let line = previous.line_at(offset).min(next.lines() - 1);
    let within = offset - previous.code_top(line);
    return (next.code_top(line) + within).max(0.0);
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
///   marks: number[]; markModel: ArrayModel<number>; anchor: [top: number, height: number] };
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
    /// Gutter severity mark of each materialized line; see `State::line_marks`.
    marks: Vec<i32>,
    /// The persistent severity-mark model.
    mark_model: Rc<VecModel<i32>>,
    /// Number of lines, whose last number sets the width of the gutter's number column.
    lines: usize,
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
    // What: `vec![0; n]` is a list of n zeros; `partition_point` is a binary search for the first block at or
    //       after the first materialized line.
    // Why: A line's message rows are listed worst first, so the first row names the worst severity starting on
    //      the line. Blocks with held space only have no rows, so a stale text shows no letter.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const marks = tops.map(() => 0); for (const block of blocksIn(first, last)) marks[block.line - first] = ...;
    // ```
    let mut marks = vec![0; tops.len()];
    let from = current
        .blocks
        .partition_point(|block| return block.line < current.first);
    for block in &current.blocks[from..] {
        if block.line >= last {
            break;
        }
        // `first()` lends the worst message row, or nothing for a block without messages.
        if let Some(worst) = block.messages.first() {
            marks[block.line - current.first] = i32::from(rank(worst.severity)) + 1;
        }
    }
    return Placement {
        extent: map.height(),
        first: current.first,
        tops,
        // `Rc::clone` copies the pointer to the shared model, not its rows.
        model: Rc::clone(&current.line_tops),
        marks,
        mark_model: Rc::clone(&current.line_marks),
        lines: map.lines(),
        anchor: anchor_place(map, anchor_line),
    };
}

/// What: Make `model` hold exactly `wanted`, changing only rows that differ. `T` is the row type; `Copy` lets a
///       row be duplicated like a number and `PartialEq` lets two rows be compared.
/// Why: Updating in place changes numbers, positions, and letters while scrolling without rebuilding elements.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function update<T>(model: ArrayModel<T>, wanted: T[]): void;
/// ```
fn update<T: Copy + PartialEq + 'static>(model: &VecModel<T>, wanted: &[T]) {
    for (index, row) in wanted.iter().enumerate() {
        if index >= model.row_count() {
            model.push(*row);
        } else if model.row_data(index) != Some(*row) {
            model.set_row_data(index, *row);
        }
    }
    while model.row_count() > wanted.len() {
        model.remove(model.row_count() - 1);
    }
}

/// What: Hand a [`Placement`] to the window. The line-number and severity-mark models are updated row by row.
/// Why: The window draws a number and, where a diagnostic starts, a letter on each materialized code row.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function present(window: AppWindow, placement: Placement): void;
/// ```
pub(super) fn present(window: &AppWindow, placement: Placement) {
    window.set_content_extent(placement.extent);
    let model = &placement.model;
    update(model, &placement.tops);
    update(&placement.mark_model, &placement.marks);
    // What: `Rc::clone` copies the pointer; the window compares model pointers, so handing over the same
    //       model again changes nothing.
    // Why: The first render installs the model; later ones only confirm it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // window.lineTops = current.lineTops;
    // ```
    window.set_line_tops(ModelRc::from(Rc::clone(model)));
    window.set_line_marks(ModelRc::from(Rc::clone(&placement.mark_model)));
    // `try_from` turns the count into the toolkit's 32-bit integer; a count past its range reads as its largest.
    window.set_line_count(i32::try_from(placement.lines).unwrap_or(i32::MAX));
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

/// A fresh severity-mark model for a new source state.
pub(super) fn mark_model() -> Rc<VecModel<i32>> {
    return Rc::new(VecModel::from(Vec::new()));
}

/// What: How long the space of a replaced text's virtual rows stays open while nothing is painted in it.
/// Why: Hints for a reloaded text were measured to arrive 20 to 40 ms after the reload; one second covers that
///      many times over, and space that no answer fills does not stay empty for long.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const ROW_HOLD = 1000; // milliseconds
/// ```
const ROW_HOLD: Duration = Duration::from_millis(1000);

/// What: Before an external change is applied, where each block of the displayed text will be in the new one:
///       the mapped character position of its line's start and the heights of its hint part and message part.
///       `&ChangeSet` lends the edits from the displayed text to the new one; the answer is a list of triples.
/// Why: The rows of the old text are never painted for the new one, but their space is held open so lines the
///      change did not touch stay where they are.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function carried(current: State, changes: ChangeSet): [position: number, hints: number, messages: number][];
/// ```
pub(super) fn carried(current: &State, changes: &ChangeSet) -> Vec<(usize, f32, f32)> {
    let text = current.document.text();
    let mut kept = Vec::new();
    for block in &current.blocks {
        let start = text.line_to_char(block.line.min(text.len_lines()));
        // Text inserted at the line's start pushes the line, and its rows with it, further down.
        let position = changes.map_pos(start, Assoc::After);
        kept.push((position, block.hint_part(), block.message_part()));
    }
    return kept;
}

/// What: After the change was applied, hold the `carried` space above the lines the positions now lie on, and
///       rebuild the map. `Vec<...>` is moved in.
/// Why: Hint space is given up as soon as hints for those lines arrive; message space stays until its time
///      has passed, because diagnostics of one text arrive in several parts.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function hold(current: State, carried: [number, number, number][], scale: number): void;
/// ```
pub(super) fn hold(current: &mut State, carried: Vec<(usize, f32, f32)>, scale: f32) {
    let text = current.document.text();
    let length = text.len_chars();
    let mut parts: Vec<Held> = Vec::new();
    for (position, hints, messages) in carried {
        let line = text.char_to_line(position.min(length));
        // What: `last_mut()` lends the latest entry for change, or nothing for an empty list.
        // Why: Two old lines that became one keep the taller space of the two; positions ascend, so such
        //      lines follow each other.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const last = parts.at(-1); if (last?.line === line) { ... } else parts.push(...);
        // ```
        if let Some(last) = parts.last_mut()
            && last.line == line
        {
            last.hints = last.hints.max(hints);
            last.messages = last.messages.max(messages);
        } else {
            parts.push(Held {
                line,
                hints,
                messages,
            });
        }
    }
    let next = displayed(current);
    tracing::debug!(
        lines = parts.len(),
        ?next,
        "held the space of replaced rows"
    );
    current
        .annotations
        .hold(next, parts, Instant::now() + ROW_HOLD);
    refresh(current, scale);
}
