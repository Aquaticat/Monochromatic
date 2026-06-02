//! libghostty-vt terminal engine and render extraction.

// What:     `use libghostty_vt::{...};` imports the safe Ghostty binding types.
//           `Terminal` owns VT state; `RenderState` snapshots visible rows.
// Why:      This module is the only place that talks to libghostty-vt directly.
// TS map:   `import { Terminal, RenderState } from "libghostty-vt"`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Terminal, RenderState, TerminalOptions } from "libghostty-vt";
// ```
use libghostty_vt::{RenderState, Terminal, TerminalOptions};

// What:     `use libghostty_vt::render::{CellIterator, RowIterator};` imports
//           reusable iterator handles for snapshot rows and cells.
// Why:      Render extraction walks rows and cells without using slow grid refs.
// TS map:   `import { RowIterator, CellIterator } from "libghostty-vt/render"`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { RowIterator, CellIterator } from "libghostty-vt/render";
// ```
use libghostty_vt::render::{CellIterator, RowIterator};

// What:     `use libghostty_vt::style::{RgbColor, Underline};` imports Ghostty
//           style helpers. `RgbColor` is the upstream color record; `Underline`
//           is the style enum.
// Why:      The engine resolves inverse video and underline flags while copying cells.
// TS map:   `import type { RgbColor, Underline } from "libghostty-vt/style"`.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { RgbColor, Underline } from "libghostty-vt/style";
// ```
use libghostty_vt::style::{RgbColor, Underline};

// What:     `use libghostty_vt::terminal::ScrollViewport;` imports the row-scroll
//           command enum. Siblings are `Top`, `Bottom`, and `Delta` variants.
// Why:      Absolute pixel scrolling is implemented by converting to row deltas.
// TS map:   `import { ScrollViewport } from "libghostty-vt/terminal"`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ScrollViewport } from "libghostty-vt/terminal";
// ```
use libghostty_vt::terminal::ScrollViewport;

// What:     `use crate::...` imports sibling modules from this package.
// Why:      Engine methods return crate models and crate errors.
// TS map:   `import { TerminalError, TerminalCell, ... } from "./..."`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { TerminalError, TerminalCell, TerminalSnapshot, mapPixelScroll } from "./deps";
// ```
use crate::{
    error::TerminalError,
    render::{Rgb, TerminalCell, TerminalSnapshot},
    scroll::map_pixel_scroll,
    scroll::ScrollMapping,
};

// What:     `#[derive(Clone, Copy, Debug, PartialEq)]` generates value behavior
//           for viewport geometry. `Copy` is fine because all fields are numbers.
// Why:      Resize code compares and stores this record by value.
// TS map:   `type ViewportGeometry = { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// type ViewportGeometry = { cols: number; rows: number; cellWidthPx: number; cellHeightPx: number };
// ```
#[derive(Clone, Copy, Debug, PartialEq)]
// What:     `pub struct ViewportGeometry` declares terminal dimensions in cells
//           plus the cell dimensions in logical pixels.
// Why:      libghostty-vt resize needs both cell counts and pixel cell sizes.
// TS map:   `type ViewportGeometry = { cols, rows, cellWidthPx, cellHeightPx }`.
//
// In TS you'd write (pseudocode):
// ```ts
// type ViewportGeometry = { cols: number; rows: number; cellWidthPx: number; cellHeightPx: number };
// ```
pub struct ViewportGeometry {
    // What:     `pub cols: u16` stores terminal columns. Sibling integers include
    //           `usize` and `u32`; libghostty-vt's API requires `u16`.
    // Why:      Avoid casts at every resize call.
    // TS map:   `cols: number`.
    pub cols: u16,
    // What:     `pub rows: u16` stores terminal rows for libghostty-vt.
    // Why:      Match Ghostty's API exactly.
    // TS map:   `rows: number`.
    pub rows: u16,
    // What:     `pub cell_width_px: f32` stores logical pixel cell width.
    // Why:      Rust receives Slint lengths as `f32`.
    // TS map:   `cellWidthPx: number`.
    pub cell_width_px: f32,
    // What:     `pub cell_height_px: f32` stores logical pixel cell height.
    // Why:      This value drives both resize and scroll mapping.
    // TS map:   `cellHeightPx: number`.
    pub cell_height_px: f32,
}

