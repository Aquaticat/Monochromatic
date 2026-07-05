//! The controller owns the mutable app state between user actions: the full
//! strip, the horizontal scroll offset, each column's vertical offset, the active
//! column/pane identity, the preview cache, and the shared instrumentation. Each
//! handler mutates that state and returns a freshly published bounded model.

/// What:     `use std::rc::Rc;` imports single-thread reference counting.
/// Why:      The instrumentation handle is shared with the preview cache, the row
///           models, and the UI-thread timer.
use std::rc::Rc;

/// What:     `use std::time::Instant;` imports a monotonic clock reading (sibling:
///           `SystemTime`, the wall clock, which can jump backward).
/// Why:      Timing a publish needs a monotonic start point.
use std::time::Instant;

/// What:     `use anyhow::Result;` imports the one-parameter error result alias.
/// Why:      Publishing can fail on a preview decode; handlers propagate it.
use anyhow::Result;

/// What:     `use slint::ModelRc;` imports the reference-counted model wrapper.
/// Why:      Handlers return the published columns as a `ModelRc<ColumnView>`.
use slint::ModelRc;

/// What:     `use crate::ColumnView;` imports the generated column view struct.
/// Why:      It is the model element type handlers return.
use crate::ColumnView;

/// What:     `use crate::instrument::Instrumentation;` imports the shared counters.
/// Why:      The controller updates active/total counts and hands out the handle.
use crate::instrument::Instrumentation;

/// What:     `use crate::preview::PreviewCache;` imports the decode/evict cache.
/// Why:      The controller owns one cache for the app's lifetime.
use crate::preview::PreviewCache;

/// What:     `use crate::strip::{...};` imports the strip type, the pane-kind
///           enum, the synthetic builder, and the two pitch helpers.
/// Why:      The controller owns the strip and navigates it by pitch.
use crate::strip::{column_pitch_px, pane_pitch_px, synthetic_strip, PaneKind, Strip};

/// What:     `use crate::view::{build_columns_model, PublishInput};` imports the
///           publish function and its input struct.
/// Why:      `publish` calls it.
use crate::view::{build_columns_model, PublishInput};

/// What:     `pub const PREFETCH: usize = 1;` is the extra column/pane instantiated
///           on each side of the viewport.
/// Why:      One prefetch item keeps scrolling smooth without growing the window.
pub const PREFETCH: usize = 1;

/// What:     `const DEFAULT_VIEWPORT_W_PX: f32 = 1100.0;` is the assumed strip
///           width before the window reports its real size.
/// Why:      Publishing needs a viewport width from the first frame.
const DEFAULT_VIEWPORT_W_PX: f32 = 1100.0;

/// What:     `const DEFAULT_VIEWPORT_H_PX: f32 = 600.0;` is the assumed strip
///           height (window minus HUD and control bars).
/// Why:      Publishing needs a viewport height from the first frame.
const DEFAULT_VIEWPORT_H_PX: f32 = 600.0;

/// What:     `pub struct Controller` holds all mutable app state.
/// Why:      One owner keeps the strip, scroll, active identity, cache, and
///           counters consistent across user actions.
pub struct Controller {
    /// What:     `strip: Strip` is the full column-of-panes identity.
    /// Why:      The source every publish windows over.
    strip: Strip,
    /// What:     `v_offset_px: f32` is the single vertical scroll offset applied to
    ///           every column.
    /// Why:      Vertical scrolling moves the whole strip at once.
    v_offset_px: f32,
    /// What:     `max_column_height_px: f32` is the tallest column's content height.
    /// Why:      The vertical scroll range spans it, so every column can reach its
    ///           bottom; recomputed when the strip changes.
    max_column_height_px: f32,
    /// What:     `h_offset_px: f32` is the horizontal scroll offset (positive).
    /// Why:      Drives the column window.
    h_offset_px: f32,
    /// What:     `viewport_w_px: f32` is the current visible strip width.
    /// Why:      Column window size.
    viewport_w_px: f32,
    /// What:     `viewport_h_px: f32` is the current visible strip height.
    /// Why:      Pane window size.
    viewport_h_px: f32,
    /// What:     `active_column: usize` is the focused column index.
    /// Why:      Keyboard navigation and focus track it.
    active_column: usize,
    /// What:     `active_pane: usize` is the focused pane index in that column.
    /// Why:      Same at the pane level.
    active_pane: usize,
    /// What:     `preview_cache: PreviewCache` owns the decoded-bitmap lifecycle.
    /// Why:      Publishing decodes and evicts through it.
    preview_cache: PreviewCache,
    /// What:     `instrumentation: Rc<Instrumentation>` is the shared counters.
    /// Why:      Written on publish, read by the HUD timer.
    instrumentation: Rc<Instrumentation>,
}

