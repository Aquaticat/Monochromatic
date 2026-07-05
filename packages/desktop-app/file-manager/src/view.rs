//! The per-column view builder. The controller keeps ONE persistent
//! `VecModel<ColumnView>` and mutates it incrementally (insert/remove/row-changed)
//! so the Repeater reuses element instances and the Flickable's scroll is never
//! disturbed. This module builds a single `ColumnView` (with its own panes model)
//! on demand: for a column entering the window, or for a column whose content
//! changed (vertical scroll, active change, a landed decode).

/// What:     `use std::rc::Rc;` imports single-thread reference counting.
/// Why:      Each row model shares the one instrumentation handle.
use std::rc::Rc;

/// What:     `use slint::{Image, ModelRc, VecModel};` imports Slint's image handle,
///           the reference-counted model wrapper, and the vector-backed model.
/// Why:      A column's panes are a `VecModel` wrapped as a `ModelRc`.
use slint::{Image, ModelRc, VecModel};

/// What:     `use crate::{ColumnView, PaneView, RowView};` imports the generated
///           view structs.
/// Why:      This module constructs them.
use crate::{ColumnView, PaneView, RowView};

/// What:     `use crate::instrument::Instrumentation;` imports the shared counters.
/// Why:      A directory pane's row model shares it.
use crate::instrument::Instrumentation;

/// What:     `use crate::preview::PreviewCache;` imports the decode/evict cache.
/// Why:      Preview panes request their bitmap through it.
use crate::preview::PreviewCache;

/// What:     `use crate::rowmodel::SyntheticRowModel;` imports the lazy row model.
/// Why:      Each directory pane gets one.
use crate::rowmodel::SyntheticRowModel;

/// What:     `use crate::strip::{...};` imports the strip types, the pitch helpers,
///           the pane-kind enum, and the column width.
/// Why:      Building a column reads the strip and lays panes out by pitch.
use crate::strip::{column_pitch_px, pane_pitch_px, Column, PaneKind, Strip, COLUMN_WIDTH_PX};

/// What:     `use crate::window::{visible_range, WindowRange};` imports the
///           bounded-window function and its range type.
/// Why:      A column's visible panes come from it.
use crate::window::{visible_range, WindowRange};

/// What:     `pub fn column_pane_window(column: &Column, v_offset_px: f32,
///           viewport_h_px: f32, prefetch: usize) -> WindowRange` computes which
///           panes of a column are in-window.
/// Why:      Both the column builder and the controller's live-preview scan use it,
///           so they agree on which panes exist.
pub fn column_pane_window(
    column: &Column,
    v_offset_px: f32,
    viewport_h_px: f32,
    prefetch: usize,
) -> WindowRange {
    // What:     `visible_range(...)` windows the column's panes by the shared
    //           vertical offset; tail expression.
    // Why:      Reuse the one bounded-window computation.
    visible_range(
        v_offset_px,
        viewport_h_px,
        pane_pitch_px(),
        column.panes.len(),
        prefetch,
    )
}

/// What:     `pub struct ColumnInput<'a>` bundles the inputs for building one
///           column. The `'a` lifetime marks the borrowed fields.
/// Why:      This crate's rule is one named-field struct instead of many params.
pub struct ColumnInput<'a> {
    /// What:     `pub strip: &'a Strip` borrows the full strip read-only.
    /// Why:      Read the column's panes.
    pub strip: &'a Strip,
    /// What:     `pub column_index: usize` is which strip column to build.
    /// Why:      Its position and panes come from here.
    pub column_index: usize,
    /// What:     `pub v_offset_px: f32` is the shared vertical offset.
    /// Why:      Selects the visible panes.
    pub v_offset_px: f32,
    /// What:     `pub viewport_h_px: f32` is the visible strip height.
    /// Why:      Pane window size.
    pub viewport_h_px: f32,
    /// What:     `pub active_column: usize` is the focused column index.
    /// Why:      Sets the column's and panes' active flags.
    pub active_column: usize,
    /// What:     `pub active_pane: usize` is the focused pane index.
    /// Why:      Marks the active pane.
    pub active_pane: usize,
    /// What:     `pub prefetch: usize` is the extra panes each side.
    /// Why:      Pane-window padding.
    pub prefetch: usize,
    /// What:     `pub preview_cache: &'a mut PreviewCache` borrows the cache mutably.
    /// Why:      Preview panes request a decode through it.
    pub preview_cache: &'a mut PreviewCache,
    /// What:     `pub instrumentation: &'a Rc<Instrumentation>` borrows the counters.
    /// Why:      Row models share it.
    pub instrumentation: &'a Rc<Instrumentation>,
}

