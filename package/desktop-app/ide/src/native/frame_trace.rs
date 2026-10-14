//! Debug records of the moments a window frame passes through,
//!  so a delay between a size event and the picture of that size can be placed in time.
//!  The records carry the log's own wall-clock stamps,
//!  and they are shown at the `monochromatic_ide::native::frame` target.

/// The window the records belong to.
use super::AppWindow;
/// The winit window events and the hook that sees them before the toolkit does.
use i_slint_backend_winit::{EventResult, WinitWindowAccessor, winit::event::WindowEvent};
/// The toolkit's window, rendering stages, and graphics API.
use slint::{ComponentHandle, GraphicsAPI, RenderingState, Window};

/// What:
///  Log a size event or a redraw request of the windowing system,
///  and let the toolkit handle it.
/// Why:
///  The stamp of the size event and of the redraw request that follows it say whether the redraw waits for the
///  windowing system's frame callback or for the application.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function logWindowEvent(window: Window, event: WindowEvent): EventResult;
/// ```
fn log_window_event(toolkit_window: &Window, event: &WindowEvent) -> EventResult {
    match event {
        WindowEvent::Resized(size) => {
            tracing::debug!(
                target: "monochromatic_ide::native::frame",
                width = size.width,
                height = size.height,
                "winit reported a new size"
            );
        }
        WindowEvent::RedrawRequested => {
            let size = toolkit_window.size();
            tracing::debug!(
                target: "monochromatic_ide::native::frame",
                toolkit_width = size.width,
                toolkit_height = size.height,
                "winit asked for a redraw"
            );
        }
        _ => {}
    }
    return EventResult::Propagate;
}

/// What:
///  Log the start and the end of each draw.
/// Why:
///  The end of a draw is the last moment before the buffer goes to the compositor.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function logRenderingStage(state: RenderingState, api: GraphicsAPI): void;
/// ```
fn log_rendering_stage(state: RenderingState, _graphics_api: &GraphicsAPI<'_>) {
    match state {
        RenderingState::BeforeRendering => {
            tracing::debug!(
                target: "monochromatic_ide::native::frame",
                "the toolkit began drawing a frame"
            );
        }
        RenderingState::AfterRendering => {
            tracing::debug!(
                target: "monochromatic_ide::native::frame",
                "the toolkit finished drawing a frame"
            );
        }
        _ => {}
    }
}

/// What:
///  Log the size events and redraw requests the windowing system delivers,
///  and the stages of each draw.
/// Why:
///  The stamp of a size event, of the draw that follows it,
///  and of the buffer the compositor receives are the three moments that say where a one-frame delay comes from.
///  Both hooks only read and log;
///  the event always goes on to the toolkit.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function bind(window: AppWindow): void;
/// ```
pub(super) fn bind(window: &AppWindow) {
    window.window().on_winit_window_event(log_window_event);
    let reported = window.window().set_rendering_notifier(log_rendering_stage);
    if let Err(error) = reported {
        tracing::debug!(
            target: "monochromatic_ide::native::frame",
            %error,
            "the renderer reports no draw stages"
        );
    }
}