/// What:     `impl Controller` attaches the constructor and handlers.
/// Why:      The app wires Slint callbacks to these methods.
impl Controller {
    /// What:     `pub fn new() -> Self` builds the controller with the synthetic
    ///           strip and zeroed scroll/active state.
    /// Why:      One place to assemble the initial app state.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// static new(): Controller { ... }
    /// ```
    pub fn new() -> Self {
        // What:     `let instrumentation = Rc::new(Instrumentation::new());` wraps
        //           fresh counters in a shared pointer.
        // Why:      Shared with the cache, row models, and timer.
        let instrumentation = Rc::new(Instrumentation::new());
        // What:     `let strip = synthetic_strip();` builds the big test strip.
        // Why:      The thing being virtualized.
        let strip = synthetic_strip();
        // What:     `let max_column_height_px = compute_max_column_height(&strip);`
        //           finds the tallest column's content height.
        // Why:      The global vertical scroll range spans it.
        let max_column_height_px = compute_max_column_height(&strip);
        // What:     `let preview_cache = PreviewCache::new(Rc::clone(&instrumentation));`
        //           builds the cache sharing the counters.
        // Why:      The cache reports decoded bytes and decode count.
        let preview_cache = PreviewCache::new(Rc::clone(&instrumentation));
        // What:     `let controller = Self { ... };` assembles the state with
        //           default viewport sizes and zeroed scroll/active fields.
        // Why:      Build the initial controller.
        let controller = Self {
            strip,
            v_offset_px: 0.0,
            max_column_height_px,
            h_offset_px: 0.0,
            viewport_w_px: DEFAULT_VIEWPORT_W_PX,
            viewport_h_px: DEFAULT_VIEWPORT_H_PX,
            active_column: 0,
            active_pane: 0,
            preview_cache,
            instrumentation,
        };
        // What:     `controller.refresh_totals();` fills the total-* counters.
        // Why:      The HUD needs the full-strip totals from the first frame.
        controller.refresh_totals();
        // What:     `controller` is the returned tail expression.
        // Why:      Hand the assembled controller back.
        controller
    }

    /// What:     `pub fn instrumentation(&self) -> Rc<Instrumentation>` hands out a
    ///           shared clone of the counters.
    /// Why:      The UI-thread timer needs a handle to mirror into the HUD.
    pub fn instrumentation(&self) -> Rc<Instrumentation> {
        // What:     `Rc::clone(&self.instrumentation)` bumps the refcount and
        //           returns another handle; tail expression.
        // Why:      Share, do not move, the counters.
        Rc::clone(&self.instrumentation)
    }

    /// What:     `pub fn strip_width_px(&self) -> f32` is the full horizontal
    ///           content width.
    /// Why:      The window's Flickable viewport-width uses it.
    pub fn strip_width_px(&self) -> f32 {
        // What:     `self.strip.columns.len() as f32 * column_pitch_px()`; tail.
        // Why:      Column count times pitch is the strip width.
        self.strip.columns.len() as f32 * column_pitch_px()
    }

    /// What:     `pub fn h_offset_px(&self) -> f32` reads the horizontal offset.
    /// Why:      The app syncs the Flickable to it after keyboard navigation.
    pub fn h_offset_px(&self) -> f32 {
        // What:     `self.h_offset_px` tail expression returns the offset.
        // Why:      Expose the stored value.
        self.h_offset_px
    }

    /// What:     `pub fn set_viewport(&mut self, width_px: f32, height_px: f32)`
    ///           records the real viewport size.
    /// Why:      The window reports its size so windowing matches what is drawn.
    pub fn set_viewport(&mut self, width_px: f32, height_px: f32) {
        // What:     `self.viewport_w_px = width_px.max(1.0);` clamps to at least 1.
        // Why:      A zero viewport mid-resize must not break the maths.
        self.viewport_w_px = width_px.max(1.0);
        // What:     `self.viewport_h_px = height_px.max(1.0);` clamps the height.
        // Why:      Same guard for height.
        self.viewport_h_px = height_px.max(1.0);
    }

