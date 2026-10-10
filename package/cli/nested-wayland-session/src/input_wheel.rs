//! Native notched-wheel injection through the nested seat,
//!  not a client test API.

/// Application diagnostics describe malformed or currently unmapped input.
use anyhow::{bail, Context, Result};
/// Smithay distinguishes wheel axes from touchpad/finger gestures.
use smithay::{
    backend::input::{Axis, AxisSource},
    input::pointer::{AxisFrame, MotionEvent},
    utils::{Logical, Point, SERIAL_COUNTER},
};
/// Only the nested compositor's seat is touched.
use crate::state::Compositor;

/// Inject wheel notches at logical coordinates;
///  positive means down/right.
///
/// What:
///  Each notch becomes 120 discrete Wayland units plus its logical delta.
/// Why:
///  Clients can distinguish a physical wheel from cancelled/programmatic scroll.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// pointer.move(x, y);
/// pointer.wheel({ horizontalNotches, verticalNotches });
/// ```
pub fn wheel(state: &mut Compositor, x: f64, y: f64, horizontal: i32, vertical: i32) -> Result<()> {
    if !x.is_finite() || !y.is_finite() {
        bail!("wheel coordinates must be finite");
    }
    let horizontal_v120 = horizontal.checked_mul(120).context("horizontal wheel count is too large")?;
    let vertical_v120 = vertical.checked_mul(120).context("vertical wheel count is too large")?;
    let pointer = state.seat.get_pointer().context("nested seat has no pointer")?;
    // Logical coordinates are local to the nested output, never the host desktop.
    let location: Point<f64, Logical> = (x, y).into();
    let under = state.surface_under(location);
    if under.is_none() {
        bail!("no nested client surface at wheel position {x},{y}");
    }
    let time = state.start_time.elapsed().as_millis() as u32;
    pointer.motion(state, under, &MotionEvent {
        location, serial: SERIAL_COUNTER.next_serial(), time,
    });
    let mut frame = AxisFrame::new(time);
    frame = frame.source(AxisSource::Wheel);
    if horizontal != 0 {
        frame = frame.value(Axis::Horizontal, f64::from(horizontal) * 10.0);
        frame = frame.v120(Axis::Horizontal, horizontal_v120);
    }
    if vertical != 0 {
        frame = frame.value(Axis::Vertical, f64::from(vertical) * 10.0);
        frame = frame.v120(Axis::Vertical, vertical_v120);
    }
    pointer.axis(state, frame);
    pointer.frame(state);
    tracing::debug!(x, y, horizontal, vertical, "injected nested wheel notches");
    return Ok(());
}
