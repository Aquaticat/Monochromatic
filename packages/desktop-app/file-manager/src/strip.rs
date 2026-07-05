//! The full strip identity: columns of panes, plus the synthetic builder the
//! spike renders. This is the "cheap identity" layer. It holds every column and
//! pane that exists, but no heavy content: directory panes only remember how
//! many rows they *could* show, and preview panes only remember a colour seed.
//! The heavy content (decoded images, materialized rows) is produced lazily and
//! only for the bounded window, elsewhere.

/// What:     `pub const COLUMN_COUNT: usize = 1200;`. `usize` is the unsigned
///           pointer-width integer Rust uses for counts and indices (siblings:
///           `u32`, `u64`, `i32`, `i64`).
/// Why:      With the pane-count mix below this yields well over 10000 panes, the
///           smoothness target: eager instantiation of that many would be
///           obviously expensive, so the windowing win is visible.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const COLUMN_COUNT = 1200;
/// ```
pub const COLUMN_COUNT: usize = 1200;

/// What:     `pub const COLUMN_WIDTH_PX: f32 = 320.0;`. `f32` is a 32-bit float
///           (sibling: `f64`), chosen because Slint's `length` maps to `f32`.
/// Why:      Fixed column width keeps the horizontal windowing math a simple
///           divide.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const COLUMN_WIDTH_PX = 320;
/// ```
pub const COLUMN_WIDTH_PX: f32 = 320.0;

/// What:     `pub const COLUMN_GAP_PX: f32 = 8.0;` is the gap between columns.
/// Why:      A small gutter so column borders read as separate columns.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const COLUMN_GAP_PX = 8;
/// ```
pub const COLUMN_GAP_PX: f32 = 8.0;

/// What:     `pub const PANE_HEIGHT_PX: f32 = 220.0;` is one pane's fixed height.
/// Why:      Fixed pane height keeps the vertical windowing math a simple divide.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const PANE_HEIGHT_PX = 220;
/// ```
pub const PANE_HEIGHT_PX: f32 = 220.0;

/// What:     `pub const PANE_GAP_PX: f32 = 6.0;` is the gap between stacked panes.
/// Why:      A gutter between panes inside a column.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const PANE_GAP_PX = 6;
/// ```
pub const PANE_GAP_PX: f32 = 6.0;

/// What:     `pub enum PaneKind` is a tagged union with two variants. `Directory`
///           carries `row_total: usize` (how many rows the listing would have);
///           `Preview` carries `seed: u32` (a 32-bit unsigned int, sibling `u64`,
///           used to pick the synthetic image's colour).
/// Why:      A pane is either a directory listing or a file preview, and each
///           needs different cheap identity data.
/// Gotcha:   Unlike a TS discriminated union of objects, matching a Rust enum
///           must handle every variant or the compiler rejects it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PaneKind =
///   | { tag: "directory"; rowTotal: number }
///   | { tag: "preview"; seed: number };
/// ```
pub enum PaneKind {
    /// What:     `Directory { row_total: usize }` is the directory-listing variant.
    /// Why:      A directory pane advertises a huge row count without storing rows.
    Directory {
        /// What:     `row_total: usize` is how many rows the listing would have.
        /// Why:      Advertised to `ListView` while the rows stay unmaterialized.
        row_total: usize,
    },
    /// What:     `Preview { seed: u32 }` is the file-preview variant.
    /// Why:      A preview pane remembers only a colour seed; the bitmap is decoded
    ///           lazily.
    Preview {
        /// What:     `seed: u32` chooses the synthetic image's colours.
        /// Why:      Distinct pixels per pane without storing any bitmap.
        seed: u32,
    },
}

/// What:     `pub struct Pane` is a record with a stable `id` (a `u64`, sibling
///           `u32`, wide so identity never runs out) and a `kind`.
/// Why:      `id` is identity that survives windowing and deliberate duplicates;
///           `kind` decides how the pane renders.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Pane = { id: number; kind: PaneKind };
/// ```
pub struct Pane {
    /// What:     `pub id: u64` is the stable pane identity.
    /// Why:      Focus, dedup, and eviction all key off identity, not position.
    pub id: u64,
    /// What:     `pub kind: PaneKind` is the directory-or-preview tag.
    /// Why:      Rendering and content production branch on it.
    pub kind: PaneKind,
}

/// What:     `pub struct Column` owns a growable vector of panes. `Vec<Pane>` is
///           a heap-allocated growable array that OWNS its panes (siblings:
///           `&[Pane]` a borrowed view, `[Pane; N]` a fixed-size array).
/// Why:      A column stacks a variable number of panes vertically.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Column = { panes: Pane[] };
/// ```
pub struct Column {
    /// What:     `pub panes: Vec<Pane>` is the owned vertical pane stack.
    /// Why:      Windowing slices this vector; it is the full pane identity.
    pub panes: Vec<Pane>,
}