    /// What:     `pub fn set_active_focus(&self, focused: bool)` records whether the
    ///           active pane holds focus.
    /// Why:      The focus-survival check reads this back through the HUD.
    pub fn set_active_focus(&self, focused: bool) {
        // What:     `self.instrumentation.active_pane_focused.set(focused);` writes
        //           the shared flag.
        // Why:      Mirror focus state for the HUD.
        self.instrumentation.active_pane_focused.set(focused);
    }

    /// What:     `pub fn publish(&mut self) -> Result<ModelRc<ColumnView>>` builds
    ///           the current bounded model. `&mut self` because the preview cache
    ///           and counters mutate.
    /// Why:      Every handler ends by publishing; the app also calls it for the
    ///           first frame and on resize.
    pub fn publish(&mut self) -> Result<ModelRc<ColumnView>> {
        // What:     `self.instrumentation.active_column.set(self.active_column);`
        //           mirrors the active column index.
        // Why:      HUD shows it.
        self.instrumentation.active_column.set(self.active_column);
        // What:     Mirror the active pane index too.
        // Why:      HUD shows it.
        self.instrumentation.active_pane.set(self.active_pane);
        // What:     `let input = PublishInput { ... };` bundles borrows of distinct
        //           fields (`&self.strip`, `&mut self.preview_cache`, and so on).
        //           Borrowing different fields at once is allowed.
        // Why:      The publish function takes one named-field struct.
        let input = PublishInput {
            strip: &self.strip,
            h_offset_px: self.h_offset_px,
            viewport_w_px: self.viewport_w_px,
            viewport_h_px: self.viewport_h_px,
            v_offset_px: self.v_offset_px,
            active_column: self.active_column,
            active_pane: self.active_pane,
            prefetch: PREFETCH,
            preview_cache: &mut self.preview_cache,
            instrumentation: &self.instrumentation,
        };
        // What:     `self.instrumentation.last_decode_us.set(0);` zeroes the
        //           per-publish decode accumulator before the build; the preview
        //           cache adds to it for each decode this publish performs.
        // Why:      Separate the decode cost from the windowing cost.
        self.instrumentation.last_decode_us.set(0);
        // What:     `let start = Instant::now();` reads a monotonic clock before
        //           the publish work.
        // Why:      Time how long one publish takes, for the smoothness metric.
        let start = Instant::now();
        // What:     `let model = build_columns_model(input)?;` does the windowing,
        //           model build, and any preview decode; `?` propagates a decode
        //           error.
        // Why:      This is the per-action work whose cost must stay bounded.
        let model = build_columns_model(input)?;
        // What:     `let elapsed_us = start.elapsed().as_micros() as u64;` measures
        //           the elapsed span in microseconds; `as u64` narrows the `u128`.
        // Why:      Record it in the counters.
        let elapsed_us = start.elapsed().as_micros() as u64;
        // What:     `self.instrumentation.last_publish_us.set(elapsed_us);` stores
        //           the latest publish time.
        // Why:      HUD shows the per-action cost.
        self.instrumentation.last_publish_us.set(elapsed_us);
        // What:     `if elapsed_us > self.instrumentation.max_publish_us.get() { ... }`
        //           updates the running maximum.
        // Why:      Surface the worst-case hitch.
        if elapsed_us > self.instrumentation.max_publish_us.get() {
            self.instrumentation.max_publish_us.set(elapsed_us);
        }
        // What:     `Ok(model)` returns the published model; tail expression.
        // Why:      Hand it to the caller.
        Ok(model)
    }

    /// What:     `pub fn on_horizontal_scroll(&mut self, offset_px: f32) ->
    ///           Result<ModelRc<ColumnView>>` handles a horizontal scroll.
    /// Why:      The Flickable reports pixel offsets here.
    pub fn on_horizontal_scroll(&mut self, offset_px: f32) -> Result<ModelRc<ColumnView>> {
        // What:     `self.h_offset_px = offset_px.max(0.0);` stores the clamped
        //           offset.
        // Why:      Never scroll before the first column.
        self.h_offset_px = offset_px.max(0.0);
        // What:     `self.publish()` republishes; tail expression.
        // Why:      Reflect the new horizontal window.
        self.publish()
    }