// What:     `impl ViewportGeometry` starts methods attached to the geometry type.
// Why:      Construction from pixels is reused by the binary and tests.
// TS map:   Static methods on a plain object factory.
//
// In TS you'd write (pseudocode):
// ```ts
// const ViewportGeometry = { fromPixels(...) { ... } };
// ```
impl ViewportGeometry {
    // What:     `pub fn from_pixels(...) -> Self` builds cell counts from Slint
    //           viewport pixels and fixed cell metrics.
    // Why:      Resize support lives in Rust, not Slint integer math.
    // TS map:   `ViewportGeometry.fromPixels(width, height, cellWidth, cellHeight)`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { cols: Math.max(1, Math.floor(width / cellWidth)), rows: Math.max(1, Math.floor(height / cellHeight)), cellWidthPx: cellWidth, cellHeightPx: cellHeight };
    // ```
    pub fn from_pixels(
        width_px: f32,
        height_px: f32,
        cell_width_px: f32,
        cell_height_px: f32,
    ) -> Self {
        // What:     `.max(1.0).floor() as u16` clamps, floors, and narrows the
        //           column count to Ghostty's `u16` input type.
        // Why:      A window can never have a zero-column terminal.
        // TS map:   `Math.max(1, Math.floor(width / cellWidth))`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const cols = Math.max(1, Math.floor(widthPx / cellWidthPx));
        // ```
        let cols = (width_px / cell_width_px).max(1.0).floor() as u16;
        // What:     `.max(1.0).floor() as u16` computes rows the same way.
        // Why:      A window can never have a zero-row terminal.
        // TS map:   `Math.max(1, Math.floor(height / cellHeight))`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const rows = Math.max(1, Math.floor(heightPx / cellHeightPx));
        // ```
        let rows = (height_px / cell_height_px).max(1.0).floor() as u16;
        // What:     `Self { ... }` constructs the geometry record. Tail expression
        //           means this is returned.
        // Why:      Callers need both computed grid and original cell metrics.
        // TS map:   `return { cols, rows, cellWidthPx, cellHeightPx }`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { cols, rows, cellWidthPx, cellHeightPx };
        // ```
        Self {
            cols,
            rows,
            cell_width_px,
            cell_height_px,
        }
    }
}

// What:     `pub struct TerminalEngine` declares the stateful terminal wrapper.
//           The libghostty-vt handles are `!Send + !Sync`, so this struct stays
//           on the Slint UI thread in the prototype.
// Why:      One object owns VT state, render iterators, and viewport position.
// TS map:   `class TerminalEngine { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// class TerminalEngine { terminal; renderState; rowIterator; cellIterator; }
// ```
pub struct TerminalEngine {
    terminal: Terminal<'static, 'static>,
    render_state: RenderState<'static>,
    row_iterator: RowIterator<'static>,
    cell_iterator: CellIterator<'static>,
    viewport_top_row: usize,
    geometry: ViewportGeometry,
}

// What:     `impl TerminalEngine` starts methods for the stateful wrapper.
// Why:      Keep libghostty-vt operations behind a small testable API.
// TS map:   `class TerminalEngine { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// class TerminalEngine { static create(...) {} }
// ```
impl TerminalEngine {
    // What:     `pub fn new(...) -> Result<Self, TerminalError>` constructs a
    //           terminal and render iterator handles. `Result` is Rust's
    //           success-or-error wrapper; sibling `Option` has no error payload.
    // Why:      libghostty-vt allocation can fail, so construction is fallible.
    // TS map:   `static create(...): TerminalEngine` that throws on failure.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const terminal = new Terminal({ cols, rows, maxScrollback });
    // return new TerminalEngine(terminal);
    // ```
    pub fn new(
        geometry: ViewportGeometry,
        max_scrollback: usize,
    ) -> Result<Self, TerminalError> {
        // What:     `Terminal::new(TerminalOptions { ... })?` creates Ghostty's
        //           terminal. `?` returns early after converting errors.
        // Why:      This is the actual VT parser and scrollback store.
        // TS map:   `const terminal = new Terminal({ cols, rows, maxScrollback })`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const terminal = new Terminal({ cols: geometry.cols, rows: geometry.rows, maxScrollback });
        // ```
        let mut terminal = Terminal::new(TerminalOptions {
            cols: geometry.cols,
            rows: geometry.rows,
            max_scrollback,
        })?;
        // What:     `terminal.resize(...)?` tells Ghostty the pixel cell size.
        // Why:      Size reports and image protocols depend on pixel dimensions.
        // TS map:   `terminal.resize(cols, rows, cellWidth, cellHeight)`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // terminal.resize(geometry.cols, geometry.rows, geometry.cellWidthPx, geometry.cellHeightPx);
        // ```
        terminal.resize(
            geometry.cols,
            geometry.rows,
            geometry.cell_width_px as u32,
            geometry.cell_height_px as u32,
        )?;
        // What:     `Self { ... }` constructs the engine with reusable render handles.
        //           `RenderState::new()?` and iterator constructors are fallible.
        // Why:      Reusing handles avoids allocation churn on every frame.
        // TS map:   `return new TerminalEngine(...)`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { terminal, renderState: new RenderState(), rowIterator: new RowIterator(), cellIterator: new CellIterator() };
        // ```
        Ok(Self {
            terminal,
            render_state: RenderState::new()?,
            row_iterator: RowIterator::new()?,
            cell_iterator: CellIterator::new()?,
            viewport_top_row: 0,
            geometry,
        })
    }

