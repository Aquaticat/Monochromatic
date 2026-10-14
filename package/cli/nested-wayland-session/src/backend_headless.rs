//! Headless backend initialisation:
//!  surfaceless EGL on the DRM render node,
//!  its GLES renderer,
//!  the output,
//!  and the dmabuf protocol state.
//!
//! Nothing here connects to a parent display,
//!  so the session runs on a machine with no Wayland or X11 session (CI,
//! SSH)
//!  and never opens a window on a desktop.
//! The nested window path inherits the parent compositor's EGL device;
//!  this path has no parent to inherit from,
//!  so it asks EGL (`EGL_MESA_platform_surfaceless`) for the default render device,
//!  reads the DRM render node of that same display,
//!  and advertises exactly the format and modifier pairs that display can import.
//!  A client therefore allocates its dmabufs on the GPU that imports them.

/// Error context for the EGL setup steps,
/// and the result type of `init_headless_backend`.
use anyhow::{Context, Result};
/// The surfaceless EGL display,
/// device,
/// and context,
/// the GLES renderer,
/// and the display handle.
use smithay::{
    backend::{
        egl::{native::EGLSurfacelessDisplay, EGLContext, EGLDevice, EGLDisplay},
        renderer::{gles::GlesRenderer, ImportEgl},
    },
    reexports::wayland_server::DisplayHandle,
};
/// Log which device the surfaceless display opened on,
/// and warn about a software rasterizer.
use tracing::{info, warn};

/// The shared output and dmabuf builders,
/// the config,
/// the headless backend types,
/// and the state carrier.
use crate::{
    backend_parts::{build_dmabuf, build_output},
    cli::Config,
    render_backend::{HeadlessBackend, RenderBackend},
    screen_geometry::ScreenGeometry,
    state::BackendPieces,
};

/// Build the surfaceless renderer,
///  the output,
///  and the dmabuf state.
///
/// What:
///      `pub fn init_headless_backend(display_handle: &DisplayHandle, config: &Config) ->
///           Result<BackendPieces>`.
///  Opens `EGLDisplay::new(EGLSurfacelessDisplay)`,
///  makes a GLES context on it,
///  and builds the same output and dmabuf global the nested path builds.
/// Why:
///       The only difference from the nested path is where the pixels go:
///  nowhere until a screenshot or recording renders the output off screen.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function initHeadlessBackend(displayHandle, config): BackendPieces { ... }
/// ```
pub fn init_headless_backend(display_handle: &DisplayHandle, config: &Config) -> Result<BackendPieces> {
    let geometry = ScreenGeometry {
        logical_width: config.width,
        logical_height: config.height,
        scale: config.scale,
    };
    let (physical_width, physical_height) = geometry.physical_size();

    // What:     `EGLDisplay::new(EGLSurfacelessDisplay)` asks Mesa for the surfaceless platform
    //           display, which needs neither a window system nor a parent session. It is `unsafe`
    //           because the native display value must outlive the display; the unit type does.
    // Why:      The issue's required render path: offscreen rendering with no parent display.
    let egl_display = unsafe { EGLDisplay::new(EGLSurfacelessDisplay) }
        .context("opening the surfaceless EGL display failed (is a DRM render node available?)")?;

    // What:     `EGLDevice::device_for_display(..)` names the device behind the display;
    //           `is_software()` is true for a CPU rasterizer such as llvmpipe.
    // Why:      The mode exists to render on the real GPU; say so when it does not.
    let device = EGLDevice::device_for_display(&egl_display).context("querying the EGL device failed")?;
    if device.is_software() {
        warn!("headless: the EGL device is a software rasterizer, not a GPU; clients render on the CPU");
    }
    info!(
        render_node = ?device.render_device_path().ok(),
        drm_node = ?device.drm_device_path().ok(),
        "headless: surfaceless EGL display opened on this device",
    );

    let context = EGLContext::new(&egl_display).context("creating the EGL context failed")?;
    // What:     `GlesRenderer::new(context)` is `unsafe` because the context must not be current
    //           on another thread; this thread creates it and is the only user.
    // Why:      The same renderer type the nested path uses, so import and readback code is shared.
    let mut renderer = unsafe { GlesRenderer::new(context) }.context("creating the GLES renderer failed")?;

    let output = build_output(display_handle, geometry);
    let (dmabuf_state, dmabuf_global, dmabuf_feedback) = build_dmabuf(display_handle, &mut renderer)?;

    // What:     The legacy `wl_drm` acceleration path; the surfaceless display may not offer it.
    // Why:      dmabuf v4 is the route in headless mode, so a failure here is only logged.
    match renderer.bind_wl_display(display_handle) {
        Ok(()) => info!("headless: EGL hardware-acceleration (wl_drm) enabled"),
        Err(error) => info!(%error, "headless: wl_drm acceleration is not offered; clients use dmabuf"),
    }

    return Ok(BackendPieces {
        backend: RenderBackend::Headless(Box::new(HeadlessBackend::new(
            renderer,
            (physical_width, physical_height).into(),
        ))),
        output,
        dmabuf_state,
        dmabuf_global,
        dmabuf_feedback,
        geometry,
    })
}
