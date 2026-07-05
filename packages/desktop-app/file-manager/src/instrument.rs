//! Shared instrumentation counters. Everything the HUD shows lives here, so the
//! measurement has one source of truth. The controller mutates these during a
//! republish; the custom row model records row access here; a UI-thread timer
//! mirrors these into the Slint HUD properties. All fields use interior
//! mutability (`Cell`/`RefCell`) so the whole struct can be shared read-only
//! through an `Rc` and still be updated from callbacks.

/// What:     `use std::cell::Cell;` imports single-value interior mutability for
///           `Copy` types (siblings: `RefCell` for non-`Copy`, `Mutex` for
///           cross-thread).
/// Why:      Counters are `Copy` integers shared behind an `Rc`, so `Cell` lets
///           callbacks mutate them without a `&mut`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // a mutable number field; TS needs no wrapper
/// ```
use std::cell::Cell;

/// What:     `use std::cell::RefCell;` imports interior mutability for non-`Copy`
///           values (the `HashSet` below).
/// Why:      The set of materialized rows is not `Copy`, so it needs `RefCell`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // a mutable Set field
/// ```
use std::cell::RefCell;

/// What:     `use std::collections::HashSet;` imports a hash set (sibling: `Vec`
///           for a list that allows duplicates).
/// Why:      Distinct (pane, row) keys must be counted once each.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // new Set<number>()
/// ```
use std::collections::HashSet;

/// What:     `pub const ROW_KEY_SHIFT: u32 = 32;` is the bit shift that packs a
///           pane id and a row index into one `u64` key.
/// Why:      Row indices fit in the low 32 bits, pane ids in the high 32 bits, so
///           the combined key is unique per (pane, row).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const ROW_KEY_SHIFT = 32n;
/// ```
pub const ROW_KEY_SHIFT: u32 = 32;

/// What:     `pub struct Instrumentation` groups every counter the HUD reads.
/// Why:      One shared object keeps the measurement consistent and easy to
///           mirror into Slint.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Instrumentation = { totalColumns: number; ...; materializedRows: Set<number> };
/// ```
pub struct Instrumentation {
    /// What:     `pub total_columns: Cell<usize>` counts every column in the full
    ///           strip.
    /// Why:      The "total" side of the resident/total ratio.
    pub total_columns: Cell<usize>,
    /// What:     `pub resident_columns: Cell<usize>` counts columns in the last
    ///           published window.
    /// Why:      The "resident" side; it must stay small.
    pub resident_columns: Cell<usize>,
    /// What:     `pub total_panes: Cell<usize>` counts every pane in the strip.
    /// Why:      Total pane identity cost.
    pub total_panes: Cell<usize>,
    /// What:     `pub resident_panes: Cell<usize>` counts panes in the window.
    /// Why:      Instantiated panes; must stay viewport-bound.
    pub resident_panes: Cell<usize>,
    /// What:     `pub total_rows_addressable: Cell<u64>` sums every directory
    ///           pane's advertised row count. `u64` (not `usize`/`u32`) because
    ///           the sum can exceed a 32-bit range.
    /// Why:      The huge denominator the row-virtualization headline divides.
    pub total_rows_addressable: Cell<u64>,
    /// What:     `pub decoded_image_bytes: Cell<usize>` is the resident decoded
    ///           bitmap memory.
    /// Why:      Proves decoded memory stays viewport-bound.
    pub decoded_image_bytes: Cell<usize>,
    /// What:     `pub decode_count: Cell<u64>` counts decodes performed.
    /// Why:      Rising after scroll-back proves previews re-decode, not persist.
    pub decode_count: Cell<u64>,
    /// What:     `pub pending_decodes: Cell<usize>` counts previews whose decode is
    ///           in flight on the background worker (requested, not yet delivered).
    /// Why:      Shows the decode is off the UI thread; the queue drains without
    ///           blocking scrolling.
    pub pending_decodes: Cell<usize>,
    /// What:     `pub column_builds: Cell<u64>` counts Slint column `init` fires.
    /// Why:      Cross-checks Slint instantiates the window, and that the total
    ///           grows with scroll distance (recycling), not with strip size.
    pub column_builds: Cell<u64>,
    /// What:     `pub pane_builds: Cell<u64>` counts Slint pane `init` fires.
    /// Why:      Same recycling cross-check at the pane level.
    pub pane_builds: Cell<u64>,
    /// What:     `pub active_column: Cell<usize>` is the focused column index.
    /// Why:      Keyboard navigation and the focus-survival check track it.
    pub active_column: Cell<usize>,
    /// What:     `pub active_pane: Cell<usize>` is the focused pane index within
    ///           the active column.
    /// Why:      Same as above at the pane level.
    pub active_pane: Cell<usize>,
    /// What:     `pub active_pane_focused: Cell<bool>` mirrors whether the active
    ///           pane's Slint FocusScope currently holds focus.
    /// Why:      This is the read-back that proves focus survives recycling.
    pub active_pane_focused: Cell<bool>,
    /// What:     `pub materialized_rows: RefCell<HashSet<u64>>` holds the distinct
    ///           (pane, row) keys the ListView ever asked the row model for.
    /// Why:      Its size is the count of rows Slint actually materialized, the
    ///           direct measure of row virtualization.
    pub materialized_rows: RefCell<HashSet<u64>>,
}