    /// What:     `pub fn on_vertical_scroll(&mut self, percent: f32) ->
    ///           Result<ModelRc<ColumnView>>` handles the active column's vertical
    ///           scroll, given a 0..100 percentage from the slider.
    /// Why:      Vertical scroll is Rust-driven, so a percentage is unambiguous.
    pub fn on_vertical_scroll(&mut self, percent: f32) -> Result<ModelRc<ColumnView>> {
        // What:     `self.v_offset_px = (percent / 100.0) * self.max_v_offset();`
        //           sets the single global offset from the percentage.
        // Why:      Move every column's panes together, proportionally.
        self.v_offset_px = (percent / 100.0) * self.max_v_offset();
        // What:     `self.publish()` republishes; tail expression.
        // Why:      Reflect the new vertical window across all columns.
        self.publish()
    }

    /// What:     `pub fn poll_decodes(&mut self) -> Result<Option<ModelRc<ColumnView>>>`
    ///           collects any finished background decodes and republishes if some
    ///           landed. `Option` is `Some(model)` when a republish happened.
    /// Why:      The app polls this on a timer so newly-decoded previews appear.
    pub fn poll_decodes(&mut self) -> Result<Option<ModelRc<ColumnView>>> {
        // What:     `let landed = self.preview_cache.drain_results();` collects ready
        //           bitmaps and returns how many landed.
        // Why:      Only republish when something changed.
        let landed = self.preview_cache.drain_results();
        // What:     `if landed > 0 { Ok(Some(self.publish()?)) } else { Ok(None) }`
        //           republishes on new bitmaps, else reports nothing to do.
        // Why:      Show the decoded previews without a needless republish.
        if landed > 0 {
            Ok(Some(self.publish()?))
        } else {
            Ok(None)
        }
    }

    /// What:     `pub fn on_key_nav(&mut self, key: &str) ->
    ///           Result<ModelRc<ColumnView>>` handles a navigation command.
    /// Why:      Arrow keys and the on-screen buttons both route here.
    pub fn on_key_nav(&mut self, key: &str) -> Result<ModelRc<ColumnView>> {
        // What:     `self.apply_key_nav(key);` mutates active/scroll state.
        // Why:      Separate the state change from the publish.
        self.apply_key_nav(key);
        // What:     `self.publish()` republishes; tail expression.
        // Why:      Reflect the navigation.
        self.publish()
    }

    /// What:     `fn apply_key_nav(&mut self, key: &str)` maps a command string to
    ///           a state change. An if/else chain (this crate forbids `switch`).
    /// Why:      One place to interpret navigation commands.
    fn apply_key_nav(&mut self, key: &str) {
        // What:     `if key == "Right" { self.move_column(1); }` and the following
        //           branches dispatch each command.
        // Why:      Move the active column or pane, or close the column.
        if key == "Right" {
            self.move_column(1);
        } else if key == "Left" {
            self.move_column(-1);
        } else if key == "Down" {
            self.move_pane(1);
        } else if key == "Up" {
            self.move_pane(-1);
        } else if key == "Close" {
            self.close_active_column();
        }
    }

    /// What:     `fn move_column(&mut self, delta: i32)` shifts the active column
    ///           by `delta` (a signed 32-bit int) and scrolls it into view.
    /// Why:      Left/Right navigation.
    fn move_column(&mut self, delta: i32) {
        // What:     `if self.strip.columns.is_empty() { return; }` guards an empty
        //           strip.
        // Why:      Nothing to move.
        if self.strip.columns.is_empty() {
            return;
        }
        // What:     `let last = (self.strip.columns.len() - 1) as i32;` is the last
        //           valid index as a signed int for clamping.
        // Why:      `clamp` needs signed bounds.
        let last = (self.strip.columns.len() - 1) as i32;
        // What:     `let target = (self.active_column as i32 + delta).clamp(0, last)
        //           as usize;` adds the delta, clamps into range, and narrows back
        //           to an index.
        // Why:      Stay within the strip.
        let target = (self.active_column as i32 + delta).clamp(0, last) as usize;
        // What:     `self.active_column = target;` stores the new active column.
        // Why:      Focus moved.
        self.active_column = target;
        // What:     `self.clamp_active_pane();` keeps the active pane valid in the
        //           new column.
        // Why:      Columns have different pane counts.
        self.clamp_active_pane();
        // What:     `self.h_offset_px = (target as f32 * column_pitch_px())
        //           .min(self.max_h_offset());` aligns the new column to the left
        //           edge, clamped to the strip end.
        // Why:      Bring the active column into view.
        self.h_offset_px = (target as f32 * column_pitch_px()).min(self.max_h_offset());
    }