/// What:     `impl Column` opens an implementation block attaching methods to
///           `Column`.
/// Why:      Column geometry helpers live next to the data.
impl Column {
    /// What:     `pub fn height_px(&self) -> f32`. `&self` borrows the column
    ///           read-only (we are only measuring, not consuming it).
    /// Why:      The full pixel height of every stacked pane, used as the
    ///           column's vertical scroll range.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// heightPx(): number { return this.panes.length * pane_pitch_px(); }
    /// ```
    pub fn height_px(&self) -> f32 {
        // What:     `self.panes.len()` is the pane count as `usize`; `as f32`
        //           converts that integer to a 32-bit float for the multiply.
        // Why:      Pixel geometry is float, pane counts are integers.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.panes.length * pane_pitch_px();
        // ```
        self.panes.len() as f32 * pane_pitch_px()
    }
}

/// What:     `pub struct Strip` owns every column. `Vec<Column>` owns the columns
///           (sibling `&[Column]` would only borrow them).
/// Why:      The strip is the whole file-manager state for this spike.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Strip = { columns: Column[] };
/// ```
pub struct Strip {
    /// What:     `pub columns: Vec<Column>` is the owned horizontal column list.
    /// Why:      Horizontal windowing slices this; it is the full column identity.
    pub columns: Vec<Column>,
}

/// What:     `pub fn column_pitch_px() -> f32` returns the horizontal distance
///           from one column's left edge to the next.
/// Why:      Both the synthetic layout and the windowing math need one shared
///           pitch value.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function columnPitchPx(): number { return COLUMN_WIDTH_PX + COLUMN_GAP_PX; }
/// ```
pub fn column_pitch_px() -> f32 {
    // What:     `COLUMN_WIDTH_PX + COLUMN_GAP_PX` is plain float addition; no
    //           trailing `;` makes it the function's returned tail expression.
    // Why:      One column occupies its width plus the gap after it.
    COLUMN_WIDTH_PX + COLUMN_GAP_PX
}

/// What:     `pub fn pane_pitch_px() -> f32` returns the vertical distance from
///           one pane's top edge to the next.
/// Why:      Shared by the synthetic layout and the vertical windowing math.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function panePitchPx(): number { return PANE_HEIGHT_PX + PANE_GAP_PX; }
/// ```
pub fn pane_pitch_px() -> f32 {
    // What:     Tail expression (no `;`): the pane height plus the gap below it.
    // Why:      One pane occupies its height plus the gap after it.
    PANE_HEIGHT_PX + PANE_GAP_PX
}

/// What:     `pub fn next_lcg(state: u64) -> u64` advances a linear congruential
///           generator: a deterministic pseudo-random sequence.
/// Why:      The synthetic strip needs varied-but-reproducible pane counts and
///           kinds without pulling in a random-number crate.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function nextLcg(state: bigint): bigint {
///   return (state * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
/// }
/// ```
pub fn next_lcg(state: u64) -> u64 {
    // What:     `.wrapping_mul(...)` and `.wrapping_add(...)` are multiply/add
    //           that WRAP on overflow instead of panicking. `6364...` and
    //           `1442...` are the standard LCG constants.
    // Why:      64-bit overflow is intentional here; wrapping is the LCG's
    //           modulo-2^64 arithmetic.
    // Gotcha:   In TS a plain `*` on these magnitudes needs `bigint`; Rust `u64`
    //           overflow would panic in debug builds without `wrapping_*`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return (state * 6364136223846793005n + 1442695040888963407n) % (1n << 64n);
    // ```
    state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407)
}

