//! Native image updates and source reading-state presentation.

/// Virtual-row texts and diagnostic marks are positioned against the frame's shaped rows.
/// Child modules can borrow their parent's private state and generated UI.
use super::{
    AppWindow, State, annotate,
    find::present::present,
    rewrap::{self, Allowance},
    rows,
    tile::{self, TileBounds},
    tile_build::{TileJob, build_tile},
    ui::SourceSelection,
    viewport::place,
};
/// Paint identity and the frame rectangles come from the same shaped rows.
use ide_app::annotation_layout::AnnotationColors;
/// Match ranges and the active match of the in-file find.
use ide_app::find::{FindRange, FindRanges};
/// Match ranges of the displayed find results.
use ide_app::find_navigation::paint_ranges;
/// Selected-text ink is chosen from the selection fill,
///  not from the color scheme.
use ide_app::selection_ink::{legible_ink, luminance};
/// Physical viewport description for shared shaping,
///  and the rectangles a frame hands to the window.
use ide_app::shaped_text::{ReadingRect, Viewport};
/// Exact paint inputs exclude collapsed caret movement.
use ide_app::source_frame::FrameStamp;
/// Native palette values retain syntax and selection contrast.
use ide_app::text_raster::CodeColors;
/// A wrap width must be a positive number of pixels.
use ide_app::wrap::has_wrap_width;
/// The most bytes a raster may hold, and the height of one code row.
use ide_app::{row_map::CODE_ROW, text_raster::MAX_RASTER_BYTES};
/// Toolkit images and models carry owned source presentation data.
use slint::{
    ComponentHandle, Image, ModelRc, Rgba8Pixel, SharedPixelBuffer, SharedString, VecModel,
};
/// UI callbacks share state without cross-thread synchronization.
use std::{cell::RefCell, rc::Rc, sync::Arc, time::Instant};

/// What:
///  Logical pixels the raster extends past the wrap width.
/// Why:
///  The raster holds glyphs, the terminator mark, and underlines of the row ends;
///  everything else the window draws over it is drawn by the markup.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const RASTER_MARGIN = 24;
/// ```
const RASTER_MARGIN: f32 = 24.0;

/// Raster width of a window that has not reported a width yet, in logical pixels.
const UNWRAPPED_RASTER_WIDTH: f32 = 1300.0;

/// What:
///  Width of the cell the gutter's wrap indicator is painted in, in logical pixels.
/// Why:
///  One space advance of the source font is 9 px; the cell leaves the mark some room at its right edge.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const SIGN_WIDTH = 12;
/// ```
const SIGN_WIDTH: f32 = 12.0;

/// Convert a toolkit palette color to raster input without losing alpha.
fn rgba(color: slint::Color) -> [u8; 4] {
    return [color.red(), color.green(), color.blue(), color.alpha()];
}

/// What:
///  `[u8; 4]` is a fixed array of four bytes,
///  red,
///  green,
///  blue,
///  alpha;
///  `Color::from_argb_u8` builds a toolkit color from them, alpha first,
/// and `Brush::from` wraps it as the fill type window properties hold.
/// Why:
///  Inks chosen by native code are handed to the markup as window properties.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function brush([red, green, blue, alpha]: Color): Brush;
/// ```
fn brush(color: [u8; 4]) -> slint::Brush {
    return slint::Brush::from(slint::Color::from_argb_u8(
        color[3], color[0], color[1], color[2],
    ));
}

/// Copy a frame's rectangles into the window's row type.
/// Selection and find rectangles reach the markup as model rows.
fn model_rows(rectangles: &[ReadingRect]) -> Vec<SourceSelection> {
    let mut rows = Vec::new();
    for rect in rectangles {
        rows.push(SourceSelection {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
        });
    }
    return rows;
}

/// The palette of the source glyphs and selection, from the window's current colors.
pub(super) fn code_colors(window: &AppWindow) -> CodeColors {
    // The palette's selection ink follows the color scheme while its selection fill does not,
    // so the ink is chosen from the fill that is actually drawn behind the selected glyphs.
    return CodeColors {
        foreground: rgba(window.get_source_foreground().color()),
        selected: legible_ink(
            rgba(window.get_selection_fill().color()),
            rgba(window.get_selected_foreground().color()),
        ),
        dark: window.get_dark_scheme(),
    };
}