/// What:     `pub fn build_column_view(input: ColumnInput) -> ColumnView` builds one
///           column's view, including a fresh panes model.
/// Why:      The controller calls it for an entering or changed column. It cannot
///           fail: preview decoding is backgrounded and row models are lazy.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function buildColumnView(input: ColumnInput): ColumnView { ... }
/// ```
pub fn build_column_view(input: ColumnInput) -> ColumnView {
    // What:     `let column = &input.strip.columns[input.column_index];` borrows the
    //           column.
    // Why:      Read its panes and height.
    let column = &input.strip.columns[input.column_index];
    // What:     `let pane_window = column_pane_window(...)` windows the panes.
    // Why:      Only in-window panes are built.
    let pane_window = column_pane_window(
        column,
        input.v_offset_px,
        input.viewport_h_px,
        input.prefetch,
    );
    // What:     `let mut pane_views: Vec<PaneView> = Vec::new();` accumulates panes.
    // Why:      Filled per in-window pane.
    let mut pane_views: Vec<PaneView> = Vec::new();
    // What:     `for pane_index in pane_window.start..pane_window.end` iterates the
    //           in-window pane indices.
    // Why:      Build one PaneView per in-window pane.
    for pane_index in pane_window.start..pane_window.end {
        // What:     `let pane = &column.panes[pane_index];` borrows the pane.
        // Why:      Read its id and kind.
        let pane = &column.panes[pane_index];
        // What:     `let is_active = ...` marks the focused pane.
        // Why:      The UI highlights and focuses it.
        let is_active =
            input.column_index == input.active_column && pane_index == input.active_pane;
        // What:     `let y_px = pane_index as f32 * pane_pitch_px();` is the pane's
        //           absolute vertical position.
        // Why:      The UI positions the pane at this y minus the offset.
        let y_px = pane_index as f32 * pane_pitch_px();
        // What:     `let pane_view = build_pane_view(...);` builds one PaneView.
        // Why:      Keep the loop short.
        let pane_view = build_pane_view(BuildPane {
            pane_id: pane.id,
            kind: &pane.kind,
            is_active,
            y_px,
            preview_cache: input.preview_cache,
            instrumentation: input.instrumentation,
        });
        // What:     `pane_views.push(pane_view);` appends it.
        // Why:      Add to this column.
        pane_views.push(pane_view);
    }
    // What:     `ColumnView { ... }` builds the column view with a fresh panes model;
    //           `ModelRc::new(VecModel::from(pane_views))` wraps the panes. Tail
    //           expression, so it is returned.
    // Why:      Hand back one column for the persistent columns model.
    ColumnView {
        strip_index: input.column_index as i32,
        x_px: input.column_index as f32 * column_pitch_px(),
        width_px: COLUMN_WIDTH_PX,
        is_active: input.column_index == input.active_column,
        panes: ModelRc::new(VecModel::from(pane_views)),
        column_height_px: column.height_px(),
        v_offset_px: input.v_offset_px,
    }
}

