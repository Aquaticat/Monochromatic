//! The controller owns the mutable app state and ONE persistent
//! `VecModel<ColumnView>`. Instead of replacing the model on every change (which
//! disturbs the Flickable's scroll), it mutates the model incrementally through
//! `Repeater`/`ModelNotify`: a horizontal scroll slides columns in and out at the
//! ends; a vertical scroll or active change rewrites the in-window columns'
//! rows in place; a landed decode refreshes just the owning column. The Flickable
//! owns `viewport-x`; model mutations never touch it, so wheel/drag scrolling is
//! free and smooth.

/// What:     `use std::collections::{HashMap, HashSet};` imports a map and a set.
/// Why:      Pane-to-column routing for decodes; a set of columns whose decode
///           landed and await refresh once scrolling settles.
use std::collections::{HashMap, HashSet};

/// What:     `use std::rc::Rc;` imports single-thread reference counting.
/// Why:      The instrumentation and the columns model are shared.
use std::rc::Rc;

/// What:     `use std::time::{Duration, Instant};` imports a time span and a
///           monotonic clock reading.
/// Why:      Measuring how long since the last horizontal scroll (settle gate).
use std::time::{Duration, Instant};

/// What:     `use slint::{ModelRc, VecModel};` imports the reference-counted model
///           wrapper and the vector-backed model. The mutation methods (in
///           `model_sync.rs`) use the trait methods; here we only build and share it.
/// Why:      The controller creates and hands out the persistent `VecModel`.
use slint::{ModelRc, VecModel};

/// What:     `use crate::ColumnView;` imports the generated column view struct.
/// Why:      The model element type.
use crate::ColumnView;

/// What:     `use crate::instrument::Instrumentation;` imports the shared counters.
/// Why:      The controller updates active/total/resident counts.
use crate::instrument::Instrumentation;

/// What:     `use crate::preview::PreviewCache;` imports the async decode cache.
/// Why:      The controller owns one for the app's lifetime.
use crate::preview::PreviewCache;

/// What:     `use crate::strip::{...};` imports the strip types, the column pitch,
///           the synthetic builder, and the pane-kind enum.
/// Why:      The controller owns and navigates the strip.
use crate::strip::{column_pitch_px, synthetic_strip, PaneKind, Strip};

/// What:     `use crate::model_sync::{build_pane_column_map, compute_max_column_height};`
///           imports the two strip helpers now living in the sibling module.
/// Why:      `new` and `close_active_column` still call them.
use crate::model_sync::{build_pane_column_map, compute_max_column_height};

/// What:     `pub const PREFETCH: usize = 2;` is the extra columns/panes each side.
/// Why:      Two prefetch columns buffer a fast scroll so the visible area is
///           always built before it is scrolled into view.
pub const PREFETCH: usize = 2;

/// What:     `const DEFAULT_VIEWPORT_W_PX: f32 = 1100.0;` is the assumed strip width.
/// Why:      Windowing needs a viewport width from the first frame.
const DEFAULT_VIEWPORT_W_PX: f32 = 1100.0;

/// What:     `const DEFAULT_VIEWPORT_H_PX: f32 = 600.0;` is the assumed strip height.
/// Why:      Windowing needs a viewport height from the first frame.
const DEFAULT_VIEWPORT_H_PX: f32 = 600.0;

/// What:     `const SCROLL_SETTLE_MS: u64 = 90;` is how long after the last
///           horizontal scroll the view is considered settled.
/// Why:      A landed decode refreshes its column only once scrolling settles, so
///           it never rebuilds a column mid-scroll.
const SCROLL_SETTLE_MS: u64 = 90;

