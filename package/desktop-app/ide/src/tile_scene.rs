//! The GPU's picture of the code view:
//!  the shaped rows of a tile as a list of paint items,
//!  and the Vello scene those items encode to.
//!
//! Nothing here touches a pixel.
//! A glyph run is drawn from the same Parley layout that measures it,
//!  a diagnostic underline is a stroked path,
//!  and the selected part of a row is a clipped second copy of its glyph runs in the selection ink.
//! The scene is built on whichever thread builds the tile and drawn into a texture by `native/gpu_tile.rs`.

/// Items to scene:
///  the one place a Vello scene is written.
mod encode;
/// The line style of each severity as strokes.
mod underline;

/// Hint and diagnostic inks and the underline runs they are laid out in.
use crate::annotation_layout::AnnotationFrame;
/// The palette that turns a syntax role into an ink.
use crate::code_colors::{CodeColors, ink};
/// The row map says where a line's code row starts.
use crate::row_map::CODE_ROW;
/// Shaped rows and the frame they belong to.
use crate::shaped_text::ShapedView;
/// Failures of the layout walk reach the caller.
use anyhow::{Result, bail};
/// A shaped paragraph and its positioned runs.
use parley::{Layout, PositionedLayoutItem};
/// The font a run is drawn with.
use vello::peniko::FontData;
/// One positioned glyph of a run, in the layout's own pixel units.
use vello::{Glyph, Scene, kurbo::BezPath};

/// Items to scene.
pub use encode::encode;
/// The geometry of one underline run.
use underline::underline_items;

/// What:
///  Physical pixels a glyph or visual row may lie outside the tile and still be kept.
/// Why:
///  A visual row wholly above or below the tile paints nothing,
///  so a very long wrapped line costs only the rows that reach the tile;
///  the margin keeps a glyph whose box starts outside but whose ink does not.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const CULL_MARGIN = 32;
/// ```
const CULL_MARGIN: f32 = 32.0;

/// What:
///  One run of glyphs in one ink,
///  with the font and the place of its layout.
/// Why:
///  A run is the unit Vello draws,
///  and the unit a test reads the ink and the glyph count of.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type GlyphItem = { font: Font; size: number; coords: number[]; origin: [number, number]; ink: Rgba; glyphs: Glyph[] };
/// ```
#[derive(Clone)]
pub struct GlyphItem {
    /// The font face of the run.
    pub font: FontData,
    /// Font size in physical pixels.
    pub size: f32,
    /// Normalized variation coordinates of the face.
    pub coords: Vec<i16>,
    /// Physical position of the layout's origin.
    pub origin: (f32, f32),
    /// Straight RGBA ink.
    pub ink: [u8; 4],
    /// Glyph ids and positions relative to `origin`.
    pub glyphs: Vec<Glyph>,
}

/// What:
///  One stroked path:
///  a diagnostic underline or a stroke of the wrap arrow.
/// Why:
///  Wavy,
///  dashed,
///  and dotted lines are one stroke each,
///  so their style is data a test can read.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type StrokeItem = { path: Path; width: number; dash: number[]; round: boolean; ink: Rgba };
/// ```
#[derive(Clone)]
pub struct StrokeItem {
    /// The center line.
    pub path: BezPath,
    /// Stroke width in physical pixels.
    pub width: f32,
    /// On and off lengths of the dashes in physical pixels;
    ///  empty for a solid line.
    pub dash: Vec<f64>,
    /// Round caps and joins instead of butt caps.
    pub round: bool,
    /// Straight RGBA ink.
    pub ink: [u8; 4],
}

/// What:
///  One paint command of a tile,
///  in drawing order.
/// Why:
///  The painter produces a list of these and `encode` writes them to a scene,
///  so what a tile draws is checked without a GPU.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Item = { glyphs: GlyphItem } | { clip: [number, number] } | 'unclip' | { stroke: StrokeItem };
/// ```
#[derive(Clone)]
pub enum Item {
    /// Draw a run of glyphs.
    Glyphs(GlyphItem),
    /// Start drawing only between these two physical x positions.
    Clip {
        /// Left edge.
        left: f32,
        /// Right edge.
        right: f32,
    },
    /// End the clip that began last.
    Unclip,
    /// Draw a stroked path.
    Stroke(StrokeItem),
}

/// What:
///  A scene and the size of the texture it is drawn into.
/// Why:
///  The window thread hands this to the GPU module,
///  which makes the texture and renders the scene into it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type TileScene = { scene: Scene; width: number; height: number };
/// ```
pub struct TileScene {
    /// The Vello scene,
    ///  in physical pixels from the tile's top left corner.
    pub scene: Scene,
    /// Texture width in physical pixels.
    pub width: u32,
    /// Texture height in physical pixels.
    pub height: u32,
}