    // What:     `pub fn feed(&mut self, bytes: &[u8])` takes a mutable engine and a
    //           borrowed byte slice. `&[u8]` is like a read-only Uint8Array view.
    // Why:      PTY I/O or demo data can push raw VT bytes through Ghostty.
    // TS map:   `feed(bytes: Uint8Array): void`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // this.terminal.vtWrite(bytes);
    // ```
    pub fn feed(&mut self, bytes: &[u8]) {
        // What:     `self.terminal.vt_write(bytes)` parses untrusted VT bytes.
        // Why:      This updates screen, cursor, style, and scrollback state.
        // TS map:   `this.terminal.vtWrite(bytes)`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.terminal.vtWrite(bytes);
        // ```
        self.terminal.vt_write(bytes);
        // What:     `self.terminal.scroll_viewport(ScrollViewport::Bottom)` asks
        //           Ghostty to show the active area after new content.
        // Why:      Demo startup should land at the terminal bottom like a real app.
        // TS map:   `this.terminal.scrollViewport("bottom")`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.terminal.scrollViewport("bottom");
        // ```
        self.terminal.scroll_viewport(ScrollViewport::Bottom);
    }

    // What:     `pub fn resize(&mut self, geometry: ViewportGeometry) -> Result...`
    //           mutates Ghostty's grid dimensions.
    // Why:      The Slint window can be resized after startup.
    // TS map:   `resize(geometry): void`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // this.terminal.resize(geometry.cols, geometry.rows, geometry.cellWidthPx, geometry.cellHeightPx);
    // ```
    pub fn resize(&mut self, geometry: ViewportGeometry) -> Result<(), TerminalError> {
        // What:     `if self.geometry == geometry { return Ok(()); }` exits early
        //           when no cell count or cell metric changed.
        // Why:      Slint may emit duplicate resize notifications.
        // TS map:   `if (this.geometry === geometry) return`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (sameGeometry(this.geometry, geometry)) return;
        // ```
        if self.geometry == geometry {
            // What:     `Ok(())` constructs a successful `Result` carrying unit.
            // Why:      Nothing changed, but the operation succeeded.
            // TS map:   `return`.
            return Ok(());
        }
        // What:     `self.terminal.resize(...)?` forwards the new grid and pixel
        //           metrics to Ghostty.
        // Why:      Ghostty reflows primary-screen content on resize.
        // TS map:   `this.terminal.resize(...)`.
        self.terminal.resize(
            geometry.cols,
            geometry.rows,
            geometry.cell_width_px as u32,
            geometry.cell_height_px as u32,
        )?;
        // What:     `self.geometry = geometry` stores the new record.
        // Why:      Future duplicate notifications can be skipped.
        // TS map:   `this.geometry = geometry`.
        self.geometry = geometry;
        // What:     `let max_top_row = self.terminal.scrollback_rows()?` queries the
        //           new maximum viewport top after reflow.
        // Why:      Resize can reduce available scrollback offset.
        // TS map:   `const maxTopRow = this.terminal.scrollbackRows()`.
        let max_top_row = self.terminal.scrollback_rows()?;
        // What:     `if self.viewport_top_row > max_top_row { ... }` clamps the
        //           remembered absolute top row.
        // Why:      The next scroll delta must be relative to Ghostty's real viewport.
        // TS map:   `if (this.viewportTopRow > maxTopRow) ...`.
        if self.viewport_top_row > max_top_row {
            self.set_viewport_top_row(max_top_row)?;
        }
        // What:     `Ok(())` returns success after the resize.
        // Why:      Match the method's `Result` return type.
        // TS map:   `return`.
        Ok(())
    }