/// What:
///  Paint inputs that come from the window and the find state, read once per frame.
/// Why:
///  A tile's paint identity and its job are both built from these values,
///  so the window and the worker see the same inputs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Paint = { scale: number; colors: Colors; inks: Inks; ranges: Range[]; active?: Range };
/// ```
pub(super) struct Paint {
    /// Physical pixels per logical pixel.
    pub(super) scale: f32,
    /// Palette of the source glyphs and selection.
    pub(super) colors: CodeColors,
    /// Hint and diagnostic inks.
    pub(super) inks: AnnotationColors,
    /// Find matches painted in the tile.
    pub(super) ranges: FindRanges,
    /// The match the find bar selects.
    pub(super) active: Option<FindRange>,
}

/// Read the paint inputs of the current frame.
impl Paint {
    /// Capture the window and find inputs; stale find results contribute no ranges.
    pub(super) fn new(window: &AppWindow, current: &State) -> Self {
        return Self {
            scale: window.window().scale_factor(),
            colors: code_colors(window),
            inks: annotate::colors(window),
            ranges: paint_ranges(
                &current.find,
                current.file_generation,
                current.document.revision(),
            ),
            active: present(current).active,
        };
    }
}

/// What:
///  The tallest tile in logical pixels whose raster stays within [`MAX_RASTER_BYTES`]
///  at wrap width `width` and display `scale`.
/// Why:
///  A tile is one image of the text area's width, so the limit on its bytes is a limit on its height;
///  a tile of lines taller than this is clipped to the rows near the view instead of being refused.
///  One code row is kept free for the rounding of the raster's size up to whole pixels.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function tileCap(width: number, scale: number): number;
/// ```
pub(super) fn tile_cap(width: f32, scale: f32) -> f32 {
    let raster = if has_wrap_width(width) {
        (width + RASTER_MARGIN).ceil()
    } else {
        UNWRAPPED_RASTER_WIDTH
    };
    let columns = ((raster * scale).ceil() as u64).max(1);
    let rows = MAX_RASTER_BYTES / 4 / columns;
    return ((rows as f32 / scale).floor() - CODE_ROW).max(CODE_ROW);
}

/// The viewport of a tile at `bounds`: its lines broken at the wrap width, and a raster as wide as the text area.
pub(super) fn viewport_of(bounds: TileBounds, scale: f32) -> Viewport {
    let wrap = has_wrap_width(bounds.width).then_some(bounds.width);
    return Viewport {
        first: bounds.first,
        count: bounds.count,
        width: wrap.map_or(UNWRAPPED_RASTER_WIDTH, |width| {
            return (width + RASTER_MARGIN).ceil();
        }),
        scale,
        wrap,
        clip: bounds.clip,
    };
}

/// The paint identity of a tile at `bounds`, from the current document and the paint inputs.
pub(super) fn stamp_for(current: &State, bounds: TileBounds, paint: &Paint) -> FrameStamp {
    return FrameStamp::new(
        &current.document,
        viewport_of(bounds, paint.scale),
        paint.colors,
        Arc::clone(&current.styles),
    )
    .with_matches(Arc::clone(&paint.ranges))
    .with_annotations(annotate::visible(current, bounds), paint.inks);
}

/// Owned inputs of a tile at `bounds`, ready for the tile worker or for an immediate build.
pub(super) fn job(current: &State, bounds: TileBounds, paint: &Paint) -> TileJob {
    return TileJob {
        bounds,
        file: current.file_generation,
        document: current.document.clone(),
        styles: Arc::clone(&current.styles),
        typography: current.shaper.typography().clone(),
        viewport: viewport_of(bounds, paint.scale),
        map: current.row_map.clone(),
        colors: paint.colors,
        inks: paint.inks,
        shown: annotate::visible(current, bounds),
        ranges: Arc::clone(&paint.ranges),
        active: paint.active,
        stamp: stamp_for(current, bounds, paint),
    };
}

/// What:
///  What one presentation hands the window: new pixels, the offsets, and the frame's diagnostics.
/// Why:
///  The tile swap and the synchronous path present through the same code, so they cannot disagree on order.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Frame = { pixels?: Pixels; matchesChanged: boolean; scale: number; scrolled?: number; sign?: Pixels };
/// ```
pub(super) struct Frame {
    /// Pixels of a newly painted tile, when one was swapped in.
    pub(super) pixels: Option<SharedPixelBuffer<Rgba8Pixel>>,
    /// Whether the match rectangles changed and must be handed over again.
    pub(super) matches_changed: bool,
    /// Physical pixels per logical pixel, to size the image.
    pub(super) scale: f32,
    /// Scroll offset that settling the rows asked the window to take.
    pub(super) scrolled: Option<f32>,
    /// Line the language surface belongs to.
    pub(super) anchor_line: i32,
    /// A failure to start or queue a tile, shown with the other diagnostics.
    pub(super) notice: Option<String>,
    /// The gutter's wrap indicator, painted again after a change of display scale.
    pub(super) sign: Option<SharedPixelBuffer<Rgba8Pixel>>,
}