    /// What:     `fn move_pane(&mut self, delta: i32)` shifts the active pane and
    ///           scrolls the active column so it is visible.
    /// Why:      Up/Down navigation.
    fn move_pane(&mut self, delta: i32) {
        // What:     `let column_index = self.active_column;` names the column.
        // Why:      Pane navigation is within the active column.
        let column_index = self.active_column;
        // What:     `let panes = self.strip.columns[column_index].panes.len();`
        //           reads the pane count.
        // Why:      Bound the target.
        let panes = self.strip.columns[column_index].panes.len();
        // What:     `if panes == 0 { return; }` guards an empty column.
        // Why:      Nothing to move.
        if panes == 0 {
            return;
        }
        // What:     `let target = (self.active_pane as i32 + delta).clamp(0, (panes
        //           - 1) as i32) as usize;` clamps the new pane index.
        // Why:      Stay within the column.
        let target = (self.active_pane as i32 + delta).clamp(0, (panes - 1) as i32) as usize;
        // What:     `self.active_pane = target;` stores it.
        // Why:      Focus moved.
        self.active_pane = target;
        // What:     `self.v_offset_px = (target as f32 * pane_pitch_px())
        //           .min(self.max_v_offset());` aligns the active pane to the top of
        //           the shared vertical viewport.
        // Why:      Bring the active pane into view; the whole strip scrolls with it.
        self.v_offset_px = (target as f32 * pane_pitch_px()).min(self.max_v_offset());
    }

    /// What:     `fn close_active_column(&mut self)` removes the active column,
    ///           demonstrating explicit lifecycle (Niri-style close).
    /// Why:      Bulk-close gestures accumulate from spawn-on-descent; this is the
    ///           minimal single-column close.
    fn close_active_column(&mut self) {
        // What:     `if self.strip.columns.len() <= 1 { return; }` keeps at least
        //           one column.
        // Why:      An empty strip has nothing to show.
        if self.strip.columns.len() <= 1 {
            return;
        }
        // What:     `let column_index = self.active_column;` names the victim.
        // Why:      Remove this one.
        let column_index = self.active_column;
        // What:     `self.strip.columns.remove(column_index);` deletes the column
        //           and shifts the rest left.
        // Why:      The column is gone; its panes lose existence (identity dropped
        //           only on explicit close).
        self.strip.columns.remove(column_index);
        // What:     `if self.active_column >= self.strip.columns.len() { ... }`
        //           clamps the active column after removal.
        // Why:      Closing the last column moves focus to the new last one.
        if self.active_column >= self.strip.columns.len() {
            self.active_column = self.strip.columns.len() - 1;
        }
        // What:     `self.clamp_active_pane();` keeps the active pane valid.
        // Why:      The new active column may be shorter.
        self.clamp_active_pane();
        // What:     `self.h_offset_px = self.h_offset_px.min(self.max_h_offset());`
        //           reins the scroll back inside the now-shorter strip.
        // Why:      The strip lost a column of width.
        self.h_offset_px = self.h_offset_px.min(self.max_h_offset());
        // What:     `self.refresh_totals();` recomputes the total-* counters.
        // Why:      The strip shrank, so totals changed.
        self.refresh_totals();
        // What:     `self.max_column_height_px = compute_max_column_height(&self.strip);`
        //           recomputes the tallest column after removal.
        // Why:      The removed column may have been the tallest.
        self.max_column_height_px = compute_max_column_height(&self.strip);
        // What:     `self.v_offset_px = self.v_offset_px.min(self.max_v_offset());`
        //           reins the vertical scroll into the new range.
        // Why:      A shorter strip may have a smaller vertical range.
        self.v_offset_px = self.v_offset_px.min(self.max_v_offset());
    }

    /// What:     `fn clamp_active_pane(&mut self)` keeps the active pane index in
    ///           range for the active column.
    /// Why:      Switching columns or closing one can leave it out of range.
    fn clamp_active_pane(&mut self) {
        // What:     `let panes = self.strip.columns[self.active_column].panes.len();`
        //           reads the current column's pane count.
        // Why:      The clamp bound.
        let panes = self.strip.columns[self.active_column].panes.len();
        // What:     `if panes == 0 { self.active_pane = 0; }` handles an empty
        //           column; `else if self.active_pane >= panes { ... }` clamps.
        // Why:      Never index past the pane list.
        if panes == 0 {
            self.active_pane = 0;
        } else if self.active_pane >= panes {
            self.active_pane = panes - 1;
        }
    }