/// What:
///  Sort `intervals` and join the ones that touch or overlap.
/// Why:
///  The selected part of a row is clipped by its intervals,
///  and the rest of the row by what lies between them;
///  both need ordered, disjoint ranges.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function merged(intervals: [number, number][]): [number, number][];
/// ```
fn merged(intervals: &[(f32, f32)]) -> Vec<(f32, f32)> {
    let mut sorted: Vec<(f32, f32)> = Vec::new();
    for interval in intervals {
        if interval.1 > interval.0 {
            sorted.push(*interval);
        }
    }
    sorted.sort_by(|left, right| return left.0.total_cmp(&right.0));
    let mut joined: Vec<(f32, f32)> = Vec::new();
    for (start, end) in sorted {
        if let Some(last) = joined.last_mut()
            && start <= last.1
        {
            last.1 = last.1.max(end);
            continue;
        }
        joined.push((start, end));
    }
    return joined;
}

/// What:
///  Emit `draw` once in `ordinary` ink outside `intervals` and once in `selected` ink inside them.
///  With no interval, or the same ink on both sides, `draw` runs once and unclipped.
/// Why:
///  A selected glyph keeps its own shape and takes the selection ink exactly where the selection rectangle lies,
///  even when one glyph (a ligature) spans several characters,
///  so the glyph is clipped at the rectangle's edge and never recolored as a whole.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function split(items: Item[], intervals: [number, number][], ordinary: Rgba, selected: Rgba, width: number,
///   draw: (items: Item[], ink: Rgba) => void): void;
/// ```
fn split(
    items: &mut Vec<Item>,
    intervals: &[(f32, f32)],
    inks: ([u8; 4], [u8; 4]),
    extent: (f32, f32),
    mut draw: impl FnMut(&mut Vec<Item>, [u8; 4]),
) {
    let (ordinary, selected) = inks;
    let joined = merged(intervals);
    if joined.is_empty() || ordinary == selected {
        draw(items, ordinary);
        return;
    }
    // The ordinary ink fills the gaps, including the two open ends of the row.
    let mut cursor = extent.0;
    for (start, end) in &joined {
        if *start > cursor {
            items.push(Item::Clip {
                left: cursor,
                right: *start,
            });
            draw(items, ordinary);
            items.push(Item::Unclip);
        }
        items.push(Item::Clip {
            left: start.max(extent.0),
            right: end.min(extent.1),
        });
        draw(items, selected);
        items.push(Item::Unclip);
        cursor = cursor.max(*end);
    }
    if cursor < extent.1 {
        items.push(Item::Clip {
            left: cursor,
            right: extent.1,
        });
        draw(items, ordinary);
        items.push(Item::Unclip);
    }
}

/// What:
///  The glyph runs of one visual row of `layout`,
///  as items in `ink`,
///  for the glyphs whose boxes reach the tile's width.
/// Why:
///  Source rows and hint labels go through one glyph path,
///  so both are culled and positioned the same way.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function runItems(line: Line, origin: [number, number], role: (brush: number) => Rgba, width: number): GlyphItem[];
/// ```
fn run_items(
    layout: &Layout<u32>,
    index: usize,
    origin: (f32, f32),
    width: f32,
) -> Result<Vec<(u32, GlyphItem)>> {
    let mut runs: Vec<(u32, GlyphItem)> = Vec::new();
    let Some(line) = layout.lines().nth(index) else {
        return Ok(runs);
    };
    for item in line.items() {
        // Inline boxes are not generated by this source-layout path.
        let PositionedLayoutItem::GlyphRun(glyph_run) = item else {
            bail!("Unexpected inline box in source text layout");
        };
        let run = glyph_run.run();
        let mut glyphs: Vec<Glyph> = Vec::new();
        for glyph in glyph_run.positioned_glyphs() {
            let x = glyph.x + origin.0;
            if x + glyph.advance < -CULL_MARGIN || x > width + CULL_MARGIN {
                continue;
            }
            glyphs.push(Glyph {
                id: glyph.id,
                x: glyph.x,
                y: glyph.y,
            });
        }
        if glyphs.is_empty() {
            continue;
        }
        runs.push((
            glyph_run.style().brush,
            GlyphItem {
                font: run.font().clone(),
                size: run.font_size(),
                coords: run.normalized_coords().to_vec(),
                origin,
                ink: [0; 4],
                glyphs,
            },
        ));
    }
    return Ok(runs);
}

