//! Shared helpers of the rendered window tests: a software-rendered window, its pixels, and rounded-box geometry.
//!
//! What: `Rendered` builds the real `AppWindow` on Slint's software renderer, wires it like the focus tests do, and draws it
//! into a pixel buffer; `Frame` reads and compares those pixels; `RoundedBox` describes a box with per-corner radii and says
//! how far a point is from its edge.
//! Why: whether a focus ring is where D117 puts it, and whether the element inside it changed, are properties of the
//! pixels, and the geometry of the element is a property of the element tree; a test needs both on the same window.
//! Note: one platform is installed per test thread, so a test builds one `Rendered`.

use std::rc::Rc;

use i_slint_backend_testing::ElementHandle;
use slint::platform::software_renderer::{MinimalSoftwareWindow, RepaintBufferType};
use slint::platform::{Platform, WindowAdapter, WindowEvent};
use slint::{ComponentHandle, PlatformError, Rgb8Pixel};

use crate::AppWindow;
use crate::ui_host::Host;
use crate::ui_screen::{project, update_state};
use crate::ui_screen_view::ScreenState;
use crate::ui_test_support::{RecordingHost, load_library, settle};

/// What: `SoftwarePlatform` hands one software window to every window the test creates.
/// Why: Slint needs a platform to create a window, and this one draws into memory.
struct SoftwarePlatform {
    /// The window every `AppWindow` of the test uses.
    window: Rc<MinimalSoftwareWindow>,
}

/// The platform of the rendered tests.
impl Platform for SoftwarePlatform {
    /// What: `create_window_adapter` gives the shared software window.
    fn create_window_adapter(&self) -> Result<Rc<dyn WindowAdapter>, PlatformError> {
        return Ok(self.window.clone());
    }
}

/// What: `install_software_platform` installs the software renderer as this thread's platform and gives its window.
/// Why: every window of a rendered test, the real one or a small fixture, draws into memory through it; a thread installs one.
pub(crate) fn install_software_platform() -> Rc<MinimalSoftwareWindow> {
    let window = MinimalSoftwareWindow::new(RepaintBufferType::NewBuffer);
    slint::platform::set_platform(Box::new(SoftwarePlatform { window: window.clone() })).expect("no platform is installed yet on this thread");
    return window;
}

/// What: `draw_frame` draws a software window into a pixel buffer and gives the pixels.
/// Why: the first draws build what the properties asked for (a page that has just become visible), and the last draws it.
pub(crate) fn draw_frame(window: &MinimalSoftwareWindow, width: usize, height: usize) -> Frame {
    let mut pixels = vec![Rgb8Pixel::default(); width * height];
    for _ in 0..3 {
        slint::platform::update_timers_and_animations();
        window.request_redraw();
        window.draw_if_needed(|renderer| {
            renderer.render(&mut pixels, width);
        });
    }
    return Frame { width, height, pixels };
}

/// What: `Frame` is one rendered picture of the window.
pub(crate) struct Frame {
    /// Width in pixels.
    pub width: usize,
    /// Height in pixels.
    pub height: usize,
    /// Pixels row by row.
    pub pixels: Vec<Rgb8Pixel>,
}

/// Methods of `Frame`.
impl Frame {
    /// What: `at` gives the pixel at a column and row as `[red, green, blue]`.
    pub(crate) fn at(&self, x: usize, y: usize) -> [u8; 3] {
        let pixel = self.pixels[y * self.width + x];
        return [pixel.r, pixel.g, pixel.b];
    }

    /// What: `differing_box` gives the smallest box `(left, top, right, bottom)` (right and bottom exclusive) around every
    /// pixel that differs between this frame and another of the same size, or None when they are equal.
    /// Why: the pixels a focus ring adds are exactly the pixels that differ between the frame with and without it.
    pub(crate) fn differing_box(&self, other: &Self) -> Option<(usize, usize, usize, usize)> {
        let mut found: Option<(usize, usize, usize, usize)> = None;
        for y in 0..self.height {
            for x in 0..self.width {
                if self.at(x, y) != other.at(x, y) {
                    found = Some(match found {
                        None => (x, y, x + 1, y + 1),
                        Some((left, top, right, bottom)) => (left.min(x), top.min(y), right.max(x + 1), bottom.max(y + 1)),
                    });
                }
            }
        }
        return found;
    }
}

/// What: `Rendered` is the real window on the software renderer, with the library loaded.
pub(crate) struct Rendered {
    /// The window under test.
    pub app: AppWindow,
    /// The software window the platform hands out.
    window: Rc<MinimalSoftwareWindow>,
    /// Width in pixels.
    width: usize,
    /// Height in pixels.
    height: usize,
}

/// Methods of `Rendered`.
impl Rendered {
    /// What: `new` builds the window at a size, in the light scheme, with the test library loaded and the window active.
    /// Why: the same setup as the focus tests (`fresh_window_at`) but on a renderer that draws.
    pub(crate) fn new(width: usize, height: usize) -> Self {
        let window = install_software_platform();
        update_state(|state| {
            *state = ScreenState::default();
        });
        crate::ui_settings::replace_saver(|_track_rows, _playing| return Ok(()));
        let app = AppWindow::new().expect("the window builds on the software renderer");
        app.window().set_size(slint::PhysicalSize::new(u32::try_from(width).unwrap_or(1), u32::try_from(height).unwrap_or(1)));
        app.global::<crate::Theme>().set_scheme_override(1);
        let host = Rc::new(RecordingHost::default());
        let as_host: Rc<dyn Host> = Rc::clone(&host) as Rc<dyn Host>;
        crate::ui_wire::wire_host_callbacks(&app, &as_host);
        crate::ui_settings::wire_callbacks(&app);
        crate::ui_search::wire_route(&app);
        crate::ui_search::wire_open(&app, Rc::clone(&as_host));
        crate::ui_menu::wire_request(&app);
        app.show().expect("the window shows");
        app.window().dispatch_event(WindowEvent::WindowActiveChanged(true));
        project(&app);
        load_library(&app);
        settle();
        return Self { app, window, width, height };
    }

