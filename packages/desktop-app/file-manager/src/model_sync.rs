//! Model-mutation mechanics for the persistent columns `VecModel`, split from
//! `controller.rs` to keep each file under the line budget. These are a second
//! `impl Controller` block plus the two strip helpers: horizontal sliding,
//! in-place row refresh, single-column decode refresh, and the resident/live-
//! preview bookkeeping.

/// What:     `use std::collections::{HashMap, HashSet};` imports a map and set.
/// Why:      The pane-to-column map and the live-preview set.
use std::collections::{HashMap, HashSet};

/// What:     `use slint::Model;` imports the model trait for `row_count`/
///           `set_row_data` on the `VecModel`.
/// Why:      Those methods live on the trait, not the inherent `VecModel`.
use slint::Model;

/// What:     `use crate::ColumnView;` imports the generated column view struct.
/// Why:      The model element type.
use crate::ColumnView;

/// What:     `use crate::controller::{Controller, PREFETCH};` imports the type
///           this block extends and the prefetch constant.
/// Why:      A second `impl Controller` plus the shared window padding.
use crate::controller::{Controller, PREFETCH};

/// What:     `use crate::strip::{column_pitch_px, PaneKind, Strip};` imports the
///           column pitch, the pane-kind enum, and the strip type.
/// Why:      Windowing, preview detection, and the strip helpers.
use crate::strip::{column_pitch_px, PaneKind, Strip};

/// What:     `use crate::view::{build_column_view, column_pane_window, ColumnInput};`
///           imports the per-column builder, the pane-window helper, and its input.
/// Why:      Building and counting columns.
use crate::view::{build_column_view, column_pane_window, ColumnInput};

/// What:     `use crate::window::visible_range;` imports the bounded-window fn.
/// Why:      `column_window` uses it.
use crate::window::visible_range;

/// What:     `impl Controller` is the second impl block holding the model-mutation
///           methods.
/// Why:      Split from `controller.rs` for the line budget; same private state.
impl Controller {
    /// What:     `fn column_window(&self) -> (usize, usize)` computes the in-window
    ///           column range from the horizontal offset.
    /// Why:      Both the signature-free slide and the counts use it.
    pub(crate) fn column_window(&self) -> (usize, usize) {
        // What:     `let range = visible_range(...)` windows the columns.
        // Why:      Reuse the bounded-window maths.
        let range = visible_range(
            self.h_offset_px,
            self.viewport_w_px,
            column_pitch_px(),
            self.strip.columns.len(),
            PREFETCH,
        );
        // What:     `(range.start, range.end)` tail expression.
        // Why:      Hand back the endpoints.
        (range.start, range.end)
    }

    /// What:     `fn build_one(&mut self, column_index: usize) -> ColumnView` builds
    ///           one column's view (with its own panes model).
    /// Why:      Used by every model mutation that adds or refreshes a column.
    pub(crate) fn build_one(&mut self, column_index: usize) -> ColumnView {
        // What:     `build_column_view(ColumnInput { ... })` builds the column; the
        //           bundle borrows distinct fields at once. Tail expression.
        // Why:      Delegate the per-column build to the view module.
        build_column_view(ColumnInput {
            strip: &self.strip,
            column_index,
            v_offset_px: self.v_offset_px,
            viewport_h_px: self.viewport_h_px,
            active_column: self.active_column,
            active_pane: self.active_pane,
            prefetch: PREFETCH,
            preview_cache: &mut self.preview_cache,
            instrumentation: &self.instrumentation,
        })
    }