    // What:     `pub fn scrollback_rows(&self) -> Result<usize, TerminalError>`
    //           borrows the engine immutably and returns the scrollback count.
    // Why:      The binary uses this to initialize Flickable at the bottom.
    // TS map:   `scrollbackRows(): number`.
    pub fn scrollback_rows(&self) -> Result<usize, TerminalError> {
        // What:     `self.terminal.scrollback_rows()?` reads Ghostty's count and
        //           propagates errors.
        // Why:      Ghostty is the source of truth for scrollback size.
        // TS map:   `return this.terminal.scrollbackRows()`.
        let rows = self.terminal.scrollback_rows()?;
        // What:     `Ok(rows)` wraps the count in a successful `Result`.
        // Why:      The method promised `Result` for error propagation.
        // TS map:   `return rows`.
        Ok(rows)
    }

    // What:     `pub fn set_pixel_scroll(...) -> Result<ScrollMapping, ...>` maps
    //           Slint pixels to Ghostty rows and moves the Ghostty viewport.
    // Why:      This is the central smooth-scroll bridge.
    // TS map:   `setPixelScroll(pixelScroll): ScrollMapping`.
    pub fn set_pixel_scroll(
        &mut self,
        pixel_scroll: f32,
    ) -> Result<ScrollMapping, TerminalError> {
        // What:     `let max_top_row = ...` reads the current bottom row offset.
        // Why:      Pixel scrolling must clamp to actual scrollback length.
        // TS map:   `const maxTopRow = this.terminal.scrollbackRows()`.
        let max_top_row = self.terminal.scrollback_rows()?;
        // What:     `map_pixel_scroll(...)` performs the pure floor/modulo split.
        // Why:      Keep math tested separately from Ghostty side effects.
        // TS map:   `const mapping = mapPixelScroll(pixelScroll, cellHeight, maxTopRow)`.
        let mapping = map_pixel_scroll(pixel_scroll, self.geometry.cell_height_px, max_top_row);
        // What:     `self.set_viewport_top_row(...)?` moves Ghostty to the whole-row
        //           part of the Slint pixel offset.
        // Why:      RenderState only exposes row-aligned viewports.
        // TS map:   `this.setViewportTopRow(mapping.wholeRowOffset)`.
        self.set_viewport_top_row(mapping.whole_row_offset)?;
        // What:     `Ok(mapping)` returns the same mapping to the caller.
        // Why:      Slint status can show fractional pixels and row offset.
        // TS map:   `return mapping`.
        Ok(mapping)
    }

