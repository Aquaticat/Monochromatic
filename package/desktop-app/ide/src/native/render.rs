//! Native image updates and source reading-state presentation.

/// Virtual-row texts and diagnostic marks are positioned against the frame's shaped rows.
/// Child modules can borrow their parent's private state and generated UI.
use super::{
    AppWindow, State, annotate,
    find::present::present,
    rows,
    tile::{self, TileBounds},
    tile_build::{TileJob, build_tile},
    ui::SourceSelection,
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
/// Toolkit images and models carry owned source presentation data.
use slint::{
    ComponentHandle, Image, ModelRc, Rgba8Pixel, SharedPixelBuffer, SharedString, VecModel,
};
/// UI callbacks share state without cross-thread synchronization.
use std::{cell::RefCell, rc::Rc, sync::Arc};

/// What:
///  `const` names a compile-time value;
///  `f32` is a 32-bit float of logical pixels (sibling `f64`).
/// Why:
///  The scrollable width ends this far after the widest line,
///  so a caret at that line's end
/// is inside the view instead of being cut off at its right edge.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const CARET_ROOM = 24;
/// ```
const CARET_ROOM: f32 = 24.0;

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
fn code_colors(window: &AppWindow) -> CodeColors {
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

/// The viewport of a tile at `bounds`, including the find margin on the right.
pub(super) fn viewport_of(bounds: TileBounds, scale: f32) -> Viewport {
    return Viewport {
        first: bounds.first,
        count: bounds.count,
        width: bounds.width + 256.0,
        scale,
    };
}

/// The paint identity of a tile at `bounds`, from the current document and the paint inputs.
pub(super) fn stamp_for(current: &State, bounds: TileBounds, paint: &Paint) -> FrameStamp {
    return FrameStamp::new(
        &current.document,
        viewport_of(bounds, paint.scale),
        bounds.horizontal,
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
        horizontal: bounds.horizontal,
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
/// type Frame = { pixels?: Pixels; matchesChanged: boolean; scale: number; scrolled?: number };
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
}

/// Render shared shaped rows,
///  releasing state before any Slint setter can reenter.
///
/// A tile whose only change is the reader's scroll is built by the tile worker, and the displayed tile stays on screen
/// until its result is swapped in. Every other change builds the requested tile here, as before.
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
        -window.get_scroll_x(),
        -window.get_scroll_y(),
        window.get_viewport_width(),
        window.get_viewport_height(),
    );
    let mut current = state.borrow_mut();
    // No frame is painted against a map that no longer describes the displayed text and its annotations.
    let scrolled = rows::settle(&mut current, factor, view_now);
    let paint = Paint::new(window, &current);
    let requested = tile::requested(&current);
    let shown = current.shown;
    // The displayed tile's own inputs decide whether the frame changed; the requested window is judged separately.
    let same_inputs = current.frame_stamp.as_ref() == Some(&stamp_for(&current, shown, &paint));
    let map_same = current
        .shaped
        .as_ref()
        .is_some_and(|view| return view.map == current.row_map);
    let mut pixels = None;
    let mut matches_changed = false;
    let mut notice = None;
    if same_inputs && requested == shown {
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
    } else if same_inputs
        && map_same
        && current.scroll_wanted == Some(requested)
        && requested.horizontal == shown.horizontal
        && requested.width == shown.width
    {
        // A scroll re-center: the worker builds the requested tile, and the displayed tile stays on screen meanwhile.
        if current.tile_job != Some(requested) {
            let queued = job(&current, requested, &paint);
            if let Err(error) = tile::submit(window, state, &mut current, queued) {
                tracing::error!(%error, "source tile request failed");
                notice = Some(format!("{error:#}"));
            }
        }
    } else {
        // Any other change builds the requested tile here, and any tile still queued for the worker is dropped.
        tile::cancel(&mut current);
        let built_job = job(&current, requested, &paint);
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
                current.shown = requested;
                current.shaped = Some(built.view);
                current.frame_stamp = Some(built.stamp);
                pixels = Some(built.pixels);
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
    let frame = Frame {
        pixels,
        matches_changed,
        scale: factor,
        scrolled,
        anchor_line,
        notice,
    };
    drop(current);
    show(window, state, frame);
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
    let horizontal = current.shown.horizontal;
    let mut document_width = current.document_width;
    // Trailing blanks count as width, and the caret after the widest line needs room inside the scroll range.
    for row in &view.rows {
        document_width = document_width.max(row.layout.full_width() / factor + CARET_ROOM);
    }
    // Hints and messages past the widest line stay reachable by scrolling; the range only grows, so nothing jumps.
    document_width = document_width.max(annotate::extent(view.annotations.as_ref()) + CARET_ROOM);
    current.document_width = document_width;
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
        window.set_image_x(horizontal);
        window.set_image_width(width as f32 / factor);
        window.set_image_height(height as f32 / factor);
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
    window.set_document_width(document_width);
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
