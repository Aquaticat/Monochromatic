//! Presenting a frame to the window:
//!  the pixels and offsets a presentation carries,
//!  the gutter's wrap indicator,
//!  and the setters that run after the state borrow ends.

/// The window,
///  the source state,
///  the find presentation,
///  and the annotation readings.
use crate::native::{
    AppWindow, State, annotate, find::present::present, rows, ui::SourceSelection,
};
/// The rectangles a frame hands to the window.
use ide_app::shaped_text::ReadingRect;
/// Toolkit images and models carry owned source presentation data.
use slint::{Image, ModelRc, Rgba8Pixel, SharedPixelBuffer, SharedString, VecModel};
/// UI callbacks share state without cross-thread synchronization.
use std::{cell::RefCell, rc::Rc};

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

/// What:
///  What one presentation hands the window: new pixels, the offsets, and the frame's diagnostics.
/// Why:
///  The tile swap and the synchronous path present through the same code, so they cannot disagree on order.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Frame = { pixels?: Pixels; matchesChanged: boolean; scale: number; scrolled?: number; sign?: Pixels };
/// ```
pub(in crate::native) struct Frame {
    /// Pixels of a newly painted tile, when one was swapped in.
    pub(in crate::native) pixels: Option<SharedPixelBuffer<Rgba8Pixel>>,
    /// Whether the match rectangles changed and must be handed over again.
    pub(in crate::native) matches_changed: bool,
    /// Physical pixels per logical pixel, to size the image.
    pub(in crate::native) scale: f32,
    /// Scroll offset that settling the rows asked the window to take.
    pub(in crate::native) scrolled: Option<f32>,
    /// Line the language surface belongs to.
    pub(in crate::native) anchor_line: i32,
    /// A failure to start or queue a tile, shown with the other diagnostics.
    pub(in crate::native) notice: Option<String>,
    /// The gutter's wrap indicator, painted again after a change of display scale.
    pub(in crate::native) sign: Option<SharedPixelBuffer<Rgba8Pixel>>,
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
pub(super) fn ensure_sign(
    current: &mut State,
    factor: f32,
) -> Option<SharedPixelBuffer<Rgba8Pixel>> {
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

/// Present the displayed frame: its image and offsets, its gutter, rectangles, and caret, then the other readings.
/// Each setter runs after the state borrow ends.
pub(in crate::native) fn show(window: &AppWindow, state: &Rc<RefCell<State>>, frame: Frame) {
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
