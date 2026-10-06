//! Native image updates and source reading-state presentation.

/// What: Child modules can borrow their parent's private state and generated UI.
/// Why: Keep one document owner while separating input from rendering.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { type State, AppWindow, SourceSelection } from '../native';
/// ```
use super::{AppWindow, State, annotate, find::present::present, rows, ui::SourceSelection};
/// Virtual-row texts and diagnostic marks are positioned against the frame's shaped rows.
use ide_app::annotation_layout::lay_out;
/// Match rectangles come from the same shaped rows as selection rectangles.
use ide_app::find_navigation::paint_ranges;
/// Only matches inside the materialized rows and horizontal tile become native rectangles.
use ide_app::find_paint::rectangles;
/// Selected-text ink is chosen from the selection fill, not from the color scheme.
use ide_app::selection_ink::legible_ink;
/// Physical viewport description for shared shaping, and the rectangles a frame hands to the window.
use ide_app::shaped_text::{ReadingRect, Viewport};
/// Exact paint inputs exclude collapsed caret movement.
use ide_app::source_frame::FrameStamp;
/// Native palette values retain syntax and selection contrast.
use ide_app::text_raster::CodeColors;
/// Toolkit images and models carry owned source presentation data.
use slint::{ComponentHandle, ModelRc, SharedString, VecModel};
/// UI callbacks share state without cross-thread synchronization.
use std::{cell::RefCell, rc::Rc, sync::Arc};

/// What: `const` names a compile-time value; `f32` is a 32-bit float of logical pixels (sibling `f64`).
/// Why: The scrollable width ends this far after the widest line, so a caret at that line's end
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

/// What: Copy a frame's rectangles into the window's row type; `&[ReadingRect]` lends the list.
/// Why: Selection and find rectangles reach the markup as model rows.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function modelRows(rectangles: ReadingRect[]): SourceSelection[];
/// ```
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

/// Render shared shaped rows, releasing state before any Slint setter can reenter.
pub(super) fn render(window: &AppWindow, state: &Rc<RefCell<State>>) {
    let factor = window.window().scale_factor();
    // The palette's selection ink follows the color scheme while its selection fill does not,
    // so the ink is chosen from the fill that is actually drawn behind the selected glyphs.
    let colors = CodeColors {
        foreground: rgba(window.get_source_foreground().color()),
        selected: legible_ink(
            rgba(window.get_selection_fill().color()),
            rgba(window.get_selected_foreground().color()),
        ),
        dark: window.get_dark_scheme(),
    };
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
    let first = current.first;
    let horizontal = current.horizontal;
    let viewport = Viewport {
        first,
        count: current.count,
        width: current.width + 256.0,
        scale: factor,
    };
    // What: Some stores a present image; None means the existing image remains valid.
    // Why: Caret-only updates must not reshape, rasterize, or upload source pixels.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let pixels: SourcePixels | undefined;
    // if (!samePaintInputs(previous, next)) pixels = paint(prepare(document));
    // ```
    let mut rendered_pixels = None;
    // Stale or absent find results yield an empty list, so outdated positions are never drawn.
    let ranges = paint_ranges(
        &current.find,
        current.file_generation,
        current.document.revision(),
    );
    let found = present(&current);
    // Stale or absent hint and diagnostic snapshots yield nothing; only the materialized rows are taken.
    let inks = annotate::colors(window);
    let shown = annotate::visible(&current);
    let stamp = FrameStamp::new(
        &current.document,
        viewport,
        horizontal,
        colors,
        Arc::clone(&current.styles),
    )
    .with_matches(Arc::clone(&ranges))
    .with_annotations(Arc::clone(&shown), inks);
    // Match rectangles change only together with the frame, never on caret-only updates.
    let mut rendered_matches = None;
    if current.frame_stamp.as_ref() != Some(&stamp) {
        // Destructure the mutable borrow so caches can update while source is lent read-only.
        let State {
            document,
            styles,
            shaper,
            raster,
            row_map,
            ..
        } = &mut *current;
        let mut view = shaper.prepare_rows(document, viewport, styles, row_map);
        view.matches = rectangles(
            &view,
            &ranges,
            found.active,
            horizontal,
            horizontal + viewport.width,
        );
        rendered_matches = Some(model_rows(&view.matches));
        // Annotations are positioned after shaping and never change the geometry inside a code row.
        let frame = lay_out(&view, &shown, shaper, inks);
        // `Some(frame)` hands the positioned annotations to the raster with the rows they belong to.
        view.annotations = Some(frame);
        // Propagate raster failure visibly rather than retaining misleading old source pixels.
        match raster.paint(&view, colors, horizontal) {
            Ok(image) => {
                rendered_pixels = Some(image);
            }
            Err(error) => {
                tracing::error!(%error, "source raster failed");
                current.frame_stamp = None;
                drop(current);
                window.set_source_image(slint::Image::default());
                window.set_error_message(SharedString::from(format!(
                    "Cannot render source: {error}"
                )));
                return;
            }
        }
        current.shaped = Some(view);
        current.frame_stamp = Some(stamp);
    } else {
        // What: Destructuring lends the cached frame for change and the map for reading at once.
        // Why: The materialized lines are unchanged, but rows above them may not be: the frame then keeps
        //      its pixels and only moves, and its find rectangles are handed over at their new place.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (current.shaped?.rebase(current.rowMap)) renderedMatches = modelRows(current.shaped.matches);
        // ```
        let State {
            shaped, row_map, ..
        } = &mut *current;
        if let Some(view) = shaped.as_mut()
            && view.rebase(row_map)
        {
            rendered_matches = Some(model_rows(&view.matches));
        }
    }
    // The stamp is set only after a corresponding view and image were successfully prepared.
    let view = current.shaped.as_ref().expect("painted source view");
    // Prototype variant: a marker 12 px after the text of each materialized line with message rows.
    let mut markers = Vec::new();
    if let Some(frame) = &view.annotations {
        for row in &view.rows {
            let mut worst: Option<u8> = None;
            for text in &frame.texts {
                if text.line == row.row
                    && let Some(severity) = text.severity
                {
                    let level = ide_app::annotation::rank(severity);
                    if worst.is_none_or(|known| return level < known) {
                        worst = Some(level);
                    }
                }
            }
            if let Some(level) = worst {
                markers.push(super::ui::SourceMarker {
                    x: row.layout.full_width() / factor + 12.0,
                    y: row.top,
                    severity: i32::from(level),
                });
            }
        }
    }
    let document = &current.document;
    let caret = view.caret(document);
    let selections = model_rows(&view.selections);
    let position = document.position();
    let revision = document.revision();
    let selected = document.selected_text();
    // The tile starts at the top of the first materialized line's block.
    let origin = view.origin;
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
    let diagnostic = notices.join("\n");
    let placement = rows::measure(&current, anchor_line);
    drop(current);

    if let Some(pixels) = rendered_pixels {
        // Premultiplied pixels share the font engine's baseline and advances.
        let buffer = slint::SharedPixelBuffer::<slint::Rgba8Pixel>::clone_from_slice(
            &pixels.bytes,
            pixels.width,
            pixels.height,
        );
        window.set_source_image(slint::Image::from_rgba8_premultiplied(buffer));
        window.set_image_x(horizontal);
        window.set_image_width(pixels.width as f32 / factor);
        window.set_image_height(pixels.height as f32 / factor);
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
    if let Some(marks) = rendered_matches {
        window.set_source_matches(ModelRc::from(Rc::new(VecModel::from(marks))));
    }
    annotate::present_problems(window, problems);
    window.set_source_markers(ModelRc::from(Rc::new(VecModel::from(markers))));
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