/// What:     `pub fn synthetic_strip() -> Strip` builds the fixed test strip.
/// Why:      The spike needs a big, deterministic strip to render and measure.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function syntheticStrip(): Strip { /* 500 columns of panes */ }
/// ```
pub fn synthetic_strip() -> Strip {
    // What:     `let mut columns: Vec<Column> = Vec::new();`. `let` binds a
    //           variable; `mut` makes it reassignable/mutable; the explicit type
    //           documents it; `Vec::new()` constructs an empty growable array.
    // Why:      We push one column per iteration below.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const columns: Column[] = [];
    // ```
    let mut columns: Vec<Column> = Vec::new();
    // What:     `let mut state: u64 = 0x1234_5678_9abc_def0;` seeds the LCG with
    //           a fixed constant (the `_` are digit separators, ignored).
    // Why:      A fixed seed makes the whole strip reproducible across runs and
    //           tests.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let state = 0x123456789abcdef0n;
    // ```
    let mut state: u64 = 0x1234_5678_9abc_def0;
    // What:     `let mut next_id: u64 = 0;` is the running pane-id allocator.
    // Why:      Every pane gets a unique, stable id in creation order.
    let mut next_id: u64 = 0;
    // What:     `for column_index in 0..COLUMN_COUNT` iterates the half-open
    //           range `0..500` (500 excluded), binding each value to
    //           `column_index`.
    // Why:      Build exactly `COLUMN_COUNT` columns.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (let columnIndex = 0; columnIndex < COLUMN_COUNT; columnIndex++) { ... }
    // ```
    for column_index in 0..COLUMN_COUNT {
        // What:     Reassign `state` by advancing the LCG; `next_lcg` returns the
        //           next pseudo-random value.
        // Why:      Fresh randomness for this column's shape.
        state = next_lcg(state);
        // What:     `let tall = column_index.is_multiple_of(3);` marks every third
        //           column as "tall". `.is_multiple_of(3)` returns true when the
        //           index divides evenly by 3 (the modern spelling of
        //           `column_index % 3 == 0`).
        // Why:      Tall columns exceed the viewport height, so vertical
        //           windowing has something to prune; making a third of the
        //           columns tall pushes the total pane count past 10000.
        let tall = column_index.is_multiple_of(3);
        // What:     `let pane_count = if tall { ... } else { ... };` picks a pane
        //           count. `(state >> 16) as usize % N` takes some LCG bits,
        //           narrows them to `usize`, and maps into a range.
        // Why:      Tall columns get 12..=39 panes; ordinary columns get 2..=8;
        //           roughly 400 * ~26 + 800 * ~5 is about 14000 panes total.
        let pane_count = if tall {
            12 + (state >> 16) as usize % 28
        } else {
            2 + (state >> 16) as usize % 7
        };
        // What:     `let mut panes: Vec<Pane> = Vec::new();` starts this column's
        //           owned pane list.
        // Why:      We push one pane per inner iteration.
        let mut panes: Vec<Pane> = Vec::new();
        // What:     Inner `for pane_index in 0..pane_count` builds each pane.
        // Why:      Fill the column with its chosen number of panes.
        for pane_index in 0..pane_count {
            // What:     Advance the LCG again for this pane's traits.
            // Why:      Independent randomness per pane.
            state = next_lcg(state);
            // What:     `let is_preview = (state >> 20).is_multiple_of(4);` makes
            //           about one pane in four a preview. `>>` shifts LCG bits
            //           down; `.is_multiple_of(4)` is `... % 4 == 0`.
            // Why:      Mix directory and preview panes so both paths are tested.
            let is_preview = (state >> 20).is_multiple_of(4);
            // What:     `let kind = if is_preview { ... } else { ... };` builds the
            //           variant. `PaneKind::Preview { seed: ... }` and
            //           `PaneKind::Directory { row_total: ... }` are the tagged
            //           constructors; `as u32`/`as usize` narrow LCG bits.
            // Why:      Encode the pane's cheap identity data.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const kind = isPreview
            //   ? { tag: "preview", seed }
            //   : { tag: "directory", rowTotal };
            // ```
            let kind = if is_preview {
                // What:     `PaneKind::Preview { seed: (state >> 8) as u32 }`.
                // Why:      The seed drives the synthetic image colour.
                PaneKind::Preview { seed: (state >> 8) as u32 }
            } else {
                // What:     `let huge = (column_index + pane_index)
                //           .is_multiple_of(11);` marks roughly every eleventh
                //           directory pane as giant (`... % 11 == 0`).
                // Why:      A few 100k-row panes make the virtualization headline
                //           number dramatic.
                let huge = (column_index + pane_index).is_multiple_of(11);
                // What:     `let row_total = if huge { 100_000 } else { 50 + ... };`
                //           picks the advertised row count.
                // Why:      Most panes are moderate; a few are enormous.
                let row_total = if huge {
                    100_000
                } else {
                    50 + (state >> 12) as usize % 4950
                };
                // What:     `PaneKind::Directory { row_total }` uses field
                //           shorthand (the local `row_total` fills the field).
                // Why:      Record the advertised listing size.
                PaneKind::Directory { row_total }
            };
            // What:     `panes.push(Pane { id: next_id, kind });` appends a pane.
            //           `Pane { ... }` is a struct literal; `kind` is shorthand.
            // Why:      Add this pane to the column.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // panes.push({ id: nextId, kind });
            // ```
            panes.push(Pane { id: next_id, kind });
            // What:     `next_id += 1;` bumps the id allocator.
            // Why:      The next pane gets a fresh unique id.
            next_id += 1;
        }
        // What:     `columns.push(Column { panes });` appends the built column
        //           (field shorthand for `panes`).
        // Why:      Add this column to the strip.
        columns.push(Column { panes });
    }
    // What:     `Strip { columns }` is the returned tail expression (no `;`),
    //           constructing the strip with field shorthand.
    // Why:      Hand the fully built strip back to the caller.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { columns };
    // ```
    Strip { columns }
}