/// What:     `impl Instrumentation` attaches constructor and helper methods.
/// Why:      Callers need a zeroed instance and a row-record helper.
impl Instrumentation {
    /// What:     `pub fn new() -> Self` builds a zeroed instrumentation record.
    ///           `Self` is the type being implemented (`Instrumentation`).
    /// Why:      One place to initialize every counter to zero/empty.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// static new(): Instrumentation { return { totalColumns: 0, ... }; }
    /// ```
    pub fn new() -> Self {
        // What:     `Self { ... }` constructs the struct. `Cell::new(0)` wraps a
        //           starting zero; `RefCell::new(HashSet::new())` wraps an empty
        //           set. This is the tail expression (no `;`), so it is returned.
        // Why:      Every counter starts empty before the first strip is built.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { totalColumns: 0, ..., materializedRows: new Set() };
        // ```
        Self {
            total_columns: Cell::new(0),
            resident_columns: Cell::new(0),
            total_panes: Cell::new(0),
            resident_panes: Cell::new(0),
            total_rows_addressable: Cell::new(0),
            decoded_image_bytes: Cell::new(0),
            decode_count: Cell::new(0),
            pending_decodes: Cell::new(0),
            column_builds: Cell::new(0),
            pane_builds: Cell::new(0),
            active_column: Cell::new(0),
            active_pane: Cell::new(0),
            active_pane_focused: Cell::new(false),
            materialized_rows: RefCell::new(HashSet::new()),
        }
    }

    /// What:     `pub fn record_row_access(&self, pane_id: u64, row_index: usize)`
    ///           records that the ListView pulled one row from one pane. `&self`
    ///           borrows read-only; interior mutability does the write.
    /// Why:      The custom row model calls this on every `row_data`, building the
    ///           distinct-materialized-rows set.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// recordRowAccess(paneId: number, rowIndex: number) {
    ///   this.materializedRows.add((paneId << 32) | rowIndex);
    /// }
    /// ```
    pub fn record_row_access(&self, pane_id: u64, row_index: usize) {
        // What:     `let key = (pane_id << ROW_KEY_SHIFT) | row_index as u64;`
        //           packs the pane id (shifted into the high bits) with the row
        //           index (`as u64`) using bitwise OR.
        // Why:      One unique key per (pane, row) pair.
        let key = (pane_id << ROW_KEY_SHIFT) | row_index as u64;
        // What:     `self.materialized_rows.borrow_mut().insert(key);` takes a
        //           checked mutable borrow of the set and inserts the key.
        //           `.insert` ignores duplicates.
        // Why:      Count each distinct materialized row exactly once.
        // Gotcha:   `borrow_mut` panics if another borrow is live; row_data is
        //           only called on the UI thread, so no overlap occurs here.
        self.materialized_rows.borrow_mut().insert(key);
    }

    /// What:     `pub fn materialized_count(&self) -> usize` returns how many
    ///           distinct rows have been materialized.
    /// Why:      The HUD shows this against the huge addressable total.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// materializedCount(): number { return this.materializedRows.size; }
    /// ```
    pub fn materialized_count(&self) -> usize {
        // What:     `self.materialized_rows.borrow().len()` takes a read-only
        //           borrow of the set and returns its element count. Tail
        //           expression (no `;`).
        // Why:      Set size is the materialized-row count.
        self.materialized_rows.borrow().len()
    }
}

/// What:     `impl Default for Instrumentation` provides the `Default` trait so
///           `Instrumentation::default()` works. Clippy asks for `Default`
///           whenever a `new()` takes no arguments.
/// Why:      Satisfy clippy and give a conventional zero value.
impl Default for Instrumentation {
    /// What:     `fn default() -> Self` is the trait method; it just delegates.
    /// Why:      One definition of "empty", reused by `new`.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// // Instrumentation.default() === Instrumentation.new()
    /// ```
    fn default() -> Self {
        // What:     `Self::new()` calls the constructor above; tail expression.
        // Why:      Default is the same zeroed record.
        Self::new()
    }
}