    /// What: `frame` draws the window and gives the pixels.
    /// Why: the first draws build what the properties asked for (a page that has just become visible), and the last draws it.
    pub(crate) fn frame(&self) -> Frame {
        return draw_frame(&self.window, self.width, self.height);
    }

    /// What: `wait` lets real time pass so a 100 ms or 120 ms fade has finished, then runs the timers.
    /// Why: the software platform uses the real clock, and a state layer or the menu fade is mid-way until it has run.
    pub(crate) fn wait(&self, milliseconds: u64) {
        std::thread::sleep(std::time::Duration::from_millis(milliseconds));
        slint::platform::update_timers_and_animations();
    }

    /// What: `set_dark` switches between the light scheme (false) and the dark scheme (true).
    pub(crate) fn set_dark(&self, dark: bool) {
        self.app.global::<crate::Theme>().set_scheme_override(if dark { 2 } else { 1 });
        settle();
    }

    /// What: `ring_frames` draws the window with the keyboard ring on and again with it off, and gives both.
    /// Why: the focus stays where it is, so the two frames differ only by what the ring draws; any other difference is a
    /// focus-driven change that D117 forbids.
    pub(crate) fn ring_frames(&self) -> (Frame, Frame) {
        let focus = self.app.global::<crate::Focus>();
        // A page that has just opened, or a state layer, is still fading for up to 150 ms; both frames are drawn after it ended.
        focus.set_ring_visible(true);
        self.wait(160);
        let on = self.frame();
        focus.set_ring_visible(false);
        self.wait(160);
        let off = self.frame();
        focus.set_ring_visible(true);
        settle();
        return (on, off);
    }
}

/// What: `box_of` gives an element's window position and size as `(x, y, width, height)`.
pub(crate) fn box_of(element: &ElementHandle) -> (f32, f32, f32, f32) {
    let position = element.absolute_position();
    let size = element.size();
    return (position.x, position.y, size.width, size.height);
}

/// What: `RoundedBox` is a box with a radius at each corner.
#[derive(Clone, Copy, Debug)]
pub(crate) struct RoundedBox {
    /// Left edge.
    pub x: f32,
    /// Top edge.
    pub y: f32,
    /// Width.
    pub width: f32,
    /// Height.
    pub height: f32,
    /// Radii of the top left, top right, bottom right and bottom left corners.
    pub radii: [f32; 4],
}

/// Methods of `RoundedBox`.
impl RoundedBox {
    /// What: `new` makes a box with the same radius at every corner.
    pub(crate) fn new(x: f32, y: f32, width: f32, height: f32, radius: f32) -> Self {
        return Self { x, y, width, height, radii: [radius; 4] };
    }

    /// What: `grown` gives the box grown by an amount on every side, the way D117 grows the element for each ring: every corner's
    /// radius grows by the amount, so a square corner becomes a corner of that radius when the box grows and stays square when it
    /// shrinks.
    /// Why: the near ring's outer edge is the element grown by 2 px and the outer ring's outer edge is the element grown by 3 px,
    /// each with its corner radii grown the same, as Firefox's `PaintAutoStyleOutline` does.
    pub(crate) fn grown(&self, amount: f32) -> Self {
        let grow = |radius: f32| return if radius > 0.0 || amount > 0.0 { (radius + amount).max(0.0) } else { 0.0 };
        return Self {
            x: self.x - amount,
            y: self.y - amount,
            width: self.width + 2.0 * amount,
            height: self.height + 2.0 * amount,
            radii: self.radii.map(grow),
        };
    }

    /// What: `distance` gives the signed distance from a point to the box's edge: negative inside, positive outside.
    /// Why: a ring pixel is one between the outer and the inner edge, and the tests need a margin around both edges where
    /// the anti-aliased pixels are not judged.
    pub(crate) fn distance(&self, px: f32, py: f32) -> f32 {
        let center_x = self.x + self.width / 2.0;
        let center_y = self.y + self.height / 2.0;
        let right = px >= center_x;
        let bottom = py >= center_y;
        let radius = match (right, bottom) {
            (false, false) => self.radii[0],
            (true, false) => self.radii[1],
            (true, true) => self.radii[2],
            (false, true) => self.radii[3],
        };
        let qx = (px - center_x).abs() - (self.width / 2.0 - radius);
        let qy = (py - center_y).abs() - (self.height / 2.0 - radius);
        return qx.max(0.0).hypot(qy.max(0.0)) + qx.max(qy).min(0.0) - radius;
    }

    /// What: `near_a_curve` tells whether a point is within a margin of one of the box's rounded corners.
    /// Why: the software renderer approximates the coverage of an arc, so a pixel on a curve is only roughly its band's color,
    /// while a pixel on a straight edge is exact; a test judges the two differently.
    pub(crate) fn near_a_curve(&self, px: f32, py: f32, margin: f32) -> bool {
        let center_x = self.x + self.width / 2.0;
        let center_y = self.y + self.height / 2.0;
        let radius = match (px >= center_x, py >= center_y) {
            (false, false) => self.radii[0],
            (true, false) => self.radii[1],
            (true, true) => self.radii[2],
            (false, true) => self.radii[3],
        };
        return radius > 0.0
            && (px - center_x).abs() > self.width / 2.0 - radius - margin
            && (py - center_y).abs() > self.height / 2.0 - radius - margin;
    }
}
