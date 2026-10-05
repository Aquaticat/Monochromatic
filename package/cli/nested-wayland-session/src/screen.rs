//! Apply the nested screen's logical size and output scale to the window, output, and surfaces.
//!
//! The arithmetic lives in `screen_geometry`; this module performs it against the live
//! compositor. The physical framebuffer is the nested window itself, so a new size or scale
//! first asks the parent compositor for a window that covers `logical size x scale`, then reads
//! back the size the window actually has. winit applies that request to a normal (not
//! maximized, tiled, or fullscreen) window at once, without waiting for the parent, so this
//! also works while the host session is locked.

/// What:     Grouped `use` of the Smithay pieces this module touches: the output mode, the
///           damage tracker, the display handle, winit's logical size, Smithay's size type
///           with its physical-pixel tag, and the fractional-scale and viewporter states.
/// Why:      Applying a geometry rewrites the output mode and scale and tells every surface.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Mode, OutputDamageTracker, DisplayHandle, LogicalSize, Size, ... } from "smithay";
/// ```
use smithay::{
    backend::renderer::damage::OutputDamageTracker,
    output::Mode,
    reexports::{wayland_server::DisplayHandle, winit::dpi::LogicalSize},
    utils::{Physical, Size},
    wayland::{
        fractional_scale::{with_fractional_scale, FractionalScaleManagerState},
        viewporter::ViewporterState,
    },
};

/// What:     Grouped `use` of this crate's refresh constant, the fullscreen reconfigure, the
///           wire response, the geometry types, and the compositor state.
/// Why:      `apply` rebuilds the mode, reconfigures the toplevel, and answers control verbs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { OUTPUT_REFRESH_MHZ } from "./backend"; import { Compositor } from "./state"; ...
/// ```
use crate::{
    backend::OUTPUT_REFRESH_MHZ,
    handler::xdg_shell::reconfigure_fullscreen,
    protocol::Response,
    screen_geometry::{OutputScale, ScreenGeometry},
    state::Compositor,
};

/// The current geometry plus the two protocol globals that carry a fractional scale.
///
/// What:     `pub struct ScreenState { ... }`. `geometry` is the logical size and scale the
///           caller asked for. The two underscore-prefixed fields are kept only so the
///           `wp_fractional_scale_manager_v1` and `wp_viewporter` globals live as long as the
///           compositor; the underscore silences the "never read" lint.
/// Why:      winit binds `wp_viewporter` only when `wp_fractional_scale_manager_v1` exists, and
///           once it binds the fractional manager it ignores integer scales from `wl_output`.
///           Advertising both lets a hosted winit client render at exactly 1.25 or 1.5 and
///           tell this compositor its logical size through the viewport.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type ScreenState = { geometry: ScreenGeometry; fractionalScaleGlobal: Global; viewporterGlobal: Global };
/// ```
pub struct ScreenState {
    /// Logical size the hosted toplevel is configured with, and the scale surfaces are told.
    pub geometry: ScreenGeometry,
    /// Keeps the `wp_fractional_scale_manager_v1` global alive.
    _fractional_scale: FractionalScaleManagerState,
    /// Keeps the `wp_viewporter` global alive.
    _viewporter: ViewporterState,
}

/// Construction of the screen state.
///
/// What:     `impl ScreenState { ... }`.
/// Why:      The globals must be created against the display before any client connects.
impl ScreenState {
    /// Register the fractional-scale and viewporter globals and remember the starting geometry.
    ///
    /// What:     `pub fn new(display: &DisplayHandle, geometry: ScreenGeometry) -> Self`.
    ///           `&DisplayHandle` lends the display; `::<Compositor>` tells each global which
    ///           state type answers its requests.
    /// Why:      Called once from `Compositor::new`, beside the other protocol globals.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// static new(display, geometry): ScreenState { ... }
    /// ```
    pub fn new(display: &DisplayHandle, geometry: ScreenGeometry) -> Self {
        let fractional_scale = FractionalScaleManagerState::new::<Compositor>(display);
        let viewporter = ViewporterState::new::<Compositor>(display);
        return Self { geometry, _fractional_scale: fractional_scale, _viewporter: viewporter };
    }
}

