//! The publish step: turn the full strip plus the current scroll/active state
//! into the small bounded models Slint renders. This is the only place Rust
//! identity becomes Slint views. It computes the horizontal column window and,
//! for each in-window column, the vertical pane window; wires each directory
//! pane to a lazy row model; decodes each in-window preview and evicts the rest;
//! and updates the resident-count instrumentation.

/// What:     `use std::collections::HashSet;` imports the set type.
/// Why:      Collect the in-window preview pane ids so the cache can evict the
///           rest in one call.
use std::collections::HashSet;

/// What:     `use std::rc::Rc;` imports single-thread reference counting.
/// Why:      Each row model shares the one instrumentation handle.
use std::rc::Rc;

/// What:     `use anyhow::Result;` imports the one-parameter error result alias.
/// Why:      Preview decoding can fail; publishing propagates that.
use anyhow::Result;

/// What:     `use slint::{Image, ModelRc, VecModel};` imports Slint's image
///           handle, the reference-counted model wrapper a `for` iterates, and
///           the vector-backed model (sibling: a hand-written `Model` like the
///           row model).
/// Why:      The published columns and panes are `VecModel`s wrapped as `ModelRc`.
use slint::{Image, ModelRc, VecModel};

/// What:     `use crate::{ColumnView, PaneView, RowView};` imports the three
///           Slint-generated view structs from the crate root.
/// Why:      This module constructs them.
use crate::{ColumnView, PaneView, RowView};

/// What:     `use crate::instrument::Instrumentation;` imports the shared counters.
/// Why:      Resident column/pane counts are written here.
use crate::instrument::Instrumentation;

/// What:     `use crate::preview::PreviewCache;` imports the decode/evict cache.
/// Why:      In-window previews decode through it; off-window ones evict.
use crate::preview::PreviewCache;

/// What:     `use crate::rowmodel::SyntheticRowModel;` imports the lazy row model.
/// Why:      Each directory pane gets one so ListView virtualization is measured.
use crate::rowmodel::SyntheticRowModel;

/// What:     `use crate::strip::{...};` imports the strip types, the pane-kind
///           enum, the two pitch helpers, and the column width constant.
/// Why:      Publishing reads the strip and lays views out by pitch.
use crate::strip::{column_pitch_px, pane_pitch_px, PaneKind, Strip, COLUMN_WIDTH_PX};

/// What:     `use crate::window::visible_range;` imports the bounded-window fn.
/// Why:      Both the column and pane windows come from it.
use crate::window::visible_range;

/// What:     `pub struct PublishInput<'a>` bundles every input to the publish
///           step. The `'a` lifetime means the borrowed fields must outlive the
///           struct; it exists because several fields are references, not owned.
/// Why:      This crate's rule is that functions with 2+ parameters take one
///           named-field struct instead of a positional argument list.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PublishInput = { strip; hOffsetPx; viewportWPx; ...; previewCache; instrumentation };
/// ```
pub struct PublishInput<'a> {
    /// What:     `pub strip: &'a Strip` borrows the full strip read-only.
    /// Why:      Publishing reads identity but never mutates the strip.
    pub strip: &'a Strip,
    /// What:     `pub h_offset_px: f32` is the horizontal scroll offset.
    /// Why:      Drives the column window.
    pub h_offset_px: f32,
    /// What:     `pub viewport_w_px: f32` is the visible strip width.
    /// Why:      Column window size.
    pub viewport_w_px: f32,
    /// What:     `pub viewport_h_px: f32` is the visible strip height.
    /// Why:      Pane window size within each column.
    pub viewport_h_px: f32,
    /// What:     `pub v_offset_px: f32` is the single vertical scroll offset applied
    ///           to every column.
    /// Why:      Vertical scrolling moves the whole strip at once, not one column.
    pub v_offset_px: f32,
    /// What:     `pub active_column: usize` is the focused column index.
    /// Why:      Marks the active column and pane for focus.
    pub active_column: usize,
    /// What:     `pub active_pane: usize` is the focused pane index.
    /// Why:      Same, at the pane level.
    pub active_pane: usize,
    /// What:     `pub prefetch: usize` is the extra items each side of the window.
    /// Why:      One prefetch column/pane keeps scrolling smooth.
    pub prefetch: usize,
    /// What:     `pub preview_cache: &'a mut PreviewCache` borrows the cache
    ///           mutably. `&mut` means exclusive access for the borrow.
    /// Why:      Publishing decodes and evicts, both mutations.
    pub preview_cache: &'a mut PreviewCache,
    /// What:     `pub instrumentation: &'a Rc<Instrumentation>` borrows the shared
    ///           counter handle.
    /// Why:      Resident counts and row models need it.
    pub instrumentation: &'a Rc<Instrumentation>,
}