/// What:
///  Paint the gutter's wrap indicator for display scale `factor` when it has not been painted for it yet.
///  The symbol is chosen once, from the fonts.
/// Why:
///  The image is set in the shaper and raster the source text uses, so the coverage check is about what is shown.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function ensureSign(current: State, factor: number): Pixels | undefined;
/// ```
fn ensure_sign(current: &mut State, factor: f32) -> Option<SharedPixelBuffer<Rgba8Pixel>> {
    if current.sign_scale == Some(factor.to_bits()) {
        return None;
    }
    let State {
        shaper,
        raster,
        sign,
        sign_scale,
        ..
    } = current;
    let chosen = match sign {
        Some(known) => *known,
        None => {
            let picked = shaper.choose_sign(factor);
            tracing::debug!(?picked, "chose the wrap indicator");
            *sign = Some(picked);
            picked
        }
    };
    match shaper.sign_pixels(raster, chosen, factor, SIGN_WIDTH) {
        Ok(pixels) => {
            *sign_scale = Some(factor.to_bits());
            return Some(SharedPixelBuffer::<Rgba8Pixel>::clone_from_slice(
                &pixels.bytes,
                pixels.width,
                pixels.height,
            ));
        }
        Err(error) => {
            tracing::error!(%error, "wrap indicator could not be painted");
            return None;
        }
    }
}

/// What:
///  What measuring the requested tile found: the tile that holds only lines whose heights the map has, the offset the
///  view moved to while the heights settled, and whether the measurement finished.
/// Why:
///  A measurement that spends an allowance can stop short, and the caller then leaves the tile to the worker.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Measure = { bounds: TileBounds; scrolled?: number; complete: boolean };
/// ```
struct Measure {
    /// The tile asked for after the last round.
    bounds: TileBounds,
    /// The offset the window must take, when the heights above the view changed.
    scrolled: Option<f32>,
    /// False when the allowance ran out before the tile's lines were all measured.
    complete: bool,
}

/// What:
///  Measure the lines of `requested` on the window thread and keep the view still across what that teaches,
///  until the tile asked for holds only lines whose heights the map already has.
///  `offset` is the view's offset, changed when the heights above it changed;
///  the answer is the final offset and the final tile.
///  With an `allowance` every line is charged before it is shaped, broken again, or packed,
///  and the measurement stops at the first that does not fit.
/// Why:
///  A tile built here must agree with the map it is placed by.
///  The lines are shaped once on the way and kept in the shaper's cache, so the build that follows only copies them.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function measureRequested(current: State, factor: number, view: [number, number, number],
///   first?: number, allowance?: Allowance): Measure;
/// ```
fn measure_requested(
    current: &mut State,
    factor: f32,
    view: (f32, f32, f32),
    first: Option<f32>,
    mut allowance: Option<&mut Allowance>,
) -> Measure {
    let (offset_now, width, height) = view;
    let mut offset = first.unwrap_or(offset_now);
    let mut scrolled = first;
    let mut requested = tile::requested(current);
    if !has_wrap_width(requested.width) {
        return Measure {
            bounds: requested,
            scrolled,
            complete: true,
        };
    }
    // Each round can move the view and so the tile; three rounds settle any text whose lines above the view
    // are measured by the pass already, which is every text but one that was just jumped into.
    for _ in 0..3 {
        let found = match allowance.as_deref_mut() {
            Some(spending) => spending.measure(current, factor, requested),
            None => {
                let State {
                    shaper,
                    document,
                    styles,
                    ..
                } = &mut *current;
                Some(shaper.measure_lines(
                    document,
                    requested.first..requested.first + requested.count,
                    factor,
                    Some(requested.width),
                    styles,
                ))
            }
        };
        let Some(measured) = found else {
            return Measure {
                bounds: requested,
                scrolled,
                complete: false,
            };
        };
        #[cfg(debug_assertions)]
        {
            current.rows_shaped += measured.shaped;
            current.rows_rebroken += measured.rebroken;
        }
        if !rows::absorb(current, measured.lines) {
            break;
        }
        if let Some(moved) = rows::settle(current, factor, (offset, width, height), true) {
            offset = moved;
            scrolled = Some(moved);
        }
        requested = tile::requested(current);
    }
    // The tile the last round asked for is built next, so its lines must be paid for too; those the cache holds
    // at the width cost nothing.
    let paid = match allowance.as_deref_mut() {
        Some(spending) => spending.measure(current, factor, requested).is_some(),
        None => true,
    };
    return Measure {
        bounds: requested,
        scrolled,
        complete: paid,
    };
}