/// What:     `pub struct Controller` holds the app state plus the persistent model.
/// Why:      One owner keeps the strip, scroll, active identity, cache, counters,
///           and the columns model consistent.
pub struct Controller {
    /// What:     `strip: Strip` is the full column-of-panes identity.
    /// Why:      The source every column build reads.
    pub(crate) strip: Strip,
    /// What:     `v_offset_px: f32` is the single shared vertical offset.
    /// Why:      Vertical scroll moves every column together.
    pub(crate) v_offset_px: f32,
    /// What:     `max_column_height_px: f32` is the tallest column's height.
    /// Why:      The vertical scroll range spans it.
    pub(crate) max_column_height_px: f32,
    /// What:     `h_offset_px: f32` is the horizontal scroll offset.
    /// Why:      Drives the column window.
    pub(crate) h_offset_px: f32,
    /// What:     `viewport_w_px: f32` is the visible strip width.
    /// Why:      Column window size.
    pub(crate) viewport_w_px: f32,
    /// What:     `viewport_h_px: f32` is the visible strip height.
    /// Why:      Pane window size.
    pub(crate) viewport_h_px: f32,
    /// What:     `active_column: usize` is the focused column index.
    /// Why:      Keyboard navigation and focus track it.
    pub(crate) active_column: usize,
    /// What:     `active_pane: usize` is the focused pane index.
    /// Why:      Same at the pane level.
    pub(crate) active_pane: usize,
    /// What:     `preview_cache: PreviewCache` owns the async decode lifecycle.
    /// Why:      Building preview panes requests decodes through it.
    pub(crate) preview_cache: PreviewCache,
    /// What:     `instrumentation: Rc<Instrumentation>` is the shared counters.
    /// Why:      Written on change, read by the HUD timer.
    pub(crate) instrumentation: Rc<Instrumentation>,
    /// What:     `columns_model: Rc<VecModel<ColumnView>>` is the persistent model.
    /// Why:      Mutated in place so the Repeater reuses elements and the Flickable
    ///           is undisturbed.
    pub(crate) columns_model: Rc<VecModel<ColumnView>>,
    /// What:     `window: (usize, usize)` is the `[start, end)` column range the
    ///           model currently holds (row 0 is column `start`).
    /// Why:      Incremental shifts diff against it.
    pub(crate) window: (usize, usize),
    /// What:     `pane_column: HashMap<u64, usize>` maps a pane id to its column.
    /// Why:      Routes a landed decode to the owning column in O(1).
    pub(crate) pane_column: HashMap<u64, usize>,
    /// What:     `last_h_change: Instant` is when the horizontal offset last moved.
    /// Why:      The settle gate for decode refreshes.
    pub(crate) last_h_change: Instant,
    /// What:     `pending_refresh: HashSet<usize>` holds columns whose decode landed
    ///           but which have not been refreshed yet (drained mid-scroll).
    /// Why:      Once scrolling settles, these columns refresh so the decoded preview
    ///           replaces its placeholder.
    pub(crate) pending_refresh: HashSet<usize>,
}

/// What:     `impl Controller` holds the state, constructor, and the
///           scroll/keyboard handlers; the model-mutation mechanics live
///           in `model_sync.rs`.
/// Why:      Keep each file under the line budget.
impl Controller {
    /// What:     `pub fn new() -> Self` builds the controller and populates the
    ///           initial window.
    /// Why:      One place to assemble and prime the app state.
    pub fn new() -> Self {
        // What:     `let instrumentation = Rc::new(Instrumentation::new());` wraps
        //           fresh counters.
        // Why:      Shared with the cache and models.
        let instrumentation = Rc::new(Instrumentation::new());
        // What:     `let strip = synthetic_strip();` builds the big test strip.
        // Why:      The thing being virtualized.
        let strip = synthetic_strip();
        // What:     `let max_column_height_px = compute_max_column_height(&strip);`
        //           finds the tallest column.
        // Why:      The vertical scroll range.
        let max_column_height_px = compute_max_column_height(&strip);
        // What:     `let preview_cache = PreviewCache::new(Rc::clone(&instrumentation));`
        //           starts the decode worker.
        // Why:      Preview decoding runs off the UI thread.
        let preview_cache = PreviewCache::new(Rc::clone(&instrumentation));
        // What:     `let pane_column = build_pane_column_map(&strip);` maps pane ids
        //           to columns.
        // Why:      O(1) decode routing.
        let pane_column = build_pane_column_map(&strip);
        // What:     `let columns_model = Rc::new(VecModel::from(Vec::<ColumnView>::new()));`
        //           makes the empty persistent model.
        // Why:      The window is populated below.
        let columns_model = Rc::new(VecModel::from(Vec::<ColumnView>::new()));
        // What:     `let mut controller = Self { ... };` assembles the state.
        // Why:      Build the controller with an empty window.
        let mut controller = Self {
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
            columns_model,
            window: (0, 0),
            pane_column,
            last_h_change: Instant::now(),
            pending_refresh: HashSet::new(),
        };
        // What:     `controller.refresh_totals();` fills the total-* counters.
        // Why:      HUD needs full-strip totals.
        controller.refresh_totals();
        // What:     `controller.sync_horizontal();` populates the initial window.
        // Why:      Build the first frame's columns.
        controller.sync_horizontal();
        // What:     `controller.after_change();` updates resident counts and evicts.
        // Why:      Keep the HUD and preview cache in step.
        controller.after_change();
        // What:     `controller` is the returned tail.
        // Why:      Hand back the primed controller.
        controller
    }