    /// What:     `fn sync_horizontal(&mut self)` slides the persistent model to match
    ///           the current column window, adding/removing only the delta columns.
    /// Why:      Staying columns keep their element instances, so scrolling never
    ///           churns them and the Flickable is undisturbed.
    pub(crate) fn sync_horizontal(&mut self) {
        // What:     `let (ns, ne) = self.column_window();` is the desired window;
        //           `let (os, oe) = self.window;` is the current one.
        // Why:      Diff them.
        let (ns, ne) = self.column_window();
        let (os, oe) = self.window;
        // What:     `if (ns, ne) == (os, oe) { return; }` skips when unchanged.
        // Why:      A sub-column scroll changes nothing to rebuild.
        if (ns, ne) == (os, oe) {
            return;
        }
        // What:     `if ns >= oe || ne <= os { self.repopulate(ns, ne); return; }`
        //           handles a disjoint jump (no overlap) by rebuilding the window.
        // Why:      A big jump has no columns to reuse.
        if ns >= oe || ne <= os {
            self.repopulate(ns, ne);
            return;
        }
        // What:     Front edge: remove columns that left the start, or insert
        //           columns that entered before the start.
        // Why:      Keep row 0 aligned with column `ns`.
        if ns > os {
            // What:     `for _ in os..ns { self.columns_model.remove(0); }` drops the
            //           leftmost rows. `remove(0)` fires row-removed.
            // Why:      Columns scrolled off the left.
            for _ in os..ns {
                self.columns_model.remove(0);
            }
        } else if ns < os {
            // What:     `for c in (ns..os).rev() { let cv = self.build_one(c);
            //           self.columns_model.insert(0, cv); }` prepends new columns in
            //           order (reverse iteration + insert-at-0).
            // Why:      Columns scrolled into view on the left.
            for c in (ns..os).rev() {
                let cv = self.build_one(c);
                self.columns_model.insert(0, cv);
            }
        }
        // What:     Back edge: remove columns that left the end, or push columns that
        //           entered after the end.
        // Why:      Keep the last row aligned with column `ne - 1`.
        if ne < oe {
            // What:     `for _ in ne..oe { let last = self.columns_model.row_count()
            //           - 1; self.columns_model.remove(last); }` drops the rightmost.
            // Why:      Columns scrolled off the right.
            for _ in ne..oe {
                let last = self.columns_model.row_count() - 1;
                self.columns_model.remove(last);
            }
        } else if ne > oe {
            // What:     `for c in oe..ne { let cv = self.build_one(c);
            //           self.columns_model.push(cv); }` appends new columns.
            // Why:      Columns scrolled into view on the right.
            for c in oe..ne {
                let cv = self.build_one(c);
                self.columns_model.push(cv);
            }
        }
        // What:     `self.window = (ns, ne);` records the new window.
        // Why:      The next slide diffs against it.
        self.window = (ns, ne);
    }

    /// What:     `fn repopulate(&mut self, start: usize, end: usize)` rebuilds the
    ///           whole window at once (a big jump or a structural change).
    /// Why:      No columns to reuse, so replace all rows.
    pub(crate) fn repopulate(&mut self, start: usize, end: usize) {
        // What:     `let mut views: Vec<ColumnView> = Vec::new();` accumulates them.
        // Why:      Built then set as one vector.
        let mut views: Vec<ColumnView> = Vec::new();
        // What:     `for c in start..end { views.push(self.build_one(c)); }` builds
        //           each in-window column.
        // Why:      Fill the window.
        for c in start..end {
            views.push(self.build_one(c));
        }
        // What:     `self.columns_model.set_vec(views);` replaces all rows at once.
        // Why:      One bulk update for the jump.
        self.columns_model.set_vec(views);
        // What:     `self.window = (start, end);` records the window.
        // Why:      Keep it in step.
        self.window = (start, end);
    }

    /// What:     `fn refresh_all_in_window(&mut self)` rewrites every in-window
    ///           column's row in place.
    /// Why:      A vertical scroll or active change alters each column's content.
    pub(crate) fn refresh_all_in_window(&mut self) {
        // What:     `let count = self.columns_model.row_count();` is the model size.
        // Why:      Iterate its rows.
        let count = self.columns_model.row_count();
        // What:     `for i in 0..count { ... }` rewrites each row.
        // Why:      Update column i (strip column window.0 + i).
        for i in 0..count {
            // What:     `let column_index = self.window.0 + i;` maps row to column.
            // Why:      Build the right column.
            let column_index = self.window.0 + i;
            // What:     `let cv = self.build_one(column_index);` rebuilds it.
            // Why:      New content for the row.
            let cv = self.build_one(column_index);
            // What:     `self.columns_model.set_row_data(i, cv);` fires row-changed.
            // Why:      Update the element in place, no full reset.
            self.columns_model.set_row_data(i, cv);
        }
    }

    /// What:     `fn refresh_column(&mut self, column_index: usize)` rewrites one
    ///           in-window column's row.
    /// Why:      A landed decode belongs to one column.
    pub(crate) fn refresh_column(&mut self, column_index: usize) {
        // What:     `if column_index < self.window.0 || column_index >= self.window.1
        //           { return; }` skips columns that are not in-window.
        // Why:      Nothing to update off-window.
        if column_index < self.window.0 || column_index >= self.window.1 {
            return;
        }
        // What:     `let row = column_index - self.window.0;` maps column to row.
        // Why:      Address the model row.
        let row = column_index - self.window.0;
        // What:     `let cv = self.build_one(column_index);` rebuilds it (now with the
        //           decoded preview resident).
        // Why:      Reflect the landed bitmap.
        let cv = self.build_one(column_index);
        // What:     `self.columns_model.set_row_data(row, cv);` fires row-changed.
        // Why:      Update just this column.
        self.columns_model.set_row_data(row, cv);
    }

