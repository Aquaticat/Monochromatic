//! Native image updates and source reading-state presentation.

/// What: Child modules can borrow their parent's private state and generated UI.
/// Why: Keep one document owner while separating input from rendering.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { type State, AppWindow, SourceSelection } from '../native';
/// ```
use super::{AppWindow, State, ui::SourceSelection};
/// Toolkit images and models carry owned source presentation data.
use slint::{ComponentHandle, ModelRc, SharedString, VecModel};
/// Physical viewport description for shared shaping.
use ide_app::shaped_text::Viewport;
/// Native palette values retain syntax and selection contrast.
use ide_app::text_raster::CodeColors;
/// UI callbacks share state without cross-thread synchronization.
use std::{cell::RefCell, rc::Rc};

/// Convert a toolkit palette color to raster input without losing alpha.
fn rgba(color: slint::Color) -> [u8; 4] {
    return [color.red(), color.green(), color.blue(), color.alpha()];
}

/// Render shared shaped rows, releasing state before any Slint setter can reenter.
pub(super) fn render(window: &AppWindow, state: &Rc<RefCell<State>>) {
    let factor = window.window().scale_factor();
    let colors = CodeColors {
        foreground: rgba(window.get_source_foreground().color()),
        selected: rgba(window.get_selected_foreground().color()),
        dark: window.get_dark_scheme(),
    };
    let mut current = state.borrow_mut();
    let first = current.first;
    let horizontal = current.horizontal;
    let viewport = Viewport {
        first, count: current.count, width: current.width + 256.0, scale: factor,
    };
    // What: Destructure a mutable borrow into disjoint fields.
    // Why: The shaper and raster own caches while the document remains borrowed read-only.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const { document, styles, shaper, raster } = state.current;
    // ```
    let State { document, styles, shaper, raster, .. } = &mut *current;
    let view = shaper.prepare(document, viewport, styles);
    let pixels = match raster.paint(&view, colors, horizontal) {
        Ok(pixels) => pixels,
        Err(error) => {
            tracing::error!(%error, "source raster failed");
            drop(current);
            window.set_source_image(slint::Image::default());
            window.set_status(SharedString::from(format!("Cannot render source: {error}")));
            return;
        }
    };
    let caret = view.caret(document);
    let mut selections = Vec::new();
    for rect in view.selection(document) {
        selections.push(SourceSelection { x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    }
    let position = document.position();
    let revision = document.revision();
    let lines = document.text().len_lines();
    let selected = document.selected_text();
    let source;
    if current.presented_revision != Some(revision) {
        source = Some(current.document.text().to_string());
        current.presented_revision = Some(revision);
    } else {
        source = None;
    }
    let mut document_width = current.document_width;
    for row in &view.rows {
        document_width = document_width.max(row.layout.width() / factor);
    }
    current.document_width = document_width;
    current.shaped = Some(view);
    drop(current);

    // Premultiplied pixels share the font engine's baseline and advances.
    let buffer = slint::SharedPixelBuffer::<slint::Rgba8Pixel>::clone_from_slice(
        &pixels.bytes, pixels.width, pixels.height,
    );
    window.set_source_image(slint::Image::from_rgba8_premultiplied(buffer));
    window.set_source_selections(ModelRc::from(Rc::new(VecModel::from(selections))));
    window.set_image_x(horizontal);
    window.set_image_y(first as f32 * 24.0);
    window.set_image_width(pixels.width as f32 / factor);
    window.set_image_height(pixels.height as f32 / factor);
    window.set_document_width(document_width);
    window.set_caret_x(caret.x);
    window.set_caret_y(caret.y);
    if let Some(source) = source {
        window.set_source_text(SharedString::from(source));
    }
    window.set_selected_text(SharedString::from(selected));
    window.set_total_lines(lines as i32);
    window.set_selection_anchor(position.anchor as i32);
    window.set_selection_head(position.head as i32);
    window.set_revision(revision as i32);
    window.set_status(SharedString::from(format!(
        "Read only · Revision {revision} · Selection {}:{} · Source-view gate",
        position.anchor, position.head
    )));
}