    /// What:     `pub fn columns_model_rc(&self) -> ModelRc<ColumnView>` hands out a
    ///           shared wrapper of the persistent model.
    /// Why:      The app sets it on the window ONCE; it is never replaced.
    pub fn columns_model_rc(&self) -> ModelRc<ColumnView> {
        // What:     `ModelRc::from(Rc::clone(&self.columns_model))` wraps the shared
        //           model; tail expression.
        // Why:      Slint iterates it; Rust keeps mutating the same instance.
        ModelRc::from(Rc::clone(&self.columns_model))
    }

    /// What:     `pub fn instrumentation(&self) -> Rc<Instrumentation>` shares the
    ///           counters.
    /// Why:      The HUD timer mirrors them.
    pub fn instrumentation(&self) -> Rc<Instrumentation> {
        // What:     `Rc::clone(&self.instrumentation)` bumps the refcount; tail.
        // Why:      Share, do not move.
        Rc::clone(&self.instrumentation)
    }

    /// What:     `pub fn strip_width_px(&self) -> f32` is the full content width.
    /// Why:      The Flickable's viewport-width uses it.
    pub fn strip_width_px(&self) -> f32 {
        // What:     `self.strip.columns.len() as f32 * column_pitch_px()`; tail.
        // Why:      Column count times pitch.
        self.strip.columns.len() as f32 * column_pitch_px()
    }

    /// What:     `pub fn h_offset_px(&self) -> f32` reads the horizontal offset.
    /// Why:      The app syncs the Flickable to it after keyboard navigation.
    pub fn h_offset_px(&self) -> f32 {
        // What:     `self.h_offset_px` tail expression.
        // Why:      Expose the value.
        self.h_offset_px
    }

    /// What:     `pub fn set_viewport(&mut self, width_px: f32, height_px: f32)`
    ///           records the real viewport size.
    /// Why:      Windowing matches what is drawn.
    pub fn set_viewport(&mut self, width_px: f32, height_px: f32) {
        // What:     Clamp both to at least 1 to avoid degenerate windows.
        // Why:      A zero viewport mid-resize must not break the maths.
        self.viewport_w_px = width_px.max(1.0);
        self.viewport_h_px = height_px.max(1.0);
    }

    /// What:     `pub fn set_active_focus(&self, focused: bool)` records the active
    ///           pane's focus state.
    /// Why:      The focus-survival check reads it back through the HUD.
    pub fn set_active_focus(&self, focused: bool) {
        // What:     `self.instrumentation.active_pane_focused.set(focused);` writes
        //           the shared flag.
        // Why:      Mirror focus for the HUD.
        self.instrumentation.active_pane_focused.set(focused);
    }

    /// What:     `pub fn set_h_offset(&mut self, offset_px: f32)` records the
    ///           horizontal offset. It does NOT touch the model.
    /// Why:      The Flickable reports pixels continuously; the frame tick slides
    ///           columns only when the window actually changes.
    pub fn set_h_offset(&mut self, offset_px: f32) {
        // What:     `self.h_offset_px = offset_px.max(0.0);` stores the clamp.
        // Why:      Never scroll before the first column.
        self.h_offset_px = offset_px.max(0.0);
        // What:     `self.last_h_change = Instant::now();` marks the scroll time.
        // Why:      The settle gate for decode refreshes.
        self.last_h_change = Instant::now();
    }

