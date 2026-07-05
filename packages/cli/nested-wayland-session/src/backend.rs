//! Winit backend initialisation: the nested window, its GLES renderer, the output,
//! and the dmabuf protocol state.
//!
//! This runs while the process's `WAYLAND_DISPLAY` still points at the PARENT
//! compositor (the host session), so the winit window becomes a client of the host.
//! It mirrors anvil's proven winit path: build the renderer, query the render node so
//! we can advertise dmabuf v4 modifier feedback (falling back to v3), and bind the
//! EGL display for Mesa's legacy hardware-acceleration path.

/// What:     Grouped `use` of the renderer traits, EGL device query, winit backend,
///           output types, transform, dmabuf types, and the display handle.
/// Why:      Everything `init_backend` references.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { GlesRenderer, EGLDevice, winit, Output, ... } from "smithay";
/// ```
use smithay::{
    backend::{
        egl::EGLDevice,
        renderer::{gles::GlesRenderer, ImportDma, ImportEgl},
        winit::{self, WinitEventLoop},
    },
    output::{Mode, Output, PhysicalProperties, Subpixel},
    reexports::{
        wayland_server::DisplayHandle,
        winit::{dpi::PhysicalSize, window::WindowAttributes},
    },
    utils::Transform,
    wayland::dmabuf::{DmabufFeedbackBuilder, DmabufState},
};

/// What:     `use anyhow::{Context, Result};`. Error helpers.
/// Why:      `init_backend` returns `Result` and attaches context to winit failures.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // throw/rethrow-with-message helpers
/// ```
use anyhow::{Context, Result};

/// What:     `use tracing::{info, warn};`. Structured log macros.
/// Why:      Report the chosen dmabuf version and hardware-acceleration status.
use tracing::{info, warn};

/// What:     `use crate::{cli::Config, state::BackendPieces};`. Our config input and the
///           carrier struct for the built pieces.
/// Why:      `init_backend` reads the requested size from `Config` and returns
///           `BackendPieces`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Config } from "./cli";
/// import { BackendPieces } from "./state";
/// ```
use crate::{cli::Config, state::BackendPieces};

/// Milli-hertz refresh rate reported for the nested output (60.000 Hz).
///
/// What:     `const OUTPUT_REFRESH_MHZ: i32 = 60_000;`. Signed `i32`; Smithay reports
///           refresh in millihertz, so 60 Hz is 60000.
/// Why:      Named so the magic number is not repeated at the mode-construction site.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const OUTPUT_REFRESH_MHZ = 60000;
/// ```
pub const OUTPUT_REFRESH_MHZ: i32 = 60_000;

