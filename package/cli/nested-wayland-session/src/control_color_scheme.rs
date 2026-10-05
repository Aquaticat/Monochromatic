//! Apply the runtime `color-scheme` control verb to the private appearance portal only.

/// What:     A grouped `use` of the private portal handle, its value type, and the wire response.
///           The braces avoid repeating the common `crate::` prefix (`crate` is this package).
/// Why:      This function maps one typed control request onto one control-socket response.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { type AppearancePortal, type ColorSchemePreference } from "./appearance_portal";
/// import { type Response } from "./protocol";
/// ```
use crate::{
    appearance_portal::{AppearancePortal, ColorSchemePreference},
    protocol::Response,
};

/// Switch the private portal's color scheme, or explain why no private portal exists.
///
/// Scaffold only: the runtime switch is not implemented yet.
pub fn switch(_portal: Option<&AppearancePortal>, _preference: ColorSchemePreference) -> Response {
    return Response::Err("runtime color-scheme switching is not implemented".to_string());
}