    /// What:     `pub fn frame_tick(&mut self)` is the per-frame work: refresh
    ///           columns for landed decodes (only when settled), then slide the
    ///           horizontal window if it changed.
    /// Why:      One timer applies both, incrementally, off the render frame.
    pub fn frame_tick(&mut self) {
        // What:     `let landed = self.preview_cache.drain_results();` collects the
        //           pane ids whose decode finished.
        // Why:      Each owning column needs a refresh to show the bitmap.
        let landed = self.preview_cache.drain_results();
        // What:     `for pane_id in landed { ... }` queues each landed decode's
        //           owning column for refresh (even mid-scroll, so it is not lost).
        // Why:      A decode drained during a scroll must still refresh on settle.
        for pane_id in landed {
            // What:     `let owner = self.pane_column.get(&pane_id).copied();` reads
            //           the owning column; `.copied()` releases the map borrow.
            // Why:      Release before the mutable-set insert.
            let owner = self.pane_column.get(&pane_id).copied();
            // What:     `if let Some(column_index) = owner { self.pending_refresh
            //           .insert(column_index); }` queues the column.
            // Why:      Flush it once scrolling settles.
            if let Some(column_index) = owner {
                self.pending_refresh.insert(column_index);
            }
        }
        // What:     `let settled = self.last_h_change.elapsed() >= Duration::
        //           from_millis(SCROLL_SETTLE_MS);` is true when not mid-scroll.
        // Why:      Avoid refreshing a column mid-scroll (churn).
        let settled = self.last_h_change.elapsed() >= Duration::from_millis(SCROLL_SETTLE_MS);
        // What:     `if settled && !self.pending_refresh.is_empty() { ... }` flushes
        //           the queued column refreshes.
        // Why:      Show the decoded previews once the user has stopped scrolling.
        if settled && !self.pending_refresh.is_empty() {
            // What:     `let columns: Vec<usize> = self.pending_refresh.drain()
            //           .collect();` empties the set into a vector, releasing its
            //           borrow before the `&mut self` refreshes.
            // Why:      Refresh each queued column.
            let columns: Vec<usize> = self.pending_refresh.drain().collect();
            // What:     `for column_index in columns { self.refresh_column(
            //           column_index); }` refreshes each (in-window ones only).
            // Why:      Replace the placeholders with decoded previews.
            for column_index in columns {
                self.refresh_column(column_index);
            }
        }
        // What:     `self.sync_horizontal();` slides the window to the current offset.
        // Why:      Stream columns in/out as the Flickable scrolls.
        self.sync_horizontal();
        // What:     `self.after_change();` updates counts and evicts off-window
        //           previews.
        // Why:      Keep the HUD and cache correct.
        self.after_change();
    }

    /// What:     `pub fn on_vertical_scroll(&mut self, percent: f32)` sets the shared
    ///           vertical offset and rewrites every in-window column in place.
    /// Why:      Vertical scroll changes every column's pane window at once.
    pub fn on_vertical_scroll(&mut self, percent: f32) {
        // What:     `self.v_offset_px = (percent / 100.0) * self.max_v_offset();`
        //           sets the offset from the percentage.
        // Why:      Move all columns' panes together.
        self.v_offset_px = (percent / 100.0) * self.max_v_offset();
        // What:     `self.refresh_all_in_window();` rewrites each column's row.
        // Why:      New vertical offset means new visible panes per column.
        self.refresh_all_in_window();
        // What:     `self.after_change();` updates counts and previews.
        // Why:      Keep state consistent.
        self.after_change();
    }

    /// What:     `pub fn on_key_nav(&mut self, key: &str)` applies a navigation
    ///           command and reconciles the model.
    /// Why:      Arrows and buttons route here.
    pub fn on_key_nav(&mut self, key: &str) {
        // What:     `let structural = self.apply_key_nav(key);` mutates state and
        //           reports whether the strip's shape changed (a close).
        // Why:      A close needs a full repopulate; the rest a slide + refresh.
        let structural = self.apply_key_nav(key);
        // What:     `if structural { ... } else { ... }` picks the reconcile path.
        // Why:      Close shifts every column index; a slide would misalign.
        if structural {
            // What:     `let (start, end) = self.column_window();` recomputes it.
            // Why:      Repopulate the whole window from the changed strip.
            let (start, end) = self.column_window();
            self.repopulate(start, end);
        } else {
            // What:     Slide the window (for a horizontal move) then rewrite the
            //           in-window columns (for the active-flag change).
            // Why:      Cover both a moved window and a moved focus.
            self.sync_horizontal();
            self.refresh_all_in_window();
        }
        // What:     `self.after_change();` finalizes counts and previews.
        // Why:      Keep state consistent.
        self.after_change();
    }

