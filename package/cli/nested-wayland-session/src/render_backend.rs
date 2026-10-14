//! The two render backends behind one handle:
//!  the nested winit window and the surfaceless headless renderer.
//!
//! Everything that is not the display itself (dmabuf import, screenshot readback,
//!  recording, input, the control socket) reaches the GPU through `renderer()`
//!  and is the same in both modes.
//!  Only the parts that talk to a parent window differ:
//!  the window's scale, its size request, and its redraw request.
//!  `window()` answers those for both modes,
//!  so a headless session has no parent scale (1.0), takes any size at once, and ignores redraw requests.

use std::cell::Cell;

use smithay::{
    backend::{renderer::gles::GlesRenderer, winit::WinitGraphicsBackend},
    reexports::winit::{
        dpi::{LogicalSize, PhysicalSize},
        window::Window,
    },
    utils::{Physical, Size},
};
use tracing::debug;

use crate::backend_select::BackendKind;

/// The surfaceless renderer and the framebuffer size the screen currently has.
///
/// What:
///      `pub struct HeadlessBackend { ... }`.
///  `size` sits in a `Cell` so `window().request_inner_size(..)`, which borrows the backend read-only
///  as the winit window does, can store the new size.
/// Why:
///       With no window, the framebuffer size is only a number the output mode must agree with.
pub struct HeadlessBackend {
    /// GLES renderer on the surfaceless EGL display of the DRM render node.
    renderer: GlesRenderer,
    /// Physical framebuffer size, the logical screen size times the output scale.
    size: Cell<Size<i32, Physical>>,
}

impl HeadlessBackend {
    /// Wrap a renderer with its starting framebuffer size.
    ///
    /// What:
    ///      `pub fn new(renderer: GlesRenderer, size: Size<i32, Physical>) -> Self`.
    /// Why:
    ///       The caller builds the EGL display and renderer; this only owns them.
    pub fn new(renderer: GlesRenderer, size: Size<i32, Physical>) -> Self {
        return Self { renderer, size: Cell::new(size) }
    }
}

/// The renderer of whichever backend this session uses.
///
/// What:
///      `pub enum RenderBackend { Winit(..), Headless(..) }`.
/// Why:
///       `Compositor::backend` has this type, so the rest of the crate needs no knowledge of the mode.
pub enum RenderBackend {
    /// A winit window inside a parent session, with its GLES renderer.
    Winit(WinitGraphicsBackend<GlesRenderer>),
    /// Surfaceless EGL; nothing is ever presented.
    Headless(HeadlessBackend),
}

/// The parent window as far as the screen code needs it.
///
/// What:
///      `pub enum HostWindow<'a> { Winit(&'a Window), Headless(&'a Cell<Size<i32, Physical>>) }`.
///  A borrowed view; copying it is free.
/// Why:
///       `screen::apply` asks the parent for a size, reads the scale, and requests a redraw;
///  the headless answers are fixed and local.
#[derive(Clone, Copy)]
pub enum HostWindow<'a> {
    /// The nested winit window.
    Winit(&'a Window),
    /// The headless framebuffer size cell.
    Headless(&'a Cell<Size<i32, Physical>>),
}

impl HostWindow<'_> {
    /// The parent output's scale factor, always 1.0 without a parent.
    ///
    /// What:
    ///      `pub fn scale_factor(&self) -> f64`.
    /// Why:
    ///       Headless sizes are in physical pixels already, so the logical request equals the physical size.
    pub fn scale_factor(&self) -> f64 {
        return match self {
            Self::Winit(window) => window.scale_factor(),
            Self::Headless(_) => 1.0,
        }
    }

    /// Ask for a new window size in the parent's logical pixels.
    ///
    /// What:
    ///      `pub fn request_inner_size(&self, size: LogicalSize<u32>) -> Option<PhysicalSize<u32>>`.
    ///  Headless applies it at once, never below one pixel, and returns it.
    /// Why:
    ///       Same contract as winit's call, so `screen::apply` reads the result back through `window_size()`.
    pub fn request_inner_size(&self, size: LogicalSize<u32>) -> Option<PhysicalSize<u32>> {
        return match self {
            Self::Winit(window) => window.request_inner_size(size),
            Self::Headless(cell) => {
                let width = size.width.max(1);
                let height = size.height.max(1);
                cell.set((width as i32, height as i32).into());
                debug!(width, height, "headless framebuffer size set");
                Some(PhysicalSize::new(width, height))
            }
        }
    }

    /// Ask for another frame.
    ///
    /// What:
    ///      `pub fn request_redraw(&self)`.
    ///  A no-op without a window.
    /// Why:
    ///       The headless frame timer sends frame callbacks on its own, and screenshots render on demand.
    pub fn request_redraw(&self) {
        if let Self::Winit(window) = self {
            window.request_redraw();
        }
    }
}

impl RenderBackend {
    /// Which mode this backend is.
    ///
    /// What:
    ///      `pub fn kind(&self) -> BackendKind`.
    /// Why:
    ///       Frame pacing and the redraw path branch on it.
    pub fn kind(&self) -> BackendKind {
        return match self {
            Self::Winit(_) => BackendKind::NestedWinit,
            Self::Headless(_) => BackendKind::Headless,
        }
    }

    /// The GLES renderer, for dmabuf import, screenshots, and recordings.
    ///
    /// What:
    ///      `pub fn renderer(&mut self) -> &mut GlesRenderer`.
    /// Why:
    ///       The one path both modes share.
    pub fn renderer(&mut self) -> &mut GlesRenderer {
        return match self {
            Self::Winit(winit) => winit.renderer(),
            Self::Headless(headless) => &mut headless.renderer,
        }
    }

    /// The parent window view.
    ///
    /// What:
    ///      `pub fn window(&self) -> HostWindow<'_>`.
    /// Why:
    ///       Keeps `state.backend.window().scale_factor()` style calls working in both modes.
    pub fn window(&self) -> HostWindow<'_> {
        return match self {
            Self::Winit(winit) => HostWindow::Winit(winit.window()),
            Self::Headless(headless) => HostWindow::Headless(&headless.size),
        }
    }

    /// The framebuffer size in physical pixels.
    ///
    /// What:
    ///      `pub fn window_size(&self) -> Size<i32, Physical>`.
    /// Why:
    ///       `screen::apply` compares it with the request.
    pub fn window_size(&self) -> Size<i32, Physical> {
        return match self {
            Self::Winit(winit) => winit.window_size(),
            Self::Headless(headless) => headless.size.get(),
        }
    }

    /// The winit backend, when this session has one.
    ///
    /// What:
    ///      `pub fn as_winit_mut(&mut self) -> Option<&mut WinitGraphicsBackend<GlesRenderer>>`.
    /// Why:
    ///       Only the live redraw binds and submits a window framebuffer; headless presents nothing.
    pub fn as_winit_mut(&mut self) -> Option<&mut WinitGraphicsBackend<GlesRenderer>> {
        return match self {
            Self::Winit(winit) => Some(winit),
            Self::Headless(_) => None,
        }
    }
}