/// What:     `pub fn build_columns_model(input: PublishInput) -> Result<ModelRc<ColumnView>>`
///           builds the bounded columns model. Taking `input` by value moves the
///           bundle of borrows in.
/// Why:      The controller calls this on every user action and hands the result
///           to `AppWindow::set_columns`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function buildColumnsModel(input: PublishInput): ModelRc<ColumnView> { ... }
/// ```
pub fn build_columns_model(input: PublishInput) -> Result<ModelRc<ColumnView>> {
    // What:     `let column_window = visible_range(...)` computes which columns are
    //           in-window from the horizontal offset.
    // Why:      Only these columns get published.
    let column_window = visible_range(
        input.h_offset_px,
        input.viewport_w_px,
        column_pitch_px(),
        input.strip.columns.len(),
        input.prefetch,
    );
    // What:     `let mut column_views: Vec<ColumnView> = Vec::new();` accumulates
    //           the published columns.
    // Why:      Filled per in-window column below.
    let mut column_views: Vec<ColumnView> = Vec::new();
    // What:     `let mut live_previews: HashSet<u64> = HashSet::new();` collects
    //           the in-window preview pane ids.
    // Why:      Everything not in this set gets its bitmap evicted.
    let mut live_previews: HashSet<u64> = HashSet::new();
    // What:     `let mut resident_panes: usize = 0;` tallies published panes.
    // Why:      Reported to the HUD as the resident pane count.
    let mut resident_panes: usize = 0;
    // What:     `for column_index in column_window.start..column_window.end`
    //           iterates the in-window column indices (half-open range).
    // Why:      Build one ColumnView per in-window column.
    for column_index in column_window.start..column_window.end {
        // What:     `let column = &input.strip.columns[column_index];` borrows the
        //           column at this index read-only.
        // Why:      Read its panes without copying.
        let column = &input.strip.columns[column_index];
        // What:     `let v_offset = input.v_offset_px;` uses the single global
        //           vertical offset for this column.
        // Why:      Every column scrolls together, so they share one offset.
        let v_offset = input.v_offset_px;
        // What:     `let pane_window = visible_range(...)` computes the in-window
        //           panes for this column from its vertical offset.
        // Why:      Only these panes get published.
        let pane_window = visible_range(
            v_offset,
            input.viewport_h_px,
            pane_pitch_px(),
            column.panes.len(),
            input.prefetch,
        );
        // What:     `let mut pane_views: Vec<PaneView> = Vec::new();` accumulates
        //           this column's published panes.
        // Why:      Filled per in-window pane below.
        let mut pane_views: Vec<PaneView> = Vec::new();
        // What:     Inner loop over the in-window pane indices.
        // Why:      Build one PaneView per in-window pane.
        for pane_index in pane_window.start..pane_window.end {
            // What:     `let pane = &column.panes[pane_index];` borrows the pane.
            // Why:      Read its id and kind.
            let pane = &column.panes[pane_index];
            // What:     `let is_active = column_index == input.active_column &&
            //           pane_index == input.active_pane;` marks the focused pane.
            // Why:      The UI draws it highlighted and (re)focuses it.
            let is_active = column_index == input.active_column && pane_index == input.active_pane;
            // What:     `let y_px = pane_index as f32 * pane_pitch_px();` is the
            //           pane's absolute vertical position; `as f32` converts the
            //           index.
            // Why:      The UI positions the pane at this y minus the column offset.
            let y_px = pane_index as f32 * pane_pitch_px();
            // What:     `let pane_view = build_pane_view(...)?;` constructs one
            //           PaneView, decoding a preview if needed; `?` propagates a
            //           decode error.
            // Why:      Keep this loop readable; the per-pane work lives in a helper.
            let pane_view = build_pane_view(BuildPane {
                pane_id: pane.id,
                kind: &pane.kind,
                is_active,
                y_px,
                preview_cache: input.preview_cache,
                instrumentation: input.instrumentation,
                live_previews: &mut live_previews,
            })?;
            // What:     `pane_views.push(pane_view);` appends the built pane.
            // Why:      Add it to this column.
            pane_views.push(pane_view);
        }
        // What:     `resident_panes += pane_views.len();` adds this column's panes
        //           to the running total.
        // Why:      Accumulate the resident pane count.
        resident_panes += pane_views.len();
        // What:     `column_views.push(ColumnView { ... });` builds and appends the
        //           column view. `column_index as i32`/`as f32` narrow the index;
        //           `ModelRc::new(VecModel::from(pane_views))` wraps the panes as a
        //           model Slint can iterate.
        // Why:      Publish this column with its bounded pane window.
        column_views.push(ColumnView {
            strip_index: column_index as i32,
            x_px: column_index as f32 * column_pitch_px(),
            width_px: COLUMN_WIDTH_PX,
            is_active: column_index == input.active_column,
            panes: ModelRc::new(VecModel::from(pane_views)),
            column_height_px: column.height_px(),
            v_offset_px: v_offset,
        });
    }
    // What:     `input.preview_cache.retain_only(&live_previews);` evicts every
    //           decoded bitmap whose pane left the window.
    // Why:      Keep decoded memory viewport-bound.
    input.preview_cache.retain_only(&live_previews);
    // What:     `input.instrumentation.resident_columns.set(column_window.len());`
    //           records how many columns were published.
    // Why:      HUD resident-column count.
    input
        .instrumentation
        .resident_columns
        .set(column_window.len());
    // What:     `input.instrumentation.resident_panes.set(resident_panes);` records
    //           the published pane total.
    // Why:      HUD resident-pane count.
    input.instrumentation.resident_panes.set(resident_panes);
    // What:     `Ok(ModelRc::new(VecModel::from(column_views)))` wraps the columns
    //           as a model and returns success; tail expression.
    // Why:      The controller assigns this to the window's `columns` property.
    Ok(ModelRc::new(VecModel::from(column_views)))
}