/// What:     `struct BuildPane<'a>` bundles the inputs for one pane view.
/// Why:      Same named-field-struct rule as `ColumnInput`.
struct BuildPane<'a> {
    /// What:     `pane_id: u64` is the pane's identity.
    /// Why:      Preview-cache and row-access keys use it.
    pane_id: u64,
    /// What:     `kind: &'a PaneKind` borrows the pane's tag.
    /// Why:      Decides the branch.
    kind: &'a PaneKind,
    /// What:     `is_active: bool` marks the focused pane.
    /// Why:      Highlight and focus.
    is_active: bool,
    /// What:     `y_px: f32` is the pane's absolute vertical position.
    /// Why:      Placement.
    y_px: f32,
    /// What:     `preview_cache: &'a mut PreviewCache` borrows the cache mutably.
    /// Why:      Preview panes request a decode.
    preview_cache: &'a mut PreviewCache,
    /// What:     `instrumentation: &'a Rc<Instrumentation>` borrows the counters.
    /// Why:      Row models share it.
    instrumentation: &'a Rc<Instrumentation>,
}

/// What:     `fn build_pane_view(build: BuildPane) -> PaneView` builds one directory
///           or preview PaneView.
/// Why:      Splitting it out keeps the column builder one-concept.
fn build_pane_view(build: BuildPane) -> PaneView {
    // What:     `match build.kind { ... }` branches on the pane-kind enum.
    // Why:      Directory and preview panes build differently.
    match build.kind {
        // What:     `PaneKind::Directory { row_total }` matches the directory
        //           variant and binds its `row_total`.
        // Why:      Build a listing pane with a lazy row model.
        PaneKind::Directory { row_total } => {
            // What:     `let rows = ModelRc::new(SyntheticRowModel::new(...));` builds
            //           the lazy row model; `Rc::clone` shares the counters.
            // Why:      ListView pulls rows from it on demand.
            let rows = ModelRc::new(SyntheticRowModel::new(
                build.pane_id,
                *row_total,
                Rc::clone(build.instrumentation),
            ));
            // What:     `PaneView { ... }` builds the directory view; `kind: 0`. Tail
            //           expression of this match arm.
            // Why:      Hand back a directory pane view.
            PaneView {
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
            }
        }
        // What:     `PaneKind::Preview { seed }` matches the preview variant.
        // Why:      Request its bitmap and show a placeholder until it lands.
        PaneKind::Preview { seed } => {
            // What:     `let image = build.preview_cache.request_preview(build.pane_id,
            //           *seed);` returns `Some(image)` if decoded, else `None` after
            //           queuing a background decode.
            // Why:      Never block on decoding.
            let image = build.preview_cache.request_preview(build.pane_id, *seed);
            // What:     `let resident = image.is_some();` records readiness.
            // Why:      The UI shows a placeholder while `None`.
            let resident = image.is_some();
            // What:     `let rows = ModelRc::new(VecModel::from(Vec::<RowView>::new()));`
            //           is an empty row model; a preview has no rows.
            // Why:      The generated struct still needs a `rows` value.
            let rows = ModelRc::new(VecModel::from(Vec::<RowView>::new()));
            // What:     `PaneView { ... }` builds the preview view; `kind: 1`;
            //           `image.unwrap_or_default()` is the bitmap or an empty image.
            //           Tail expression of this match arm.
            // Why:      Hand back a preview pane view.
            PaneView {
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
            }
        }
    }
}

/// What:     `fn directory_title(pane_id: u64, row_total: usize) -> slint::SharedString`
///           formats a directory pane's title.
/// Why:      A readable, identity-bearing header label.
fn directory_title(pane_id: u64, row_total: usize) -> slint::SharedString {
    // What:     `slint::SharedString::from(format!(...))` builds the label; tail.
    // Why:      Show the pane id and advertised row count.
    slint::SharedString::from(format!("dir #{pane_id}  ({row_total} rows)"))
}

/// What:     `fn preview_title(pane_id: u64) -> slint::SharedString` formats a
///           preview pane's title.
/// Why:      A readable header label.
fn preview_title(pane_id: u64) -> slint::SharedString {
    // What:     `slint::SharedString::from(format!(...))` builds the label; tail.
    // Why:      Show the pane id.
    slint::SharedString::from(format!("preview #{pane_id}"))
}