    /// What:     `fn max_h_offset(&self) -> f32` is the largest valid horizontal
    ///           offset.
    /// Why:      Scroll and navigation clamp to it.
    fn max_h_offset(&self) -> f32 {
        // What:     `(self.strip_width_px() - self.viewport_w_px).max(0.0)`; tail.
        // Why:      Content width minus the viewport is the scroll range.
        (self.strip_width_px() - self.viewport_w_px).max(0.0)
    }

    /// What:     `fn max_v_offset(&self) -> f32` is the largest valid vertical
    ///           offset: the tallest column's height minus the viewport.
    /// Why:      Vertical scroll and pane navigation clamp to it.
    fn max_v_offset(&self) -> f32 {
        // What:     `(self.max_column_height_px - self.viewport_h_px).max(0.0)`; tail.
        // Why:      The tallest column's height minus the viewport is the range.
        (self.max_column_height_px - self.viewport_h_px).max(0.0)
    }

    /// What:     `fn refresh_totals(&self)` recomputes the full-strip counters.
    /// Why:      Called at startup and whenever the strip changes.
    fn refresh_totals(&self) {
        // What:     `self.instrumentation.total_columns.set(self.strip.columns.len());`
        //           records the column count.
        // Why:      HUD denominator.
        self.instrumentation.total_columns.set(self.strip.columns.len());
        // What:     `let mut panes: usize = 0;` and `let mut rows: u64 = 0;` are
        //           running totals.
        // Why:      Sum panes and addressable rows across the strip.
        let mut panes: usize = 0;
        let mut rows: u64 = 0;
        // What:     `for column in &self.strip.columns` borrows each column.
        // Why:      Walk every column.
        for column in &self.strip.columns {
            // What:     `panes += column.panes.len();` adds this column's panes.
            // Why:      Total pane count.
            panes += column.panes.len();
            // What:     `for pane in &column.panes` borrows each pane.
            // Why:      Sum directory rows.
            for pane in &column.panes {
                // What:     `if let PaneKind::Directory { row_total } = &pane.kind
                //           { rows += *row_total as u64; }` matches only directory
                //           panes; `&pane.kind` borrows the enum; `*row_total`
                //           copies the borrowed count.
                // Why:      Only directory panes address rows.
                if let PaneKind::Directory { row_total } = &pane.kind {
                    rows += *row_total as u64;
                }
            }
        }
        // What:     `self.instrumentation.total_panes.set(panes);` records panes.
        // Why:      HUD total.
        self.instrumentation.total_panes.set(panes);
        // What:     `self.instrumentation.total_rows_addressable.set(rows);` records
        //           the addressable-row total.
        // Why:      HUD denominator for the row-virtualization headline.
        self.instrumentation.total_rows_addressable.set(rows);
    }
}

/// What:     `fn compute_max_column_height(strip: &Strip) -> f32` finds the tallest
///           column's content height.
/// Why:      The global vertical scroll range spans it; recomputed on strip change.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function computeMaxColumnHeight(strip): number { return Math.max(0, ...strip.columns.map(c => c.heightPx())); }
/// ```
fn compute_max_column_height(strip: &Strip) -> f32 {
    // What:     `strip.columns.iter().map(|column| column.height_px()).fold(0.0,
    //           f32::max)` maps each column to its height and folds them with the
    //           max function. `|column| ...` is a closure; `f32::max` is a function
    //           value passed to `fold`.
    // Why:      The largest column height is the shared vertical range. Tail
    //           expression, so it is returned.
    strip
        .columns
        .iter()
        .map(|column| column.height_px())
        .fold(0.0, f32::max)
}

/// What:     `impl Default for Controller` provides `Controller::default()`.
/// Why:      Clippy asks for `Default` beside a no-argument `new`.
impl Default for Controller {
    /// What:     `fn default() -> Self` delegates to `new`.
    /// Why:      One definition of the initial state.
    fn default() -> Self {
        // What:     `Self::new()` builds the standard controller; tail expression.
        // Why:      Default equals the normal construction.
        Self::new()
    }
}