    /// What:     `fn after_change(&mut self)` updates counts and evicts off-window
    ///           previews.
    /// Why:      Called after any model mutation.
    pub(crate) fn after_change(&mut self) {
        // What:     `self.update_counts();` refreshes the resident/active counters.
        // Why:      HUD accuracy.
        self.update_counts();
        // What:     `let live = self.collect_live_previews();` gathers in-window
        //           preview ids.
        // Why:      Everything else evicts.
        let live = self.collect_live_previews();
        // What:     `self.preview_cache.retain_only(&live);` frees off-window bitmaps.
        // Why:      Keep decoded memory viewport-bound.
        self.preview_cache.retain_only(&live);
    }

    /// What:     `fn update_counts(&self)` recomputes the resident/active counters.
    /// Why:      The HUD reads them.
    pub(crate) fn update_counts(&self) {
        // What:     `self.instrumentation.resident_columns.set(self.window.1 -
        //           self.window.0);` records the in-window column count.
        // Why:      HUD.
        self.instrumentation
            .resident_columns
            .set(self.window.1 - self.window.0);
        // What:     `let mut panes = 0;` sums in-window panes.
        // Why:      HUD resident-pane count.
        let mut panes = 0;
        // What:     `for c in self.window.0..self.window.1 { ... }` walks the window.
        // Why:      Sum each column's pane window length.
        for c in self.window.0..self.window.1 {
            panes += column_pane_window(
                &self.strip.columns[c],
                self.v_offset_px,
                self.viewport_h_px,
                PREFETCH,
            )
            .len();
        }
        // What:     Mirror the pane count and the active identity.
        // Why:      HUD.
        self.instrumentation.resident_panes.set(panes);
        self.instrumentation.active_column.set(self.active_column);
        self.instrumentation.active_pane.set(self.active_pane);
    }

    /// What:     `fn collect_live_previews(&self) -> HashSet<u64>` gathers the ids of
    ///           in-window preview panes.
    /// Why:      The preview cache evicts everything not in this set.
    pub(crate) fn collect_live_previews(&self) -> HashSet<u64> {
        // What:     `let mut set: HashSet<u64> = HashSet::new();` collects ids.
        // Why:      Returned to `retain_only`.
        let mut set: HashSet<u64> = HashSet::new();
        // What:     `for c in self.window.0..self.window.1 { ... }` walks the window.
        // Why:      Only in-window previews stay resident.
        for c in self.window.0..self.window.1 {
            // What:     `let column = &self.strip.columns[c];` borrows the column.
            // Why:      Read its panes.
            let column = &self.strip.columns[c];
            // What:     `let pw = column_pane_window(...)` windows its panes.
            // Why:      Only in-window panes count.
            let pw = column_pane_window(column, self.v_offset_px, self.viewport_h_px, PREFETCH);
            // What:     `for p in pw.start..pw.end { ... }` walks the pane window.
            // Why:      Collect preview ids.
            for p in pw.start..pw.end {
                // What:     `if let PaneKind::Preview { .. } = &column.panes[p].kind {
                //           set.insert(column.panes[p].id); }` records a preview.
                // Why:      Directory panes have no bitmap to keep.
                if let PaneKind::Preview { .. } = &column.panes[p].kind {
                    set.insert(column.panes[p].id);
                }
            }
        }
        // What:     `set` tail expression.
        // Why:      Hand back the live ids.
        set
    }

}

/// What:     `fn compute_max_column_height(strip: &Strip) -> f32` finds the tallest
///           column's content height.
/// Why:      The shared vertical scroll range spans it.
pub(crate) fn compute_max_column_height(strip: &Strip) -> f32 {
    // What:     `strip.columns.iter().map(|column| column.height_px()).fold(0.0,
    //           f32::max)` folds the column heights with the max function; tail.
    // Why:      The largest column height is the vertical range.
    strip
        .columns
        .iter()
        .map(|column| column.height_px())
        .fold(0.0, f32::max)
}

/// What:     `fn build_pane_column_map(strip: &Strip) -> HashMap<u64, usize>` maps
///           every pane id to its column index.
/// Why:      Routes a landed decode to the owning column in O(1).
pub(crate) fn build_pane_column_map(strip: &Strip) -> HashMap<u64, usize> {
    // What:     `let mut map: HashMap<u64, usize> = HashMap::new();` collects entries.
    // Why:      Filled per pane.
    let mut map: HashMap<u64, usize> = HashMap::new();
    // What:     `for (column_index, column) in strip.columns.iter().enumerate() { ... }`
    //           walks columns with their indices.
    // Why:      Record each pane's column.
    for (column_index, column) in strip.columns.iter().enumerate() {
        // What:     `for pane in &column.panes { map.insert(pane.id, column_index); }`
        //           records the mapping.
        // Why:      One entry per pane.
        for pane in &column.panes {
            map.insert(pane.id, column_index);
        }
    }
    // What:     `map` tail expression.
    // Why:      Hand back the routing map.
    map
}

