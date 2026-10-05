//! Native image updates and source reading-state presentation.

/// What: Child modules can borrow their parent's private state and generated UI.
/// Why: Keep one document owner while separating input from rendering.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { type State, AppWindow, SourceSelection } from '../native';
/// ```
use super::{AppWindow, State, find::present::present, ui::SourceSelection};
/// Match rectangles come from the same shaped rows as selection rectangles.
use ide_app::find_navigation::paint_ranges;
/// Only matches inside the materialized rows and horizontal tile become native rectangles.
use ide_app::find_paint::rectangles;
/// Selected-text ink is chosen from the selection fill, not from the color scheme.
use ide_app::selection_ink::legible_ink;
/// Physical viewport description for shared shaping.
use ide_app::shaped_text::Viewport;
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
    let mut current = state.borrow_mut();
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
    let stamp = FrameStamp::new(
        &current.document,
        viewport,
        horizontal,
        colors,
        Arc::clone(&current.styles),
    )
    .with_matches(Arc::clone(&ranges));
    // Match rectangles change only together with the frame, never on caret-only updates.
    let mut rendered_matches = None;
    if current.frame_stamp.as_ref() != Some(&stamp) {
        // Destructure the mutable borrow so caches can update while source is lent read-only.
        let State {
            document,
            styles,
            shaper,
            raster,
            ..
        } = &mut *current;
        let mut view = shaper.prepare(document, viewport, styles);
        view.matches = rectangles(
            &view,
            &ranges,
            found.active,
            horizontal,
            horizontal + viewport.width,
        );
        let mut marks = Vec::new();
        for rect in &view.matches {
            marks.push(SourceSelection {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
            });
        }
        rendered_matches = Some(marks);
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
    }
    // The stamp is set only after a corresponding view and image were successfully prepared.
    let view = current.shaped.as_ref().expect("painted source view");
    let document = &current.document;
    let caret = view.caret(document);
    let mut selections = Vec::new();
    for rect in &view.selections {
        selections.push(SourceSelection {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
        });
    }
    let position = document.position();
    let revision = document.revision();
    let lines = document.text().len_lines();
    let selected = document.selected_text();
    let mut document_width = current.document_width;
    // Trailing blanks count as width, and the caret after the widest line needs room inside the scroll range.
    for row in &view.rows {
        document_width = document_width.max(row.layout.full_width() / factor + CARET_ROOM);
    }
    current.document_width = document_width;
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
        window.set_image_y(first as f32 * 24.0);
        window.set_image_width(pixels.width as f32 / factor);
        window.set_image_height(pixels.height as f32 / factor);
    }
    window.set_error_message(SharedString::from(diagnostic));
    window.set_source_selections(ModelRc::from(Rc::new(VecModel::from(selections))));
    window.set_selection_is_match(found.active.is_some());
    if let Some(marks) = rendered_matches {
        window.set_source_matches(ModelRc::from(Rc::new(VecModel::from(marks))));
    }
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
    window.set_total_lines(lines as i32);
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