/// What:     `struct BuildPane<'a>` bundles the inputs for building one pane view.
/// Why:      Same named-field-struct rule as `PublishInput`; keeps the per-pane
///           helper's signature to a single argument.
struct BuildPane<'a> {
    /// What:     `pane_id: u64` is the pane's stable identity.
    /// Why:      Row-access keys and preview-cache keys use it.
    pane_id: u64,
    /// What:     `kind: &'a PaneKind` borrows the pane's directory/preview tag.
    /// Why:      Decides which branch builds the view.
    kind: &'a PaneKind,
    /// What:     `is_active: bool` marks the focused pane.
    /// Why:      The UI highlights and focuses it.
    is_active: bool,
    /// What:     `y_px: f32` is the pane's absolute vertical position.
    /// Why:      Passed straight into the view for placement.
    y_px: f32,
    /// What:     `preview_cache: &'a mut PreviewCache` borrows the cache mutably.
    /// Why:      A preview pane decodes through it.
    preview_cache: &'a mut PreviewCache,
    /// What:     `instrumentation: &'a Rc<Instrumentation>` borrows the counters.
    /// Why:      A directory pane's row model shares it.
    instrumentation: &'a Rc<Instrumentation>,
    /// What:     `live_previews: &'a mut HashSet<u64>` borrows the live-preview set
    ///           mutably.
    /// Why:      A preview pane records its id here so it is not evicted.
    live_previews: &'a mut HashSet<u64>,
}