/// Build the winit backend, the nested output, and the dmabuf state.
///
/// What:     `pub fn init_backend(display_handle: &DisplayHandle, config: &Config) ->
///           Result<(BackendPieces, WinitEventLoop)>`. Borrows the display handle and
///           config, returns the built pieces plus the winit event source to register.
/// Why:      Isolate all the winit/EGL/dmabuf construction from the state wiring.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function initBackend(displayHandle, config): [BackendPieces, WinitEventLoop] { ... }
/// ```
///
/// @example
/// ```ts
/// const [pieces, winit] = initBackend(displayHandle, config);
/// ```
pub fn init_backend(
    display_handle: &DisplayHandle,
    config: &Config,
) -> Result<(BackendPieces, WinitEventLoop)> {
    // What:     `let attributes = WindowAttributes::default().with_title(...)
    //           .with_inner_size(PhysicalSize::new(w, h));`. Builds the winit window
    //           request. `config.width as u32` casts the signed dimension to the
    //           unsigned type `PhysicalSize::new` wants.
    // Why:      The nested window's inner size is the screen resolution the app fills.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const attributes = { title: "...", innerSize: { width: config.width, height: config.height } };
    // ```
    let attributes = WindowAttributes::default()
        .with_title("nested-wayland-session")
        .with_inner_size(PhysicalSize::new(config.width as u32, config.height as u32));

    // What:     `let (mut backend, winit) = winit::init_from_attributes::<GlesRenderer>(
    //           attributes).map_err(...)?;`. Creates the backend + event loop. The
    //           `::<GlesRenderer>` picks the renderer type. `.map_err(|e| anyhow!(...))`
    //           converts Smithay's error into an `anyhow::Error`; the trailing `?`
    //           returns it on failure. `mut backend` because we call `renderer()`
    //           (a `&mut` method) below.
    // Why:      This is the nested window and its GPU renderer.
    let (mut backend, winit) = winit::init_from_attributes::<GlesRenderer>(attributes)
        .map_err(|err| anyhow::anyhow!("winit backend init failed: {err}"))?;

    // What:     `let mode = Mode { size: (config.width, config.height).into(), refresh:
    //           OUTPUT_REFRESH_MHZ };`. The output's video mode. `(w, h).into()` builds
    //           a `Size<i32, Physical>` from the tuple.
    // Why:      Describe the nested screen's resolution and refresh to clients.
    let mode = Mode {
        size: (config.width, config.height).into(),
        refresh: OUTPUT_REFRESH_MHZ,
    };

    // What:     `let output = Output::new("nested".to_string(), PhysicalProperties { ... });`.
    //           Creates the output object. `"nested".to_string()` allocates its owned
    //           name; `PhysicalProperties` describes make/model/physical size (0x0 mm for
    //           a virtual screen). `.into()` builds each owned string / size.
    // Why:      The one screen the fixture presents.
    let output = Output::new(
        "nested".to_string(),
        PhysicalProperties {
            size: (0, 0).into(),
            subpixel: Subpixel::Unknown,
            make: "Monochromatic".into(),
            model: "NestedWaylandSession".into(),
        },
    );

    // What:     `let _global = output.create_global::<Compositor>(display_handle);`.
    //           Registers the `wl_output` global. The returned id is bound to `_global`;
    //           dropping it does NOT remove the global (the `Output` keeps it), so
    //           letting it fall out of scope is fine.
    // Why:      Advertise the screen to clients.
    let _global = output.create_global::<crate::state::Compositor>(display_handle);

    // What:     `output.change_current_state(Some(mode), Some(Transform::Flipped180),
    //           None, Some((0, 0).into()));`. Sets the active mode, a Y-flip transform
    //           (winit's framebuffer origin is top-left, opposite Wayland's), no scale
    //           change (`None`), and position `(0, 0)`.
    // Why:      Make the mode current and correct the vertical flip so screenshots are
    //           upright.
    output.change_current_state(
        Some(mode),
        Some(Transform::Flipped180),
        None,
        Some((0, 0).into()),
    );

    // What:     `output.set_preferred(mode);`. Marks this mode as the preferred one.
    // Why:      Clients pick the preferred mode when choosing a size.
    output.set_preferred(mode);

    // What:     `let render_node = EGLDevice::device_for_display(backend.renderer()
    //           .egl_context().display()).and_then(|device| device.try_get_render_node());`.
    //           Walks renderer -> EGL context -> EGL display -> the DRM render node.
    //           `device_for_display` returns `Result<EGLDevice>`; `.and_then(closure)`
    //           runs the next fallible step only on success, yielding
    //           `Result<Option<DrmNode>>`.
    // Why:      dmabuf v4 feedback needs the render node's device id so the client
    //           allocates buffers on the right GPU.
    let render_node = EGLDevice::device_for_display(backend.renderer().egl_context().display())
        .and_then(|device| device.try_get_render_node());

    // What:     `let mut dmabuf_state = DmabufState::new();`. Fresh dmabuf state; `mut`
    //           because creating the global borrows it mutably.
    // Why:      Owns the dmabuf protocol bookkeeping.
    let mut dmabuf_state = DmabufState::new();

    // What:     `let (dmabuf_global, dmabuf_feedback) = match render_node { Ok(Some(node))
    //           => { ... build v4 ... }, _ => { ... build v3 ... } };`. Pattern-match the
    //           render-node result: a present node builds v4 default-feedback; any other
    //           outcome (query error or no node) falls back to plain v3.
    // Why:      Prefer v4 modifier feedback (what the app negotiates), but never fail if
    //           the render node cannot be determined.
    let (dmabuf_global, dmabuf_feedback) = match render_node {
        Ok(Some(node)) => {
            // What:     `let formats = backend.renderer().dmabuf_formats();`. The set of
            //           dmabuf formats/modifiers the renderer can import (from `ImportDma`).
            // Why:      Feedback advertises exactly these to the client.
            let formats = backend.renderer().dmabuf_formats();

            // What:     `let feedback = DmabufFeedbackBuilder::new(node.dev_id(), formats)
            //           .build().context(...)?;`. Builds the default feedback for that
            //           device id and format set; `.context(msg)?` turns a build error
            //           into a clean failure.
            // Why:      Assemble the v4 feedback object.
            let feedback = DmabufFeedbackBuilder::new(node.dev_id(), formats)
                .build()
                .context("building dmabuf v4 default feedback failed")?;

            // What:     `let global = dmabuf_state.create_global_with_default_feedback::
            //           <Compositor>(display_handle, &feedback);`. Registers the
            //           `zwp_linux_dmabuf_v1` global at version 4 with this feedback.
            // Why:      Advertise dmabuf v4 to the client.
            let global = dmabuf_state
                .create_global_with_default_feedback::<crate::state::Compositor>(
                    display_handle,
                    &feedback,
                );

            info!("dmabuf: advertising v4 with modifier feedback");

            // What:     `(global, Some(feedback))`. Tuple of the global and the kept
            //           feedback (tail of this match arm).
            // Why:      Keep the feedback alive alongside the global.
            (global, Some(feedback))
        }
        _ => {
            // What:     `warn!(...)`. Log that we could not get a render node.
            // Why:      Make the v3 fallback visible in logs.
            warn!("dmabuf: no render node available, falling back to v3");

            // What:     `let formats = backend.renderer().dmabuf_formats();`. Same format
            //           set for the v3 global.
            // Why:      v3 advertises the format list without per-device feedback.
            let formats = backend.renderer().dmabuf_formats();

            // What:     `let global = dmabuf_state.create_global::<Compositor>(
            //           display_handle, formats);`. Registers the dmabuf global at v3.
            // Why:      Still let the client import GPU buffers, just without feedback.
            let global = dmabuf_state
                .create_global::<crate::state::Compositor>(display_handle, formats);

            // What:     `(global, None)`. No feedback in the v3 path.
            // Why:      Signal v3 was used.
            (global, None)
        }
    };

    // What:     `if backend.renderer().bind_wl_display(display_handle).is_ok() { ... }`.
    //           `bind_wl_display` (from `ImportEgl`, enabled by `use_system_lib`) sets up
    //           the legacy EGL `wl_drm` path; `.is_ok()` is `true` when it succeeds.
    // Why:      Mesa accepts either dmabuf v4 OR this wl_drm path for hardware
    //           acceleration; binding it is belt-and-braces so the GPU import always has a
    //           route.
    if backend.renderer().bind_wl_display(display_handle).is_ok() {
        info!("EGL hardware-acceleration (wl_drm) enabled");
    }

    // What:     `Ok((BackendPieces { ... }, winit))`. Bundle the built pieces and the
    //           winit event source; tail expression.
    // Why:      Hand everything back to `run` for state construction and source
    //           registration.
    Ok((
        BackendPieces {
            backend,
            output,
            dmabuf_state,
            dmabuf_global,
            dmabuf_feedback,
        },
        winit,
    ))
}