    // What:     `pub fn snapshot(...) -> Result<TerminalSnapshot, ...>` extracts a
    //           renderer-neutral frame from Ghostty's current row viewport.
    // Why:      The binary should not know libghostty-vt iterator APIs.
    // TS map:   `snapshot(mapping): TerminalSnapshot`.
    pub fn snapshot(
        &mut self,
        mapping: ScrollMapping,
    ) -> Result<TerminalSnapshot, TerminalError> {
        // What:     `let snapshot = self.render_state.update(&self.terminal)?` asks
        //           Ghostty to copy renderable state into `RenderState`.
        // Why:      Rows and cells are read from the render snapshot, not raw screen refs.
        // TS map:   `const snapshot = renderState.update(terminal)`.
        let snapshot = self.render_state.update(&self.terminal)?;
        // What:     `let colors = snapshot.colors()?` reads resolved default colors.
        // Why:      Empty foreground/background values fall back to these.
        // TS map:   `const colors = snapshot.colors()`.
        let colors = snapshot.colors()?;
        // What:     `let viewport_cols = usize::from(snapshot.cols()?)` converts
        //           Ghostty's `u16` width to Rust's index-sized integer.
        // Why:      Snapshot models and status text use `usize`.
        // TS map:   `const viewportCols = snapshot.cols`.
        let viewport_cols = usize::from(snapshot.cols()?);
        // What:     `let viewport_rows = usize::from(snapshot.rows()?)` does the
        //           same conversion for height.
        // Why:      Row indexes are `usize` in this crate.
        // TS map:   `const viewportRows = snapshot.rows`.
        let viewport_rows = usize::from(snapshot.rows()?);
        // What:     `let mut cells = Vec::new()` creates an owned growable array.
        // Why:      We push cells while walking the render iterators.
        // TS map:   `const cells = []`.
        let mut cells = Vec::new();
        // What:     `let mut row_iteration = self.row_iterator.update(&snapshot)?`
        //           attaches the reusable row iterator to this snapshot.
        // Why:      Rows are valid only while this snapshot borrow is alive.
        // TS map:   `const rowIteration = rowIterator.update(snapshot)`.
        let mut row_iteration = self.row_iterator.update(&snapshot)?;
        // What:     `let mut row_index = 0usize` creates a mutable row counter.
        //           `usize` matches vector indexing; `u32` would need casts.
        // Why:      The iterator yields row data but not its numeric index.
        // TS map:   `let rowIndex = 0`.
        let mut row_index = 0usize;
        // What:     `while let Some(row) = row_iteration.next()` loops over rows
        //           from the lending iterator until it returns `None`.
        // Why:      libghostty-vt exposes rows through this stateful cursor API.
        // TS map:   `while ((row = rowIterator.next()) !== null) { ... }`.
        while let Some(row) = row_iteration.next() {
            // What:     `let mut cell_iteration = self.cell_iterator.update(row)?`
            //           attaches the cell iterator to the current row.
            // Why:      Cell data is row-scoped in the render-state API.
            // TS map:   `const cellIteration = cellIterator.update(row)`.
            let mut cell_iteration = self.cell_iterator.update(row)?;
            // What:     `let mut col_index = 0usize` tracks the current column.
            // Why:      The cell iterator yields cells in left-to-right order.
            // TS map:   `let colIndex = 0`.
            let mut col_index = 0usize;
            // What:     `while let Some(cell) = cell_iteration.next()` loops over
            //           cells until the row cursor is exhausted.
            // Why:      This copies every visible/styled cell into an owned model.
            // TS map:   `while ((cell = cellIterator.next()) !== null) { ... }`.
            while let Some(cell) = cell_iteration.next() {
                // What:     `let text: String = cell.graphemes()?.into_iter().collect()`
                //           copies Ghostty grapheme codepoints into owned UTF-8 text.
                // Why:      The Slint model cannot borrow from Ghostty iterators.
                // TS map:   `const text = cell.graphemes().join("")`.
                let text: String = cell.graphemes()?.into_iter().collect();
                // What:     `let style = cell.style()?` copies SGR flags for the cell.
                // Why:      Bold, italic, inverse, and underline are UI-visible styles.
                // TS map:   `const style = cell.style()`.
                let style = cell.style()?;
                // What:     `let raw_foreground = cell.fg_color()?.unwrap_or(...)`
                //           uses Ghostty's resolved color or the default foreground.
                // Why:      Slint receives concrete RGB, never palette indexes.
                // TS map:   `const fg = cell.fgColor ?? colors.foreground`.
                let raw_foreground = cell.fg_color()?.unwrap_or(colors.foreground);
                // What:     `let raw_background_option = cell.bg_color()?` reads the
                //           optional resolved background color.
                // Why:      Empty cells with no custom background can be skipped.
                // TS map:   `const bgMaybe = cell.bgColor`.
                let raw_background_option = cell.bg_color()?;
                // What:     `let (foreground, background) = resolve_inverse(...)`
                //           returns possibly swapped colors for inverse video.
                // Why:      The UI can draw inverse cells without extra style logic.
                // TS map:   `const { foreground, background } = resolveInverse(...)`.
                let (foreground, background) = resolve_inverse(
                    raw_foreground,
                    raw_background_option.unwrap_or(colors.background),
                    style.inverse,
                );
                // What:     `if should_copy_cell(...) { ... }` skips plain empty cells.
                // Why:      The Slint model stays smaller while preserving styled blanks.
                // TS map:   `if (text || bgMaybe || style.inverse) cells.push(...)`.
                if should_copy_cell(text.as_str(), raw_background_option, style.inverse) {
                    // What:     `cells.push(TerminalCell { ... })` appends one owned
                    //           cell model to the growable vector.
                    // Why:      This cell has visible text or visible styling.
                    // TS map:   `cells.push({ row, col, text, foreground, background })`.
                    cells.push(TerminalCell {
                        row: row_index,
                        col: col_index,
                        text,
                        foreground: foreground.into(),
                        background: background.into(),
                        bold: style.bold,
                        italic: style.italic,
                        inverse: style.inverse,
                        underline: style.underline != Underline::None,
                    });
                }
                // What:     `col_index += 1` advances the mutable column counter.
                // Why:      The next cell is one grid column to the right.
                // TS map:   `colIndex += 1`.
                col_index += 1;
            }
            // What:     `row.set_dirty(false)?` clears Ghostty's per-row dirty flag.
            // Why:      A real renderer would use dirty tracking; this prototype keeps
            //           the state tidy after copying the row.
            // TS map:   `row.setDirty(false)`.
            row.set_dirty(false)?;
            // What:     `row_index += 1` advances the row counter.
            // Why:      The next render row is one grid row lower.
            // TS map:   `rowIndex += 1`.
            row_index += 1;
        }
        // What:     `drop(row_iteration)` explicitly ends the borrow of render state.
        // Why:      The code below reads terminal metadata after iterator use.
        // TS map:   No equivalent; garbage collection has no borrow checker.
        drop(row_iteration);
        // What:     `let total_rows = self.terminal.total_rows()?` reads total active
        //           screen rows including scrollback from Ghostty.
        // Why:      Slint sizes the Flickable content from this count.
        // TS map:   `const totalRows = terminal.totalRows()`.
        let total_rows = self.terminal.total_rows()?;
        // What:     `let scrollback_rows = self.terminal.scrollback_rows()?` reads rows
        //           above the active viewport.
        // Why:      Slint uses this as the maximum whole-row scroll.
        // TS map:   `const scrollbackRows = terminal.scrollbackRows()`.
        let scrollback_rows = self.terminal.scrollback_rows()?;
        // What:     `let title = self.terminal.title()?.to_string()` copies the
        //           borrowed Ghostty title into an owned `String`.
        // Why:      The borrowed title expires on the next VT write or reset.
        // TS map:   `const title = terminal.title`.
        let title = self.terminal.title()?.to_string();
        // What:     `Ok(TerminalSnapshot { ... })` constructs and returns the frame.
        // Why:      The binary receives one owned value with all UI data.
        // TS map:   `return { cells, viewportRows, ... }`.
        Ok(TerminalSnapshot {
            cells,
            viewport_rows,
            viewport_cols,
            total_rows,
            scrollback_rows,
            whole_row_offset: mapping.whole_row_offset,
            fractional_px: mapping.fractional_px,
            cell_width_px: self.geometry.cell_width_px,
            cell_height_px: self.geometry.cell_height_px,
            title,
        })
    }

