//! The custom Slint row model for a directory pane. It advertises a huge row
//! count but generates each `RowView` lazily inside `row_data`, and records every
//! access in the shared instrumentation. Because a `ListView` only calls
//! `row_data` for the rows it actually displays, the count of distinct accesses
//! is a direct, timing-free measurement of row virtualization: a pane can claim
//! 100000 rows while the ListView only ever materializes the visible handful.

/// What:     `use std::rc::Rc;` imports single-thread reference counting
///           (sibling: `Arc`, the atomic thread-safe version).
/// Why:      Every row model shares one `Instrumentation`; `Rc` is enough because
///           Slint models live on the UI thread only.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // a shared reference; TS shares objects by reference already
/// ```
use std::rc::Rc;

/// What:     `use slint::{Model, ModelNotify, ModelTracker, SharedString};`
///           imports the model trait, the change-notifier, the tracker trait it
///           implements, and Slint's reference-counted string (sibling: Rust's
///           owned `String`, which Slint cannot store directly in a property).
/// Why:      Implementing `Model` is how Rust feeds rows to a Slint `ListView`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Model, ModelNotify } from "slint";
/// ```
use slint::{Model, ModelNotify, ModelTracker, SharedString};

/// What:     `use crate::RowView;` imports the Slint-generated row struct from
///           the crate root (where `slint::include_modules!()` placed it). Its
///           fields are `label: SharedString` and `index: i32`.
/// Why:      `row_data` must return this exact generated type.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { RowView } from "./app.slint.generated";
/// ```
use crate::RowView;

/// What:     `use crate::instrument::Instrumentation;` imports the shared counter
///           struct.
/// Why:      The model records each row access there.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Instrumentation } from "./instrument";
/// ```
use crate::instrument::Instrumentation;

/// What:     `pub struct SyntheticRowModel` is the custom model. It stores the
///           owning pane's id, the advertised row `count`, a shared
///           `Instrumentation` handle, and a `ModelNotify`.
/// Why:      Enough state to generate rows lazily and record access, plus the
///           notifier Slint's tracking requires.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class SyntheticRowModel { paneId; count; instrumentation; notify; }
/// ```
pub struct SyntheticRowModel {
    /// What:     `pane_id: u64` is the owning pane's identity.
    /// Why:      Row-access keys combine pane id and row index.
    pane_id: u64,
    /// What:     `count: usize` is the advertised row total.
    /// Why:      `row_count` returns it; it can be 100000 with no per-row cost.
    count: usize,
    /// What:     `instrumentation: Rc<Instrumentation>` is the shared counter.
    /// Why:      Every access is recorded centrally so the HUD sums all panes.
    instrumentation: Rc<Instrumentation>,
    /// What:     `notify: ModelNotify` is Slint's per-model change notifier.
    /// Why:      `model_tracker` must hand Slint something implementing
    ///           `ModelTracker`; `ModelNotify` is the standard one.
    notify: ModelNotify,
}

/// What:     `impl SyntheticRowModel` attaches the constructor.
/// Why:      The view-builder needs a way to make one per directory pane.
impl SyntheticRowModel {
    /// What:     `pub fn new(pane_id: u64, count: usize, instrumentation:
    ///           Rc<Instrumentation>) -> Self` builds a model. Taking the `Rc`
    ///           by value moves a shared handle into the model.
    /// Why:      One model per visible directory pane, all sharing one counter.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// constructor(paneId, count, instrumentation) { ... }
    /// ```
    pub fn new(pane_id: u64, count: usize, instrumentation: Rc<Instrumentation>) -> Self {
        // What:     `Self { pane_id, count, instrumentation, notify:
        //           ModelNotify::default() }` constructs the model.
        //           `ModelNotify::default()` makes a fresh notifier. Tail
        //           expression (no `;`), so it is returned.
        // Why:      Store the identity/count/counter and a new notifier.
        Self {
            pane_id,
            count,
            instrumentation,
            notify: ModelNotify::default(),
        }
    }
}

/// What:     `impl Model for SyntheticRowModel` implements Slint's model trait for
///           this type. `type Data = RowView` sets the per-row value type.
/// Why:      A `ListView`'s `for row in pane.rows` drives these methods.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // implement the Model interface: rowCount(), rowData(i), tracker
/// ```
impl Model for SyntheticRowModel {
    /// What:     `type Data = RowView;` names the row value type Slint receives.
    /// Why:      The Slint array field is `[RowView]`, so each row is a `RowView`.
    type Data = RowView;

    /// What:     `fn row_count(&self) -> usize` reports the total row count.
    /// Why:      `ListView` uses it to size the scrollbar; it never forces the
    ///           rows to exist.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// rowCount(): number { return this.count; }
    /// ```
    fn row_count(&self) -> usize {
        // What:     `self.count` is the stored total; tail expression.
        // Why:      Advertise the full size cheaply.
        self.count
    }

    /// What:     `fn row_data(&self, row: usize) -> Option<Self::Data>` returns the
    ///           value for one row, or `None` if out of range. `Option` is Rust's
    ///           nullable (sibling: `Result` carries an error instead).
    /// Why:      Slint calls this only for rows it displays, so this is where
    ///           materialization and its measurement happen.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// rowData(row: number): RowView | undefined { ... }
    /// ```
    fn row_data(&self, row: usize) -> Option<Self::Data> {
        // What:     `if row >= self.count { return None; }` bounds-checks the
        //           request. `None` is the empty variant of `Option`.
        // Why:      Out-of-range rows have no data.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (row >= this.count) return undefined;
        // ```
        if row >= self.count {
            return None;
        }
        // What:     `self.instrumentation.record_row_access(self.pane_id, row);`
        //           records that Slint materialized this row.
        // Why:      This single call is the row-virtualization measurement.
        self.instrumentation.record_row_access(self.pane_id, row);
        // What:     `let label = format!("entry {:06}", row);`. `format!` builds an
        //           owned `String`; `{:06}` zero-pads the number to six digits.
        // Why:      A synthetic, readable row label without storing any real data.
        let label = format!("entry {:06}", row);
        // What:     `Some(RowView { label: SharedString::from(label), index: row
        //           as i32 })`. `Some(...)` is the present variant of `Option`;
        //           `SharedString::from` copies the owned `String` into Slint's
        //           string; `row as i32` narrows the `usize` index to Slint's int.
        // Why:      Hand Slint one fully-formed row value. Tail expression.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { label, index: row };
        // ```
        Some(RowView {
            label: SharedString::from(label),
            index: row as i32,
        })
    }

    /// What:     `fn model_tracker(&self) -> &dyn ModelTracker` hands Slint the
    ///           change-tracking object. `&dyn ModelTracker` is a borrowed trait
    ///           object (a reference to "something implementing ModelTracker").
    /// Why:      Slint uses it to know when rows change; ours never mutate, so the
    ///           default notifier suffices.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// modelTracker() { return this.notify; }
    /// ```
    fn model_tracker(&self) -> &dyn ModelTracker {
        // What:     `&self.notify` borrows the stored notifier as the trait
        //           object. `ModelNotify` implements `ModelTracker`. Tail
        //           expression.
        // Why:      Return the tracker Slint expects.
        &self.notify
    }
}