/// What:     `fn build_pane_view(build: BuildPane) -> Result<PaneView>` constructs
///           one directory or preview PaneView.
/// Why:      Splitting it out keeps the publish loop short and one-concept.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function buildPaneView(build: BuildPane): PaneView { ... }
/// ```
fn build_pane_view(build: BuildPane) -> Result<PaneView> {
    // What:     `match build.kind { ... }` branches on the pane-kind enum. Every
    //           variant must be handled.
    // Why:      Directory and preview panes build different views.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // switch (build.kind.tag) { case "directory": ...; case "preview": ...; }
    // ```
    match build.kind {
        // What:     `PaneKind::Directory { row_total }` matches the directory
        //           variant and binds its `row_total` field.
        // Why:      Build a listing pane with a lazy row model.
        PaneKind::Directory { row_total } => {
            // What:     `let rows = ModelRc::new(SyntheticRowModel::new(build
            //           .pane_id, *row_total, Rc::clone(build.instrumentation)));`
            //           builds the lazy row model; `*row_total` copies the borrowed
            //           `usize`; `Rc::clone` shares the counters.
            // Why:      ListView pulls rows from this model on demand.
            let rows = ModelRc::new(SyntheticRowModel::new(
                build.pane_id,
                *row_total,
                Rc::clone(build.instrumentation),
            ));
            // What:     `Ok(PaneView { ... })` builds the directory view. `kind: 0`
            //           tags it as a directory; `preview: Image::default()` is an
            //           empty image; `resident: false` because there is no bitmap.
            //           `*row_total as i32` narrows the count for the label.
            // Why:      Hand back a directory pane view.
            Ok(PaneView {
                pane_id: build.pane_id as i32,
                kind: 0,
                title: directory_title(build.pane_id, *row_total),
                y_px: build.y_px,
                height_px: crate::strip::PANE_HEIGHT_PX,
                is_active: build.is_active,
                rows,
                row_total: *row_total as i32,
                preview: Image::default(),
                resident: false,
            })
        }
        // What:     `PaneKind::Preview { seed }` matches the preview variant and
        //           binds its `seed`.
        // Why:      Build a preview pane by decoding its bitmap.
        PaneKind::Preview { seed } => {
            // What:     `build.live_previews.insert(build.pane_id);` records this
            //           pane as in-window so its bitmap is retained.
            // Why:      Eviction keeps only ids in this set.
            build.live_previews.insert(build.pane_id);
            // What:     `let image = build.preview_cache.request_preview(build
            //           .pane_id, *seed);` returns `Some(image)` if already decoded,
            //           else `None` after queuing a background decode.
            // Why:      Never block the publish on decoding; a placeholder shows
            //           until the worker delivers the bitmap.
            let image = build.preview_cache.request_preview(build.pane_id, *seed);
            // What:     `let resident = image.is_some();` records whether the bitmap
            //           is ready. `.is_some()` tests the `Option`.
            // Why:      The UI shows a placeholder while it is not yet resident.
            let resident = image.is_some();
            // What:     `let rows = ModelRc::new(VecModel::from(Vec::<RowView>::new()));`
            //           is an empty row model; a preview pane has no rows.
            // Why:      The generated struct still needs a `rows` value.
            let rows = ModelRc::new(VecModel::from(Vec::<RowView>::new()));
            // What:     `Ok(PaneView { ... })` builds the preview view. `kind: 1`
            //           tags it as a preview; `image.unwrap_or_default()` yields the
            //           decoded image or an empty one; `resident` reflects readiness.
            // Why:      Hand back a preview pane view.
            Ok(PaneView {
                pane_id: build.pane_id as i32,
                kind: 1,
                title: preview_title(build.pane_id),
                y_px: build.y_px,
                height_px: crate::strip::PANE_HEIGHT_PX,
                is_active: build.is_active,
                rows,
                row_total: 0,
                preview: image.unwrap_or_default(),
                resident,
            })
        }
    }
}

/// What:     `fn directory_title(pane_id: u64, row_total: usize) -> slint::SharedString`
///           formats a directory pane's title.
/// Why:      A readable, identity-bearing label for the pane header.
fn directory_title(pane_id: u64, row_total: usize) -> slint::SharedString {
    // What:     `slint::SharedString::from(format!(...))` builds an owned string
    //           and copies it into Slint's string; tail expression.
    // Why:      Show the pane id and its advertised row count.
    slint::SharedString::from(format!("dir #{pane_id}  ({row_total} rows)"))
}

/// What:     `fn preview_title(pane_id: u64) -> slint::SharedString` formats a
///           preview pane's title.
/// Why:      A readable label for the preview header.
fn preview_title(pane_id: u64) -> slint::SharedString {
    // What:     `slint::SharedString::from(format!(...))` builds the label; tail.
    // Why:      Show the pane id.
    slint::SharedString::from(format!("preview #{pane_id}"))
}