/// Render shared shaped rows,
///  releasing state before any Slint setter can reenter.
///
/// A tile whose only change is the reader's scroll is built by the tile worker,
///  and the displayed tile stays on screen until its result is swapped in.
/// A new wrap width is taken here, within an allowance (`rewrap`): the lines near the view are broken again,
///  the tile is painted for the new width, and the frame that follows shows it;
///  a width whose lines do not fit the allowance is built by the tile worker like a scroll re-center.
/// Every other change builds the requested tile here, as before.
pub(super) fn render(window: &AppWindow, state: &Rc<RefCell<State>>) {
    #[cfg(debug_assertions)]
    {
        state.borrow_mut().renders += 1;
    }
    let factor = window.window().scale_factor();
    let colors = code_colors(window);
    // Selected rows of the tree, the search results, and the location list sit on the same fill
    // as selected source text, so they are drawn in the same chosen ink.
    window.set_selected_row_ink(brush(colors.selected));
    // What: `luminance` is the WCAG lightness of the chosen ink, from 0 (black) to 1 (white); the
    //       `if ... else` picks one of two opaque colors as a value.
    // Why: A hovered or focused selected row is tinted. The tint must move the fill away from the ink,
    //      black under light ink and white under dark ink, or it would lower the contrast of the row's text.
    let tint = if luminance(colors.selected) > 0.5 {
        [0, 0, 0, 255]
    } else {
        [255, 255, 255, 255]
    };
    window.set_selected_row_tint(brush(tint));
    // The window names the line a language surface belongs to; the map places it.
    let anchor_line = window.get_language_anchor_line();
    let view_now = (
        -window.get_scroll_y(),
        window.get_viewport_width(),
        window.get_viewport_height(),
    );
    let mut current = state.borrow_mut();
    // The size limit of a tile depends on the display scale, so a new scale asks for the tile to be placed again.
    if current.scale != factor {
        current.scale = factor;
        let (offset, width, height) = view_now;
        place(&mut current, offset, width, height);
    }
    let sign = ensure_sign(&mut current, factor);
    // What: A new wrap width the viewport just reported is taken here, within an allowance, or left to the worker.
    // Why: The frame that follows must not show the old width's text in a window of the new width.
    let mut allowance = rewrap::begin(&mut current);
    let rewrap_started = allowance.as_ref().map(|_| {
        return (
            Instant::now(),
            current.shaper.shaped_rows(),
            current.shaper.rebroken_rows(),
        );
    });
    // No frame is painted against a map that no longer describes the displayed text and its annotations.
    // The step for a new width installs the blocks even while the reader scrolls: the frame needs them now.
    let mut scrolled = rows::settle(&mut current, factor, view_now, allowance.is_some());
    // The lines of the tile for the new width are measured and the view kept still, each line paid for first.
    let mut measured_here = None;
    if let Some(spending) = allowance.as_mut() {
        let outcome = measure_requested(&mut current, factor, view_now, scrolled, Some(spending));
        scrolled = outcome.scrolled;
        if !outcome.complete {
            rewrap::defer(&mut current, "the lines of the tile are over the allowance");
        } else if !rewrap::raster_fits(&current, outcome.bounds, factor) {
            rewrap::defer(
                &mut current,
                "the raster of the settled tile is too large for one frame",
            );
        } else {
            measured_here = Some(outcome.bounds);
        }
    }
    if measured_here.is_none() {
        allowance = None;
    }
    let paint = Paint::new(window, &current);
    let requested = tile::requested(&current);
    let shown = current.shown;
    // The displayed tile's own inputs decide whether the frame changed; the requested window is judged separately.
    let shown_stamp = stamp_for(&current, shown, &paint);
    let mut same_inputs = current.frame_stamp.as_ref() == Some(&shown_stamp);
    // A new wrap width moves the blocks at once, while the displayed tile keeps the ones it was painted with until the
    // worker's tile for the new width arrives; that difference alone does not make the displayed tile stale.
    if !same_inputs
        && shown.width != requested.width
        && current
            .frame_stamp
            .as_ref()
            .is_some_and(|held| return held.same_except_annotations(&shown_stamp))
    {
        same_inputs = true;
    }
    let mut pixels = None;
    let mut matches_changed = false;
    let mut notice = None;
    // What a new width cost: when it began, the lines and work charged, the lines shaped and broken again, and the tile.
    let mut rewrapped = None;
    if measured_here.is_none() && same_inputs && requested == shown {
        // What: Destructuring lends the cached frame for change and the map for reading at once.
        // Why: The materialized lines are unchanged, but rows above them may not be: the frame then keeps
        //      its pixels and only moves, and its find rectangles are handed over at their new place.
        let State {
            shaped, row_map, ..
        } = &mut *current;
        if let Some(view) = shaped.as_mut()
            && view.rebase(row_map)
        {
            matches_changed = true;
        }
    } else if measured_here.is_none() && same_inputs && current.scroll_wanted == Some(requested) {
        // A scroll re-center or a new wrap width: the worker builds the requested tile, and the displayed tile
        // stays on screen meanwhile, moved to where the map now puts it.
        let State {
            shaped, row_map, ..
        } = &mut *current;
        if let Some(view) = shaped.as_mut()
            && view.rebase(row_map)
        {
            matches_changed = true;
        }
        if current.tile_job != Some(requested) {
            let queued = job(&current, requested, &paint);
            if let Err(error) = tile::submit(window, state, &mut current, queued) {
                tracing::error!(%error, "source tile request failed");
                notice = Some(format!("{error:#}"));
            }
        }
    } else {
        // Any other change builds the requested tile here, and any tile still queued for the worker is dropped.
        let build_started = Instant::now();
        tile::cancel(&mut current);
        // The map learns the heights of the lines the tile holds first, so the tile and the map agree;
        // a new width has had that done already, within its allowance.
        let settled = match measured_here {
            Some(bounds) => bounds,
            None => {
                let outcome = measure_requested(&mut current, factor, view_now, scrolled, None);
                scrolled = outcome.scrolled;
                outcome.bounds
            }
        };
        let built_job = job(&current, settled, &paint);
        let result = {
            let State { shaper, raster, .. } = &mut *current;
            build_tile(shaper, raster, built_job)
        };
        match result {
            Ok(built) => {
                #[cfg(debug_assertions)]
                {
                    current.tiles_painted += 1;
                    current.rows_shaped += built.rows_shaped;
                }
                tracing::debug!(
                    elapsed_us = build_started.elapsed().as_micros() as u64,
                    first = settled.first,
                    count = settled.count,
                    clipped = settled.clip.is_some(),
                    "window thread measured and built a tile"
                );
                if let (Some(spending), Some((at, shaped, rebroken))) =
                    (allowance.as_ref(), rewrap_started)
                {
                    #[cfg(debug_assertions)]
                    {
                        current.rewrapped += 1;
                        current.rewrap_spent = (spending.lines(), spending.work());
                    }
                    rewrapped = Some((
                        at,
                        (spending.lines(), spending.work()),
                        (
                            current.shaper.shaped_rows() - shaped,
                            current.shaper.rebroken_rows() - rebroken,
                        ),
                        settled,
                    ));
                }
                current.shown = settled;
                let mut view = built.view;
                view.rebase(&current.row_map);
                current.shaped = Some(view);
                current.frame_stamp = Some(built.stamp);
                pixels = Some(built.pixels);
                // The first shown tile starts the worker, so a later scroll re-center does not wait for its start-up.
                if let Err(error) = tile::warm(window, state, &mut current) {
                    tracing::error!(%error, "source tile worker could not start");
                    notice = Some(format!("{error:#}"));
                }
                matches_changed = true;
            }
            Err(error) => {
                tracing::error!(%error, "source raster failed");
                current.frame_stamp = None;
                drop(current);
                window.set_source_image(Image::default());
                window.set_error_message(SharedString::from(format!(
                    "Cannot render source: {error}"
                )));
                return;
            }
        }
    }
    // The worker measures the whole text at the wrap width in the background.
    tile::sync_pass(window, state, &mut current, factor);
    let frame = Frame {
        pixels,
        matches_changed,
        scale: factor,
        scrolled,
        anchor_line,
        notice,
        sign,
    };
    drop(current);
    show(window, state, frame);
    // The minimap picture follows the text, the wrap width, and the rows; a plain scroll step changes none of them.
    super::minimap::note(window, state);
    // The whole step the window thread took for a new width, from the allowance to the last setter of the frame.
    if let Some((at, (charged_lines, charged_work), (shaped, rebroken), settled)) = rewrapped {
        tracing::debug!(
            elapsed_us = at.elapsed().as_micros() as u64,
            first = settled.first,
            count = settled.count,
            width = settled.width,
            charged_lines,
            charged_work,
            shaped,
            rebroken,
            "window thread re-wrapped for a new width"
        );
    }
}