/// Make `target` the nested screen: size the window, set the output, and tell the client.
///
/// What:     `pub fn apply(state: &mut Compositor, target: ScreenGeometry) -> Result<(),
///           String>`. `Result<(), String>` is success with no value, or a message. `()` is the
///           empty tuple, Rust's "nothing".
/// Why:      `resize`, `scale`, and parent-initiated window changes all end in the same state:
///           the output mode equals the framebuffer, the output scale equals the target scale,
///           and every hosted surface knows both.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function apply(state: Compositor, target: ScreenGeometry): void { ... } // throws a string
/// ```
pub fn apply(state: &mut Compositor, target: ScreenGeometry) -> Result<(), String> {
    // What:     `state.backend.window()` borrows the winit window; `.scale_factor()` is the
    //           parent output's scale (the host's, unrelated to `target.scale`).
    // Why:      The parent sizes windows in its own logical pixels.
    let parent_scale = state.backend.window().scale_factor();
    let (request_width, request_height) = target.parent_request(parent_scale);

    // What:     `LogicalSize::new(w, h)` is winit's size in the parent's logical pixels.
    //           `request_inner_size` returns the size it applied as an `Option`; `let _ =`
    //           discards it because `window_size` below reads the same value.
    // Why:      winit resizes a normal window locally and immediately, so the framebuffer
    //           size is final before this function returns.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // window.requestInnerSize({ logical: [requestWidth, requestHeight] });
    // ```
    let _ = state
        .backend
        .window()
        .request_inner_size(LogicalSize::new(request_width, request_height));

    // What:     `window_size()` returns `Size<i32, Physical>`, the framebuffer in physical
    //           pixels. `.w` and `.h` are its two fields.
    // Why:      The parent may round, or keep its own size; the mode must match reality.
    let framebuffer = state.backend.window_size();
    if !target.fits_framebuffer((framebuffer.w, framebuffer.h), parent_scale) {
        let (expected_width, expected_height) = target.physical_size();
        tracing::warn!(
            framebuffer_width = framebuffer.w,
            framebuffer_height = framebuffer.h,
            expected_width,
            expected_height,
            "parent compositor kept the nested window size",
        );
        return Err(format!(
            "the parent compositor kept the nested window at {}x{} physical pixels instead of \
             {expected_width}x{expected_height} ({}x{} logical at scale {}); it may be maximized, \
             tiled, or fullscreen there: make it a normal window and retry",
            framebuffer.w,
            framebuffer.h,
            target.logical_width,
            target.logical_height,
            target.scale.factor(),
        ));
    }

    // What:     `let previous = state.screen.geometry;` copies the current geometry (the type
    //           is `Copy`, so this is a value copy, not a move).
    // Why:      Only parts that changed are re-announced: an unchanged scale is not resent and
    //           an unchanged logical size sends no configure, so a scale switch reaches the
    //           client without a resize.
    let previous = state.screen.geometry;
    set_mode(state, framebuffer, target.scale != previous.scale, target.scale);
    state.screen.geometry = target;
    if target.logical_width != previous.logical_width || target.logical_height != previous.logical_height {
        reconfigure_fullscreen(state);
    }
    tell_surfaces_scale(state);
    state.backend.window().request_redraw();
    tracing::info!(
        logical_width = target.logical_width,
        logical_height = target.logical_height,
        scale = target.scale.factor(),
        framebuffer_width = framebuffer.w,
        framebuffer_height = framebuffer.h,
        "applied nested screen geometry",
    );
    return Ok(());
}

/// Make the output mode the framebuffer size, and announce the scale when it changed.
///
/// What:     `fn set_mode(state: &mut Compositor, framebuffer: Size<i32, Physical>,
///           scale_changed: bool, scale: OutputScale)`. Private helper.
/// Why:      Smithay sends `wl_output.mode`, `wl_output.scale`, and `xdg_output.logical_size`
///           from `change_current_state`; the damage tracker is rebuilt for the new size.
fn set_mode(state: &mut Compositor, framebuffer: Size<i32, Physical>, scale_changed: bool, scale: OutputScale) {
    let mode = Mode { size: framebuffer, refresh: OUTPUT_REFRESH_MHZ };
    // What:     `None` leaves the scale as it is; `Some(...)` sets and announces a new one.
    // Why:      Resending an unchanged scale would wake every client's scale watcher for nothing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const announced = scaleChanged ? scale.advertised() : undefined;
    // ```
    let mut announced = None;
    if scale_changed {
        announced = Some(scale.advertised());
    }
    state.output.change_current_state(Some(mode), None, announced, None);
    state.output.set_preferred(mode);
    state.damage_tracker = OutputDamageTracker::from_output(&state.output);
}