    // What:     `fn set_viewport_top_row(...) -> Result<(), TerminalError>` is a
    //           private helper that converts absolute row offsets to Ghostty calls.
    // Why:      Ghostty supports Top, Bottom, or Delta, not direct absolute set.
    // TS map:   `private setViewportTopRow(target): void`.
    fn set_viewport_top_row(&mut self, target_top_row: usize) -> Result<(), TerminalError> {
        // What:     `let max_top_row = ...` fetches the bottom offset.
        // Why:      Absolute row requests must clamp to current scrollback size.
        // TS map:   `const maxTopRow = terminal.scrollbackRows()`.
        let max_top_row = self.terminal.scrollback_rows()?;
        // What:     `.min(max_top_row)` clamps the target top row.
        // Why:      The UI may hold a stale pixel scroll after resize.
        // TS map:   `const target = Math.min(targetTopRow, maxTopRow)`.
        let target = target_top_row.min(max_top_row);
        // What:     `if target == self.viewport_top_row { return Ok(()); }` skips
        //           redundant Ghostty scroll calls.
        // Why:      Fractional-only Slint movement should not touch row state.
        // TS map:   `if (target === this.viewportTopRow) return`.
        if target == self.viewport_top_row {
            return Ok(());
        }
        // What:     `if target == 0 { ... } else if target == max_top_row { ... }`
        //           uses Ghostty's exact top/bottom commands when possible.
        // Why:      Top and bottom remain correct even if our remembered row drifted.
        // TS map:   `if (target === 0) top(); else if (target === max) bottom(); else delta(...)`.
        if target == 0 {
            self.terminal.scroll_viewport(ScrollViewport::Top);
        } else if target == max_top_row {
            self.terminal.scroll_viewport(ScrollViewport::Bottom);
        } else {
            // What:     `target as isize - self.viewport_top_row as isize` computes a
            //           signed row delta. Positive means down toward active area.
            // Why:      Ghostty's Delta variant is relative to current viewport.
            // TS map:   `const delta = target - this.viewportTopRow`.
            let delta = target as isize - self.viewport_top_row as isize;
            self.terminal.scroll_viewport(ScrollViewport::Delta(delta));
        }
        // What:     `self.viewport_top_row = target` updates remembered state.
        // Why:      The next absolute request can become a relative delta.
        // TS map:   `this.viewportTopRow = target`.
        self.viewport_top_row = target;
        // What:     `Ok(())` returns success.
        // Why:      The helper has completed the row scroll.
        // TS map:   `return`.
        Ok(())
    }
}