/// Present the displayed frame: its image and offsets, its gutter, rectangles, and caret, then the other readings.
/// Each setter runs after the state borrow ends.
pub(super) fn show(window: &AppWindow, state: &Rc<RefCell<State>>, frame: Frame) {
    let Frame {
        pixels,
        matches_changed,
        scale: factor,
        scrolled,
        anchor_line,
        notice,
        sign,
    } = frame;
    let mut current = state.borrow_mut();
    let found = present(&current);
    let view = current.shaped.as_ref().expect("painted source view");
    let matches = matches_changed.then(|| return model_rows(&view.matches));
    let document = &current.document;
    let caret = view.caret(document);
    let selections = model_rows(&view.selections);
    let position = document.position();
    let revision = document.revision();
    let selected = document.selected_text();
    // The tile starts at the top of the first materialized line's block.
    let origin = view.origin;
    let problems = annotate::problems(&current);
    let updated_source = if current.presented_revision != Some(revision) {
        current.presented_revision = Some(revision);
        Some(current.document.text().to_string())
    } else {
        None
    };
    let mut notices = Vec::new();
    if let Some(message) = &current.navigation_error {
        notices.push(message.as_str());
    }
    if let Some(message) = &current.file_error {
        notices.push(message.as_str());
    }
    if let Some(message) = &current.syntax_error {
        notices.push(message.as_str());
    }
    if let Some(message) = &notice {
        notices.push(message.as_str());
    }
    let diagnostic = notices.join("\n");
    #[cfg(debug_assertions)]
    if pixels.is_some() {
        current.images_set += 1;
    }
    let placement = rows::measure(&current, anchor_line);
    drop(current);

    if let Some(buffer) = pixels {
        let (width, height) = (buffer.width(), buffer.height());
        window.set_source_image(Image::from_rgba8_premultiplied(buffer));
        window.set_image_width(width as f32 / factor);
        window.set_image_height(height as f32 / factor);
    }
    if let Some(buffer) = sign {
        window.set_wrap_sign(Image::from_rgba8_premultiplied(buffer));
        window.set_wrap_sign_width(SIGN_WIDTH);
    }
    // Rows above the tile can change without a repaint; the image and the line numbers follow the map.
    // The scroll extent is set before the offset, so the old extent cannot clamp the new offset.
    window.set_image_y(origin);
    rows::present(window, placement);
    if let Some(offset) = scrolled {
        window.set_scroll_y(-offset);
    }
    window.set_error_message(SharedString::from(diagnostic));
    window.set_source_selections(ModelRc::from(Rc::new(VecModel::from(selections))));
    window.set_selection_is_match(found.active.is_some());
    if let Some(marks) = matches {
        window.set_source_matches(ModelRc::from(Rc::new(VecModel::from(marks))));
    }
    annotate::present_problems(window, problems);
    if let Some(status) = found.status {
        window.set_find_status(SharedString::from(status.label));
        window.set_find_status_detail(SharedString::from(status.detail));
        window.set_find_no_match(status.no_match);
    }
    window.set_caret_x(caret.x);
    window.set_caret_y(caret.y);
    if let Some(source) = updated_source {
        window.set_source_text(SharedString::from(source));
    }
    window.set_selected_text(SharedString::from(selected));
    window.set_selection_anchor(position.anchor as i32);
    window.set_selection_head(position.head as i32);
    tracing::debug!(
        revision,
        anchor = position.anchor,
        head = position.head,
        "source reading state presented"
    );
}

/// Redraw cached source at a new system appearance or display scale without requiring user input.
pub(super) fn bind_appearance(window: &AppWindow, shared: &Rc<RefCell<State>>) {
    let theme_state = Rc::clone(shared);
    let theme_window = window.as_weak();
    window.on_theme_changed(move || {
        if let Some(active) = theme_window.upgrade() {
            render(&active, &theme_state);
        }
    });
    let scale_state = Rc::clone(shared);
    let scale_window = window.as_weak();
    window.on_scale_changed(move || {
        if let Some(active) = scale_window.upgrade() {
            render(&active, &scale_state);
        }
    });
}
