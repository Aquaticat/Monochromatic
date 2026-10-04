//! Parse real-wheel control input independently of the compositor.

/// Reuse the protocol's numeric parsing and command representation.
use super::{parse_f64, parse_i32, Command};

/// Parse wheel coordinates and horizontal/vertical notch counts.
pub(super) fn parse(tokens: &mut std::str::SplitWhitespace) -> Result<Command, String> {
    let x = parse_f64(tokens.next(), "wheel x")?;
    let y = parse_f64(tokens.next(), "wheel y")?;
    let horizontal = parse_i32(tokens.next(), "horizontal notches")?;
    let vertical = parse_i32(tokens.next(), "vertical notches")?;
    if !x.is_finite() || !y.is_finite() {
        return Err("wheel coordinates must be finite".to_string());
    }
    if horizontal.checked_mul(120).is_none() || vertical.checked_mul(120).is_none() {
        return Err("wheel notch count exceeds the Wayland v120 range".to_string());
    }
    if tokens.next().is_some() {
        return Err("wheel expects X Y HORIZONTAL_NOTCHES VERTICAL_NOTCHES".to_string());
    }
    return Ok(Command::Wheel { x, y, horizontal, vertical });
}