// What:     `fn resolve_inverse(...) -> (RgbColor, RgbColor)` returns a tuple of
//           Ghostty colors. Tuples are fixed-size ordered records; sibling named
//           structs would be more verbose here.
// Why:      Inverse video swaps foreground and background before UI conversion.
// TS map:   `function resolveInverse(...): [RgbColor, RgbColor]`.
fn resolve_inverse(
    foreground: RgbColor,
    background: RgbColor,
    inverse: bool,
) -> (RgbColor, RgbColor) {
    // What:     `if inverse { ... } else { ... }` returns one tuple or the other.
    // Why:      SGR inverse means foreground and background trade places.
    // TS map:   `return inverse ? [background, foreground] : [foreground, background]`.
    if inverse {
        (background, foreground)
    } else {
        (foreground, background)
    }
}

// What:     `fn should_copy_cell(...) -> bool` is a private visibility filter.
// Why:      Plain empty cells are represented by the content background, not models.
// TS map:   `function shouldCopyCell(text, background, inverse): boolean`.
fn should_copy_cell(
    text: &str,
    background: Option<RgbColor>,
    inverse: bool,
) -> bool {
    // What:     `!text.is_empty() || background.is_some() || inverse` combines three
    //           visibility reasons. `Option::is_some` checks for a present value.
    // Why:      Text, explicit backgrounds, and inverse blanks all need drawing.
    // TS map:   `return text.length > 0 || background !== null || inverse`.
    !text.is_empty() || background.is_some() || inverse
}

// What:     `#[cfg(test)] mod tests` compiles the module only for tests.
// Why:      VT extraction tests live beside the engine they exercise.
// TS map:   `describe("TerminalEngine", () => { ... })`.
#[cfg(test)]
mod tests {
    use super::*;
    use crate::scroll::{DEFAULT_CELL_HEIGHT_PX, DEFAULT_CELL_WIDTH_PX};

    #[test]
    fn extracts_vt_text_and_bold_style() -> Result<(), TerminalError> {
        let geometry = ViewportGeometry {
            cols: 20,
            rows: 4,
            cell_width_px: DEFAULT_CELL_WIDTH_PX,
            cell_height_px: DEFAULT_CELL_HEIGHT_PX,
        };
        let mut engine = TerminalEngine::new(geometry, 100)?;
        engine.feed(b"\x1b[1mBold\x1b[0m plain\r\n");
        let mapping = engine.set_pixel_scroll(0.0)?;
        let snapshot = engine.snapshot(mapping)?;
        let bold_cell = snapshot
            .cells
            .iter()
            .find(|cell| cell.text == "B")
            .expect("rendered bold B cell");
        assert!(bold_cell.bold);
        let plain_cell = snapshot
            .cells
            .iter()
            .find(|cell| cell.text == "p")
            .expect("rendered plain p cell");
        assert!(!plain_cell.bold);
        Ok(())
    }

    #[test]
    fn scrolls_to_scrollback_top() -> Result<(), TerminalError> {
        let geometry = ViewportGeometry {
            cols: 12,
            rows: 2,
            cell_width_px: DEFAULT_CELL_WIDTH_PX,
            cell_height_px: DEFAULT_CELL_HEIGHT_PX,
        };
        let mut engine = TerminalEngine::new(geometry, 100)?;
        engine.feed(b"one\r\ntwo\r\nthree\r\nfour\r\n");
        let mapping = engine.set_pixel_scroll(0.0)?;
        let snapshot = engine.snapshot(mapping)?;
        let top_text: String = snapshot
            .cells
            .iter()
            .filter(|cell| cell.row == 0)
            .map(|cell| cell.text.as_str())
            .collect();
        assert!(top_text.contains("one"));
        Ok(())
    }
}