/// What:
///  What a layout is drawn with:
///  the palette that inks its syntax roles,
///  or one ink for every glyph,
///  and the physical x ranges of each visual row that take the selection ink.
/// Why:
///  Source rows use the palette and their selection;
///  hint and message texts use one ink and are never selected.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Inking = { colors: CodeColors; fixed?: Rgba; selected: [number, number][][] };
/// ```
struct Inking<'a> {
    /// The palette and the selected ink.
    colors: CodeColors,
    /// One ink for every glyph,
    ///  or nothing for the syntax roles of `colors`.
    fixed: Option<[u8; 4]>,
    /// Per visual row,
    ///  the physical x ranges drawn in the selected ink.
    selected: &'a [Vec<(f32, f32)>],
}

/// What:
///  Add the items that draw every glyph of `layout` at the physical `origin` to `items`.
/// Why:
///  Source rows and the texts of virtual rows go through one path,
///  so both are culled and inked the same way.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function layoutItems(items: Item[], layout: Layout, origin: [number, number], inking: Inking, size: [number, number]): void;
/// ```
fn layout_items(
    items: &mut Vec<Item>,
    layout: &Layout<u32>,
    origin: (f32, f32),
    inking: &Inking<'_>,
    size: (f32, f32),
) -> Result<()> {
    for (index, line) in layout.lines().enumerate() {
        // A visual row wholly above or below the tile paints nothing.
        let metrics = line.metrics();
        if origin.1 + metrics.block_max_coord < -CULL_MARGIN
            || origin.1 + metrics.block_min_coord > size.1 + CULL_MARGIN
        {
            continue;
        }
        let intervals = match inking.selected.get(index) {
            Some(held) => held.as_slice(),
            None => &[][..],
        };
        for (role, run) in run_items(layout, index, origin, size.0)? {
            // A fixed ink is never selected; the palette's roles take the selected ink inside the selection.
            let (ordinary, selected) = match inking.fixed {
                Some(fixed) => (fixed, fixed),
                None => (ink(role, inking.colors), inking.colors.selected),
            };
            split(
                items,
                intervals,
                (ordinary, selected),
                (-CULL_MARGIN, size.0 + CULL_MARGIN),
                |into, painted| {
                    into.push(Item::Glyphs(GlyphItem {
                        ink: painted,
                        ..run.clone()
                    }));
                },
            );
        }
    }
    return Ok(());
}

/// What:
///  The physical x ranges of `view`'s selection rectangles that lie on each visual row of `row`.
/// Why:
///  A selection across a wrapped line has one rectangle per visual row,
///  and only that row's glyphs take the selected ink from it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function selectedIntervals(view: ShapedView, row: ShapedRow, horizontal: number): [number, number][][];
/// ```
fn selected_intervals(
    view: &ShapedView,
    row: &crate::shaped_row::ShapedRow,
    horizontal: f32,
) -> Vec<Vec<(f32, f32)>> {
    let factor = view.viewport.scale;
    let mut selected: Vec<Vec<(f32, f32)>> = vec![Vec::new(); row.visual_rows()];
    for rectangle in &view.selections {
        if let Some(index) = row.visual_row_holding(rectangle.y, factor) {
            selected[index].push((
                (rectangle.x - horizontal) * factor,
                (rectangle.x + rectangle.width - horizontal) * factor,
            ));
        }
    }
    return selected;
}

/// What:
///  The paint items of `frame`'s underline runs.
/// Why:
///  The runs are already ordered mildest first,
///  so the worst style ends on top of an overlap.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function underlineFrame(items: Item[], view: ShapedView, frame: AnnotationFrame, colors: CodeColors, horizontal: number): void;
/// ```
fn underline_frame(
    items: &mut Vec<Item>,
    view: &ShapedView,
    frame: &AnnotationFrame,
    colors: CodeColors,
    horizontal: f32,
) {
    let Some(top_row) = view.rows.first() else {
        return;
    };
    let scale = view.viewport.scale;
    let width = view.width as f32;
    for run in &frame.underlines {
        // The run lies on a materialized code row; the same mapping placed that row's selection rectangles.
        let code_top = view.map.code_top(run.row) + run.offset;
        let mut intervals: Vec<(f32, f32)> = Vec::new();
        for rectangle in &view.selections {
            // A rectangle lies on the run's visual row when its top is that row's top, within rounding.
            if (rectangle.y - code_top).abs() < CODE_ROW * 0.5 {
                intervals.push((
                    (rectangle.x - horizontal) * scale,
                    (rectangle.x + rectangle.width - horizontal) * scale,
                ));
            }
        }
        let geometry = underline::Geometry {
            span: (
                (run.x - horizontal) * scale,
                (run.x + run.width - horizontal) * scale,
            ),
            // Every row shares one baseline, so the first row's is the baseline of all of them.
            line: (code_top - view.origin) * scale
                + top_row.baseline
                + crate::annotation_paint::DROP * scale,
            scale,
            severity: run.severity,
        };
        let severity_ink = frame.colors.severity(run.severity);
        split(
            items,
            &intervals,
            (severity_ink, colors.selected),
            (-CULL_MARGIN, width + CULL_MARGIN),
            |into, painted| {
                underline_items(into, &geometry, painted);
            },
        );
    }
}