/// Tell every surface of every mapped window the current fractional scale.
///
/// What:     `fn tell_surfaces_scale(state: &Compositor)`. Walks each window's surface tree,
///           popups included, and sets the preferred scale Smithay sends as
///           `wp_fractional_scale_v1.preferred_scale` (in 120ths). Smithay sends nothing when a
///           surface already has that value.
/// Why:      Smithay's `Space` only sends output enter and leave; the fractional scale is the
///           compositor's job, and it is how winit learns the scale.
fn tell_surfaces_scale(state: &Compositor) {
    let factor = state.screen.geometry.scale.factor();
    for window in state.space.elements() {
        // What:     `with_surfaces(|_surface, states| { ... })` runs the closure once per surface;
        //           `states` borrows that surface's stored data. `with_fractional_scale` lends
        //           its fractional-scale record to the inner closure.
        // Why:      Every surface, including popups, renders at the output scale.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // window.withSurfaces((_surface, states) => fractionalScaleOf(states).setPreferredScale(factor));
        // ```
        window.with_surfaces(|_surface, states| {
            with_fractional_scale(states, |fractional| {
                fractional.set_preferred_scale(factor);
            });
        });
    }
}

/// Answer the `scale` control verb: switch the scale, keeping the logical size.
///
/// What:     `pub fn switch_scale(state: &mut Compositor, scale: OutputScale) -> Response`.
///           `ScreenGeometry { scale, ..current }` copies every other field from `current`.
/// Why:      `ok unchanged` tells a test that no client was notified, so it must not wait for a
///           repaint, mirroring the `color-scheme` verb.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function switchScale(state, scale): Response { ... }
/// ```
pub fn switch_scale(state: &mut Compositor, scale: OutputScale) -> Response {
    let current = state.screen.geometry;
    if scale == current.scale {
        return Response::OkWith("unchanged".to_string());
    }
    let target = ScreenGeometry { scale, ..current };
    match apply(state, target) {
        Ok(()) => return Response::OkWith("changed".to_string()),
        Err(message) => return Response::Err(message),
    }
}

/// Answer the `resize` control verb: change the logical size, keeping the scale.
///
/// What:     `pub fn resize(state: &mut Compositor, width: i32, height: i32) -> Response`.
/// Why:      The framebuffer becomes `width x height` times the scale, applied at once rather
///           than after a parent event that a locked host session never sends.
pub fn resize(state: &mut Compositor, width: i32, height: i32) -> Response {
    let target = ScreenGeometry { logical_width: width, logical_height: height, scale: state.screen.geometry.scale };
    match apply(state, target) {
        Ok(()) => return Response::Ok,
        Err(message) => return Response::Err(message),
    }
}

/// Follow a size change the parent compositor made to the nested window.
///
/// What:     `pub fn parent_resized(state: &mut Compositor, size: Size<i32, Physical>)`.
/// Why:      A size the screen already has needs nothing. Rounding by the parent keeps the
///           logical size; a real change (a dragged edge, a tiling layout) derives a new
///           logical size at the current scale. The host's own scale is never adopted as the
///           nested scale, so captures do not depend on which host output shows the window.
pub fn parent_resized(state: &mut Compositor, size: Size<i32, Physical>) {
    // What:     `.map(|mode| mode.size)` reads the size out of the optional current mode.
    // Why:      Our own `apply` already set the mode to this size; ignore that echo.
    let current = state.output.current_mode().map(|mode| return mode.size);
    if current == Some(size) {
        return;
    }
    let parent_scale = state.backend.window().scale_factor();
    let target = state.screen.geometry.after_parent_resize((size.w, size.h), parent_scale);
    tracing::info!(width = size.w, height = size.h, parent_scale, "parent compositor resized the nested window");
    // What:     `if let Err(message) = ...` runs the block only for the failure variant.
    // Why:      A target derived from this framebuffer fits it, so failure means the parent
    //           changed the size again meanwhile; keep the mode equal to what is drawn.
    if let Err(message) = apply(state, target) {
        tracing::warn!(%message, "could not follow the parent window size; matching the framebuffer");
        let framebuffer = state.backend.window_size();
        let scale = state.screen.geometry.scale;
        set_mode(state, framebuffer, false, scale);
    }
}