    /// What:     `fn apply_key_nav(&mut self, key: &str) -> bool` maps a command to a
    ///           state change and reports whether the strip's shape changed.
    /// Why:      A close changes column indices (structural); moves do not.
    fn apply_key_nav(&mut self, key: &str) -> bool {
        // What:     An if/else chain (this crate forbids `switch`); each branch is a
        //           tail expression returning the structural flag.
        // Why:      Dispatch the command and report structural-ness.
        if key == "Right" {
            self.move_column(1);
            false
        } else if key == "Left" {
            self.move_column(-1);
            false
        } else if key == "Down" {
            self.move_pane(1);
            false
        } else if key == "Up" {
            self.move_pane(-1);
            false
        } else if key == "Close" {
            self.close_active_column();
            true
        } else {
            false
        }
    }

    /// What:     `fn move_column(&mut self, delta: i32)` shifts the active column and
    ///           scrolls it toward the left edge.
    /// Why:      Left/Right navigation.
    fn move_column(&mut self, delta: i32) {
        // What:     `if self.strip.columns.is_empty() { return; }` guards empty.
        // Why:      Nothing to move.
        if self.strip.columns.is_empty() {
            return;
        }
        // What:     `let last = (self.strip.columns.len() - 1) as i32;` is the last
        //           index for clamping.
        // Why:      `clamp` needs signed bounds.
        let last = (self.strip.columns.len() - 1) as i32;
        // What:     `let target = (self.active_column as i32 + delta).clamp(0, last)
        //           as usize;` moves and clamps.
        // Why:      Stay within the strip.
        let target = (self.active_column as i32 + delta).clamp(0, last) as usize;
        // What:     `self.active_column = target;` stores it.
        // Why:      Focus moved.
        self.active_column = target;
        // What:     `self.clamp_active_pane();` keeps the pane valid.
        // Why:      Columns differ in pane count.
        self.clamp_active_pane();
        // What:     `self.set_h_offset((target as f32 * column_pitch_px())
        //           .min(self.max_h_offset()));` scrolls the column to the left edge.
        // Why:      Bring the active column into view.
        self.set_h_offset((target as f32 * column_pitch_px()).min(self.max_h_offset()));
    }

    /// What:     `fn move_pane(&mut self, delta: i32)` shifts the active pane and
    ///           scrolls the shared vertical viewport to show it.
    /// Why:      Up/Down navigation.
    fn move_pane(&mut self, delta: i32) {
        // What:     `let column_index = self.active_column;` names the column.
        // Why:      Pane nav is within the active column.
        let column_index = self.active_column;
        // What:     `let panes = self.strip.columns[column_index].panes.len();` reads
        //           the count.
        // Why:      Bound the target.
        let panes = self.strip.columns[column_index].panes.len();
        // What:     `if panes == 0 { return; }` guards an empty column.
        // Why:      Nothing to move.
        if panes == 0 {
            return;
        }
        // What:     `let target = (self.active_pane as i32 + delta).clamp(0, (panes -
        //           1) as i32) as usize;` clamps the pane index.
        // Why:      Stay within the column.
        let target = (self.active_pane as i32 + delta).clamp(0, (panes - 1) as i32) as usize;
        // What:     `self.active_pane = target;` stores it.
        // Why:      Focus moved.
        self.active_pane = target;
        // What:     `self.v_offset_px = (target as f32 * pane_pitch_px())
        //           .min(self.max_v_offset());` aligns the pane to the top.
        // Why:      Bring the active pane into view; the strip scrolls with it.
        self.v_offset_px =
            (target as f32 * crate::strip::pane_pitch_px()).min(self.max_v_offset());
    }

    /// What:     `fn close_active_column(&mut self)` removes the active column.
    /// Why:      Niri-style explicit close.
    fn close_active_column(&mut self) {
        // What:     `if self.strip.columns.len() <= 1 { return; }` keeps one column.
        // Why:      An empty strip has nothing to show.
        if self.strip.columns.len() <= 1 {
            return;
        }
        // What:     `self.strip.columns.remove(self.active_column);` deletes it.
        // Why:      The column is gone.
        self.strip.columns.remove(self.active_column);
        // What:     `if self.active_column >= self.strip.columns.len() { ... }` clamps
        //           the active column.
        // Why:      Closing the last moves focus to the new last.
        if self.active_column >= self.strip.columns.len() {
            self.active_column = self.strip.columns.len() - 1;
        }
        // What:     `self.clamp_active_pane();` keeps the pane valid.
        // Why:      The new active column may be shorter.
        self.clamp_active_pane();
        // What:     `self.h_offset_px = self.h_offset_px.min(self.max_h_offset());`
        //           reins the scroll into the shorter strip.
        // Why:      The strip lost a column of width.
        self.h_offset_px = self.h_offset_px.min(self.max_h_offset());
        // What:     `self.refresh_totals();` recomputes total-* counters.
        // Why:      The strip shrank.
        self.refresh_totals();
        // What:     `self.max_column_height_px = compute_max_column_height(&self.strip);`
        //           recomputes the tallest column.
        // Why:      The removed column may have been tallest.
        self.max_column_height_px = compute_max_column_height(&self.strip);
        // What:     `self.pane_column = build_pane_column_map(&self.strip);` rebuilds
        //           the pane-to-column routing.
        // Why:      Removal shifted every later column's index.
        self.pane_column = build_pane_column_map(&self.strip);
        // What:     `self.window = (0, 0);` forces the next reconcile to repopulate.
        // Why:      The model rows now point at shifted columns.
        self.window = (0, 0);
    }