/// What:
///  The paint items of one shaped view:
///  every row's glyphs with the selected part in the selection ink,
///  then the hint and message texts,
///  then the diagnostic underlines.
///  `horizontal` is the fractional offset of the text,
///  in logical pixels.
/// Why:
///  This is the whole picture of a tile,
///  in drawing order,
///  and the tests read it instead of a pixel buffer.
///
/// # Errors
/// A layout holds an inline box, which source text never produces.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function tileItems(view: ShapedView, colors: CodeColors, horizontal: number): Item[];
/// ```
pub fn tile_items(view: &ShapedView, colors: CodeColors, horizontal: f32) -> Result<Vec<Item>> {
    let mut items: Vec<Item> = Vec::new();
    let factor = view.viewport.scale;
    let size = (view.width as f32, view.height as f32);
    for row in &view.rows {
        // Rows are placed by the frame's vertical mapping, relative to the top of the tile.
        let row_y = (row.top - view.origin) * factor;
        let selected = selected_intervals(view, row, horizontal);
        let inking = Inking {
            colors,
            fixed: None,
            selected: &selected,
        };
        let origin = (-horizontal * factor, row_y + row.baseline_shift);
        layout_items(&mut items, &row.layout, origin, &inking, size)?;
    }
    if let Some(frame) = &view.annotations {
        for text in &frame.texts {
            // A virtual row lies its rise above the code row of the line it belongs to.
            let top = view.map.code_top(text.line) - text.rise;
            let origin = ((text.x - horizontal) * factor, (top - view.origin) * factor);
            let inking = Inking {
                colors,
                fixed: Some(text.ink),
                selected: &[],
            };
            layout_items(&mut items, &text.layout, origin, &inking, size)?;
        }
        underline_frame(&mut items, view, frame, colors, horizontal);
    }
    return Ok(items);
}

/// What:
///  The scene of one shaped view,
///  with the size of the texture it is drawn into.
/// Why:
///  The tile worker and the window thread build the same scene from the same rows,
///  so a tile built on either looks the same.
///
/// # Errors
/// A layout holds an inline box, which source text never produces.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function paintTile(view: ShapedView, colors: CodeColors, horizontal: number): TileScene;
/// ```
pub fn paint_tile(view: &ShapedView, colors: CodeColors, horizontal: f32) -> Result<TileScene> {
    let items = tile_items(view, colors, horizontal)?;
    return Ok(TileScene {
        scene: encode(&items, view.height as f32),
        width: view.width,
        height: view.height,
    });
}

/// What:
///  The scene of one layout alone,
///  at the physical `origin`,
///  in one `ink`,
///  for a texture of `size` physical pixels.
/// Why:
///  Small pictures,
///  such as the gutter's wrap indicator,
///  are drawn by the same glyph path as source text.
///
/// # Errors
/// The layout holds an inline box, which source text never produces.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function layoutScene(layout: Layout, origin: [number, number], ink: Rgba, size: [number, number]): TileScene;
/// ```
pub fn layout_scene(
    layout: &Layout<u32>,
    origin: (f32, f32),
    ink: [u8; 4],
    size: (u32, u32),
) -> Result<TileScene> {
    let mut items: Vec<Item> = Vec::new();
    let inking = Inking {
        colors: CodeColors {
            foreground: ink,
            selected: ink,
            dark: false,
        },
        fixed: Some(ink),
        selected: &[],
    };
    layout_items(
        &mut items,
        layout,
        origin,
        &inking,
        (size.0 as f32, size.1 as f32),
    )?;
    return Ok(TileScene {
        scene: encode(&items, size.1 as f32),
        width: size.0,
        height: size.1,
    });
}