    /// What:     `fn clamp_active_pane(&mut self)` keeps the active pane in range.
    /// Why:      Switching or closing a column can leave it out of range.
    fn clamp_active_pane(&mut self) {
        // What:     `let panes = self.strip.columns[self.active_column].panes.len();`
        //           reads the count.
        // Why:      The clamp bound.
        let panes = self.strip.columns[self.active_column].panes.len();
        // What:     `if panes == 0 { self.active_pane = 0; } else if ... { ... }`
        //           clamps to the last pane.
        // Why:      Never index past the list.
        if panes == 0 {
            self.active_pane = 0;
        } else if self.active_pane >= panes {
            self.active_pane = panes - 1;
        }
    }

    /// What:     `fn max_h_offset(&self) -> f32` is the largest horizontal offset.
    /// Why:      Scroll and navigation clamp to it.
    fn max_h_offset(&self) -> f32 {
        // What:     `(self.strip_width_px() - self.viewport_w_px).max(0.0)`; tail.
        // Why:      Content width minus viewport.
        (self.strip_width_px() - self.viewport_w_px).max(0.0)
    }

    /// What:     `fn max_v_offset(&self) -> f32` is the largest vertical offset.
    /// Why:      Vertical scroll and pane navigation clamp to it.
    fn max_v_offset(&self) -> f32 {
        // What:     `(self.max_column_height_px - self.viewport_h_px).max(0.0)`; tail.
        // Why:      Tallest column minus viewport.
        (self.max_column_height_px - self.viewport_h_px).max(0.0)
    }

    /// What:     `fn refresh_totals(&self)` recomputes the full-strip counters.
    /// Why:      Called at startup and on close.
    fn refresh_totals(&self) {
        // What:     `self.instrumentation.total_columns.set(self.strip.columns.len());`
        //           records the column count.
        // Why:      HUD denominator.
        self.instrumentation
            .total_columns
            .set(self.strip.columns.len());
        // What:     `let mut panes: usize = 0;` and `let mut rows: u64 = 0;` totals.
        // Why:      Sum panes and addressable rows.
        let mut panes: usize = 0;
        let mut rows: u64 = 0;
        // What:     `for column in &self.strip.columns { ... }` walks the strip.
        // Why:      Sum every column.
        for column in &self.strip.columns {
            // What:     `panes += column.panes.len();` adds this column's panes.
            // Why:      Total pane count.
            panes += column.panes.len();
            // What:     `for pane in &column.panes { ... }` sums directory rows.
            // Why:      Only directory panes address rows.
            for pane in &column.panes {
                // What:     `if let PaneKind::Directory { row_total } = &pane.kind {
                //           rows += *row_total as u64; }` adds the advertised rows.
                // Why:      The huge addressable-row denominator.
                if let PaneKind::Directory { row_total } = &pane.kind {
                    rows += *row_total as u64;
                }
            }
        }
        // What:     Mirror the totals.
        // Why:      HUD.
        self.instrumentation.total_panes.set(panes);
        self.instrumentation.total_rows_addressable.set(rows);
    }
}

/// What:     `impl Default for Controller` provides `Controller::default()`.
/// Why:      Clippy asks for `Default` beside a no-argument `new`.
impl Default for Controller {
    /// What:     `fn default() -> Self` delegates to `new`.
    /// Why:      One definition of the initial state.
    fn default() -> Self {
        // What:     `Self::new()` builds the standard controller; tail.
        // Why:      Default equals normal construction.
        Self::new()
    }
}
